/**
 * Housekeeping state machine. Every job/task transition goes through here so
 * the rules live in one place (controllers and the scheduled runs both use it).
 *
 * Job:   Dirty -> Cleaning -> Inspection -> Ready
 *                    ^            |
 *                    +-- reject --+
 *        The inspector decides; a manager or the front desk can approve in
 *        their place, and a manager can also reject or mark a room Ready early.
 * Task:  Pending -> InProgress <-> Paused -> Completed   (Bedding / Toiletry)
 *        Pending -> InProgress (room reached Inspection) -> Completed on approve
 *                                                       -> Pending on reject  (Inspection)
 *
 * A stayover (reason 'stayover') is the daily service of a room whose guest is
 * staying on: bed made, toiletries refilled, toilet cleaned. It has the
 * Bedding and Toiletry tasks only, and nobody inspects it:
 *        Dirty -> Cleaning -> Ready   when both tasks are Completed
 *        Dirty / Cleaning  -> Ready   closed without being serviced (closed_as:
 *                                     do not disturb, the guest said no, ...);
 *                                     the unfinished tasks become Skipped
 *        It never changes room_units.status: that says whether the room is fit
 *        for a NEW guest, and this room is occupied.
 *
 * Transitions lock the job row (SELECT ... FOR UPDATE) so bedding and toiletry
 * completing at the same moment can't both miss the "both done" check.
 */
const crypto = require('crypto');
const { query, withTransaction } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const { TIMEZONE, localToday, localHour } = require('../utils/dates');
const storage = require('./storage.service');

// Lazily required to avoid a require cycle (realtime -> this service).
const realtime = () => require('../realtime');

const PRIORITIES = ['VIP', 'High', 'Normal'];
const CLEANING_TYPES = ['Bedding', 'Toiletry'];
const TASK_TYPES = ['Bedding', 'Toiletry', 'Inspection'];
const STAFF_ROLES = ['FrontDesk', 'Bedding', 'Toiletry', 'Inspector'];
const ROLE_FOR_TASK = { Bedding: 'Bedding', Toiletry: 'Toiletry', Inspection: 'Inspector' };

// An hour of the day (0-23, resort time) from the environment, or the usual one.
function hourSetting(name, usual) {
  const hour = Number(process.env[name]);
  return process.env[name] && Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : usual;
}

// The hour the morning's stayover jobs are raised, and the hour guests are due
// out of their rooms.
const STAYOVER_HOUR = hourSetting('STAYOVER_HOUR', 9);
const CHECKOUT_HOUR = hourSetting('CHECKOUT_HOUR', 11);

// Put on the cleaning job raised when check-out time passes with the guest
// still checked in. Taken off again once the guest has been checked out.
const LATE_NOTE =
  'Check-out time has passed and the guest has not been checked out yet. Ask the front desk before going in.';

// Why a housekeeper closed a stayover without servicing the room.
const SKIP_REASONS = ['dnd', 'refused', 'other'];

// The photo an inspector may attach when sending a room back is stored
// privately and deleted this many days after the room became Ready — the same
// number of days as photos of room problems.
const PHOTO_RETENTION_DAYS = Number(process.env.ISSUE_PHOTO_RETENTION_DAYS || 30);
const PHOTO_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// Random, non-guessable name for an inspector's photo, filed under its cleaning job.
const newInspectionPhotoKey = (jobId, contentType) =>
  `cleaning-inspections/${jobId}/${crypto.randomUUID()}.${PHOTO_EXT[contentType] || 'bin'}`;

// priority DESC, created_at ASC — used by every task/job list.
const PRIORITY_ORDER_SQL = `CASE cj.priority WHEN 'VIP' THEN 3 WHEN 'High' THEN 2 ELSE 1 END DESC, cj.created_at ASC`;

async function lockJob(client, jobId) {
  const { rows } = await client.query(`SELECT * FROM cleaning_jobs WHERE id = $1 FOR UPDATE`, [jobId]);
  if (rows.length === 0) throw new ApiError(404, 'Cleaning job not found');
  return rows[0];
}

// The job's status is also the room's — except for a stayover, which leaves
// the room's own status alone (the room is occupied either way).
async function setJobStatus(client, job, status, extra = '') {
  await client.query(
    `UPDATE cleaning_jobs SET status = $1, updated_at = now() ${extra} WHERE id = $2`,
    [status, job.id]
  );
  if (job.reason === 'stayover') return;
  await client.query(`UPDATE room_units SET status = $1, updated_at = now() WHERE id = $2`, [
    status,
    job.room_unit_id,
  ]);
}

async function createTasks(client, jobId, types = TASK_TYPES) {
  await client.query(
    `INSERT INTO cleaning_tasks (job_id, type) SELECT $1, unnest($2::text[])`,
    [jobId, types]
  );
}

// Tells the screens about jobs a scheduled run created or closed.
function announce(jobIds, event) {
  for (const id of jobIds) realtime().emitJobUpdate(id, event);
}

// ---------------------------------------------------------------------------
// Stayovers that end without (all of) the service being done
// ---------------------------------------------------------------------------

/**
 * Finishes open stayover jobs that were not serviced, or only partly. The job
 * becomes Ready with the reason in closed_as ('dnd', 'refused', 'other',
 * 'not_done'), and every task not already Completed becomes Skipped.
 */
async function closeStayovers(client, jobIds, closedAs, { note = null, staffId = null } = {}) {
  if (jobIds.length === 0) return;
  await client.query(
    `UPDATE cleaning_jobs
     SET status = 'Ready', ready_at = now(), closed_as = $2, closed_note = $3, closed_by_staff_id = $4, updated_at = now()
     WHERE id = ANY($1)`,
    [jobIds, closedAs, note, staffId]
  );
  await client.query(
    `UPDATE cleaning_tasks SET status = 'Skipped', updated_at = now()
     WHERE job_id = ANY($1) AND status <> 'Completed'`,
    [jobIds]
  );
}

// A full clean of the room is about to be raised: it replaces the stayover the
// room still has open, which is closed as "not done". Returns the ids closed.
async function closeOpenStayover(client, roomUnitId) {
  const { rows } = await client.query(
    `SELECT id FROM cleaning_jobs WHERE room_unit_id = $1 AND reason = 'stayover' AND status <> 'Ready' FOR UPDATE`,
    [roomUnitId]
  );
  const ids = rows.map((r) => r.id);
  await closeStayovers(client, ids, 'not_done');
  return ids;
}

// ---------------------------------------------------------------------------
// Job creation
// ---------------------------------------------------------------------------

/**
 * A full clean of a room (Bedding, Toiletry, Inspection), raised inside the
 * caller's transaction: a manager marking a room dirty, or a guest who has
 * been moved out of it to another room. The room is marked Dirty.
 * An open stayover on the room is closed first — the full clean replaces it.
 * If the room already has an open full clean, that job is returned instead of
 * a second one. No stay is linked to the job: a stay's own check-out clean is
 * still raised at check-out.
 * Returns { job, created }.
 */
async function markRoomDirty(client, { roomUnitId, notes = null, priority = 'Normal', adminId = null }) {
  await closeOpenStayover(client, roomUnitId);

  const openJob = async () => {
    const { rows } = await client.query(
      `SELECT * FROM cleaning_jobs WHERE room_unit_id = $1 AND status <> 'Ready'`,
      [roomUnitId]
    );
    return rows[0] || null;
  };
  const already = await openJob();
  if (already) return { job: already, created: false };

  const today = await localToday(client);
  const { rows } = await client.query(
    `INSERT INTO cleaning_jobs (room_unit_id, job_date, source, reason, priority, notes, created_by)
     VALUES ($1, $2, 'manual', 'manual', $3, $4, $5)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [roomUnitId, today, priority, notes || null, adminId || null]
  );
  // Someone else raised a job on this room in the same moment.
  if (rows.length === 0) return { job: await openJob(), created: false };

  const job = rows[0];
  await createTasks(client, job.id);
  await setJobStatus(client, job, 'Dirty');
  return { job, created: true };
}

// Admin marks a room Dirty by hand.
async function createManualJob({ roomUnitId, priority = 'Normal', notes, adminId }) {
  return withTransaction(async (client) => {
    const { rows: units } = await client.query(
      `SELECT id FROM room_units WHERE id = $1 AND is_active = true FOR UPDATE`,
      [roomUnitId]
    );
    if (units.length === 0) throw new ApiError(404, 'Room not found');

    const { job, created } = await markRoomDirty(client, { roomUnitId, notes, priority, adminId });
    if (!created) throw new ApiError(409, 'This room already has an open cleaning job');
    return job;
  });
}

/**
 * Cleaning job for a stay's check-out. Called inside the check-out transaction
 * (source 'checkout'), by the nightly safety net (source 'nightly'), and when
 * check-out time passes with the guest still checked in (source 'late': the
 * job carries LATE_NOTE until the guest has left).
 *
 * One check-out clean per stay. An open stayover on the room is closed first —
 * the full clean replaces it. If the stay already has its check-out job (the
 * 'late' one), that job is returned, and a real check-out takes the late note
 * off it. If the room has some other open job (e.g. a manager marked it
 * dirty), that job is linked to the stay instead of creating a second one.
 * Priority is High when the room has an arrival today.
 *
 * Returns { job, created } — and closedStayovers, the ids of stayover jobs it closed.
 */
async function createCheckoutJob(client, booking, source) {
  const closedStayovers = await closeOpenStayover(client, booking.room_unit_id);

  const { rows: existing } = await client.query(
    `SELECT * FROM cleaning_jobs WHERE booking_id = $1 AND reason = 'checkout' FOR UPDATE`,
    [booking.id]
  );
  if (existing.length > 0) {
    let job = existing[0];
    // The guest has now left: nobody needs to ask the front desk before going in.
    if (source === 'checkout' && job.notes && job.notes.includes(LATE_NOTE)) {
      const { rows } = await client.query(
        `UPDATE cleaning_jobs SET notes = NULLIF(btrim(replace(notes, $2, '')), ''), updated_at = now()
         WHERE id = $1 RETURNING *`,
        [job.id, LATE_NOTE]
      );
      job = rows[0];
    }
    return { job, created: false, closedStayovers };
  }

  const today = await localToday(client);
  const { rows: arrivals } = await client.query(
    `SELECT 1 FROM bookings WHERE room_unit_id = $1 AND id <> $2 AND status IN ('paid', 'confirmed') AND check_in = $3`,
    [booking.room_unit_id, booking.id, today]
  );
  const priority = arrivals.length > 0 ? 'High' : 'Normal';

  const { rows } = await client.query(
    `INSERT INTO cleaning_jobs (room_unit_id, booking_id, job_date, source, reason, priority, notes)
     VALUES ($1, $2, $3, $4, 'checkout', $5, $6)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [booking.room_unit_id, booking.id, today, source, priority, source === 'late' ? LATE_NOTE : null]
  );
  if (rows.length > 0) {
    const job = rows[0];
    await createTasks(client, job.id);
    await setJobStatus(client, job, 'Dirty');
    return { job, created: true, closedStayovers };
  }

  // The room has another open job. While the guest is still in the room that
  // job is left as it is; the late job is raised by a later run, once it is done.
  if (source === 'late') return { job: null, created: false, closedStayovers };

  const { rows: linked } = await client.query(
    `UPDATE cleaning_jobs SET booking_id = $1, updated_at = now()
     WHERE room_unit_id = $2 AND status <> 'Ready' AND booking_id IS NULL
     RETURNING *`,
    [booking.id, booking.room_unit_id]
  );
  return { job: linked[0] || null, created: false, closedStayovers };
}

/**
 * 11 PM safety net: any stay checked out in the last few days that has no
 * cleaning job of its own (e.g. the check-out transaction's job insert was
 * skipped) gets one now. The stayovers done during the stay don't count.
 * Returns the created jobs.
 */
async function generateNightlyJobs() {
  const day = await localToday();
  const { rows: missed } = await query(
    `SELECT b.id, b.room_unit_id FROM bookings b
     WHERE b.status = 'checked_out' AND b.checked_out_at > now() - interval '3 days'
       AND NOT EXISTS (SELECT 1 FROM cleaning_jobs cj WHERE cj.booking_id = b.id AND cj.reason <> 'stayover')
     ORDER BY b.checked_out_at`
  );
  const jobs = [];
  for (const booking of missed) {
    const { job, created } = await withTransaction((client) => createCheckoutJob(client, booking, 'nightly'));
    if (created) jobs.push(job);
  }
  return { date: day, jobs };
}

/**
 * The morning's stayover jobs: one for every occupied room — a stay that is
 * checked in, arrived before today and leaves after today. (A room whose guest
 * arrives or leaves today gets none; a departing room gets the full check-out
 * clean instead.) Bedding and Toiletry only.
 *
 * Runs every few minutes and acts once the resort's clock has reached
 * STAYOVER_HOUR, so a server that was asleep at that hour still does it when
 * it wakes. Safe to repeat: one stayover per room per day, and per stay per
 * day (a guest moved to another room is not serviced twice).
 *
 * First closes stayovers from earlier days that nobody got to, as "not done".
 * Returns { created, closed } — how many jobs of each.
 */
async function generateStayoverJobs() {
  if ((await localHour()) < STAYOVER_HOUR) return { created: 0, closed: 0 };
  const today = await localToday();

  const closed = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id FROM cleaning_jobs WHERE reason = 'stayover' AND status <> 'Ready' AND job_date < $1 FOR UPDATE`,
      [today]
    );
    const ids = rows.map((r) => r.id);
    await closeStayovers(client, ids, 'not_done');
    return ids;
  });

  // Rooms that already have a job open (a full clean in progress) wait: the
  // next run raises the stayover once that job is finished.
  const { rows: stays } = await query(
    `SELECT b.id, b.room_unit_id FROM bookings b
     WHERE b.status = 'checked_in' AND b.check_in < $1 AND b.check_out > $1
       AND NOT EXISTS (
         SELECT 1 FROM cleaning_jobs cj
         WHERE cj.reason = 'stayover' AND cj.job_date = $1
           AND (cj.room_unit_id = b.room_unit_id OR cj.booking_id = b.id))
       AND NOT EXISTS (
         SELECT 1 FROM cleaning_jobs cj WHERE cj.room_unit_id = b.room_unit_id AND cj.status <> 'Ready')
     ORDER BY b.room_unit_id`,
    [today]
  );
  const created = [];
  for (const stay of stays) {
    const jobId = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO cleaning_jobs (room_unit_id, booking_id, job_date, source, reason)
         VALUES ($1, $2, $3, 'stayover', 'stayover')
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [stay.room_unit_id, stay.id, today]
      );
      if (rows.length === 0) return null;
      await createTasks(client, rows[0].id, CLEANING_TYPES);
      return rows[0].id;
    });
    if (jobId) created.push(jobId);
  }

  announce(closed, 'job_closed');
  announce(created, 'job_created');
  return { created: created.length, closed: closed.length };
}

/**
 * Check-out time has passed and a guest who was due to leave is still checked
 * in: the room gets its check-out cleaning job now (source 'late', with
 * LATE_NOTE) and is marked Dirty, so housekeeping and the front desk both see
 * it. Nobody is checked out by this.
 *
 * Runs every few minutes and acts once the resort's clock has reached
 * CHECKOUT_HOUR. Safe to repeat: a stay has one check-out job.
 * Returns { created, closed } — jobs raised, and stayovers closed to make way.
 */
async function markLateCheckouts() {
  if ((await localHour()) < CHECKOUT_HOUR) return { created: 0, closed: 0 };
  const today = await localToday();

  // A room that already has a full clean open (a manager marked it dirty)
  // waits until that one is finished.
  const { rows: late } = await query(
    `SELECT b.id, b.room_unit_id FROM bookings b
     WHERE b.status = 'checked_in' AND b.check_out <= $1
       AND NOT EXISTS (SELECT 1 FROM cleaning_jobs cj WHERE cj.booking_id = b.id AND cj.reason = 'checkout')
       AND NOT EXISTS (
         SELECT 1 FROM cleaning_jobs cj
         WHERE cj.room_unit_id = b.room_unit_id AND cj.status <> 'Ready' AND cj.reason <> 'stayover')
     ORDER BY b.check_out, b.id`,
    [today]
  );
  const created = [];
  const closed = [];
  for (const stay of late) {
    const result = await withTransaction((client) => createCheckoutJob(client, stay, 'late'));
    if (result.created) created.push(result.job.id);
    closed.push(...result.closedStayovers);
  }

  announce(closed, 'job_closed');
  announce(created, 'job_created');
  return { created: created.length, closed: closed.length };
}

/**
 * For a stay extended after check-out time: the cleaning job raised because
 * the guest was "late" is no longer wanted. If nobody has started on it, the
 * job is removed and the room goes back to Ready. If work has begun (or the
 * stay has no such job), nothing changes. Runs inside the caller's
 * transaction. Returns true when a job was removed.
 */
async function dropUntouchedLateJob(client, bookingId) {
  const { rows } = await client.query(
    `SELECT id, room_unit_id FROM cleaning_jobs
     WHERE booking_id = $1 AND reason = 'checkout' AND source = 'late' AND status = 'Dirty'
     FOR UPDATE`,
    [bookingId]
  );
  const job = rows[0];
  if (!job) return false;

  const { rows: begun } = await client.query(
    `SELECT 1 FROM cleaning_tasks WHERE job_id = $1 AND (status <> 'Pending' OR start_time IS NOT NULL) LIMIT 1`,
    [job.id]
  );
  if (begun.length > 0) return false;

  await client.query(`DELETE FROM cleaning_jobs WHERE id = $1`, [job.id]); // its tasks go with it
  await client.query(`UPDATE room_units SET status = 'Ready', updated_at = now() WHERE id = $1`, [job.room_unit_id]);
  return true;
}

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------

/**
 * Assign staff to a job's tasks. `assignments` = { Bedding, Toiletry, Inspection }
 * with staff ids (any may be omitted). Completed tasks can't be reassigned.
 * A stayover has no Inspection task, so it takes no inspector.
 */
async function assignStaff(jobId, assignments) {
  return withTransaction(async (client) => {
    const job = await lockJob(client, jobId);
    if (job.status === 'Ready') throw new ApiError(409, 'This job is already finished');

    for (const type of TASK_TYPES) {
      const staffId = assignments[type];
      if (staffId === undefined) continue;

      const { rows: taskRows } = await client.query(
        `SELECT id, status, assigned_staff_id FROM cleaning_tasks WHERE job_id = $1 AND type = $2`,
        [jobId, type]
      );
      const task = taskRows[0];
      if (!task) {
        if (staffId === null) continue; // nobody to take off a task the job doesn't have
        throw new ApiError(
          400,
          job.reason === 'stayover' ? 'A stayover is not inspected, so it has no inspector' : `This job has no ${type} task`
        );
      }

      if (staffId !== null) {
        const { rows: staffRows } = await client.query(
          `SELECT role, is_active FROM staff WHERE id = $1`,
          [staffId]
        );
        if (staffRows.length === 0 || !staffRows[0].is_active) {
          throw new ApiError(400, `${type}: staff member not found or inactive`);
        }
        if (staffRows[0].role !== ROLE_FOR_TASK[type]) {
          throw new ApiError(
            400,
            `${type} task needs a ${ROLE_FOR_TASK[type]} staff member (got ${staffRows[0].role})`
          );
        }
      }

      if (task.assigned_staff_id === staffId) continue;
      if (task.status === 'Completed') {
        throw new ApiError(409, `${type} task is already completed and can't be reassigned`);
      }
      await client.query(
        `UPDATE cleaning_tasks SET assigned_staff_id = $1, updated_at = now() WHERE id = $2`,
        [staffId, task.id]
      );
    }
    return job;
  });
}

async function setPriority(jobId, priority) {
  const { rows } = await query(
    `UPDATE cleaning_jobs SET priority = $1, updated_at = now()
     WHERE id = $2 AND status <> 'Ready' RETURNING *`,
    [priority, jobId]
  );
  if (rows.length === 0) throw new ApiError(404, 'Open cleaning job not found');
  return rows[0];
}

// ---------------------------------------------------------------------------
// Staff actions (bedding / toiletry)
// ---------------------------------------------------------------------------

// Loads a task + locks its job, and checks it belongs to this staff member.
async function loadOwnTask(client, taskId, staffId) {
  const { rows } = await client.query(`SELECT job_id FROM cleaning_tasks WHERE id = $1`, [taskId]);
  if (rows.length === 0) throw new ApiError(404, 'Task not found');
  const job = await lockJob(client, rows[0].job_id);

  const { rows: taskRows } = await client.query(`SELECT * FROM cleaning_tasks WHERE id = $1`, [taskId]);
  const task = taskRows[0];
  if (task.assigned_staff_id !== staffId) throw new ApiError(403, 'This task is not assigned to you');
  // A manager can mark a room ready before its tasks are done, and a stayover
  // can be closed by the other housekeeper; nothing more happens on it then.
  if (job.status === 'Ready') {
    throw new ApiError(
      409,
      job.reason === 'stayover' ? "This room's stayover is already finished for today" : 'This room is already marked ready'
    );
  }
  return { job, task };
}

async function startTask(taskId, staffId) {
  return withTransaction(async (client) => {
    const { job, task } = await loadOwnTask(client, taskId, staffId);
    if (!CLEANING_TYPES.includes(task.type)) throw new ApiError(400, 'Inspection is done with approve/reject');
    if (!['Pending', 'Paused'].includes(task.status)) {
      throw new ApiError(409, `Can't start a task that is ${task.status}`);
    }

    // start_time is the first start; resuming from pause keeps it.
    await client.query(
      `UPDATE cleaning_tasks
       SET status = 'InProgress', start_time = COALESCE(start_time, now()), updated_at = now()
       WHERE id = $1`,
      [task.id]
    );
    if (job.status === 'Dirty') await setJobStatus(client, job, 'Cleaning');
    return job;
  });
}

async function pauseTask(taskId, staffId) {
  return withTransaction(async (client) => {
    const { job, task } = await loadOwnTask(client, taskId, staffId);
    if (task.status !== 'InProgress') throw new ApiError(409, 'Only a task in progress can be paused');
    await client.query(`UPDATE cleaning_tasks SET status = 'Paused', updated_at = now() WHERE id = $1`, [
      task.id,
    ]);
    return job;
  });
}

async function completeTask(taskId, staffId) {
  return withTransaction(async (client) => {
    const { job, task } = await loadOwnTask(client, taskId, staffId);
    if (!CLEANING_TYPES.includes(task.type)) throw new ApiError(400, 'Inspection is done with approve/reject');
    if (task.status !== 'InProgress') throw new ApiError(409, 'Start (or resume) the task before completing it');

    await client.query(
      `UPDATE cleaning_tasks SET status = 'Completed', end_time = now(), updated_at = now() WHERE id = $1`,
      [task.id]
    );

    const { rows } = await client.query(
      `SELECT count(*)::int AS done FROM cleaning_tasks
       WHERE job_id = $1 AND type = ANY($2) AND status = 'Completed'`,
      [job.id, CLEANING_TYPES]
    );
    if (rows[0].done === CLEANING_TYPES.length) {
      if (job.reason === 'stayover') {
        // Nobody inspects a stayover: with both tasks done it is finished.
        await setJobStatus(client, job, 'Ready', ', ready_at = now()');
      } else {
        await setJobStatus(client, job, 'Inspection');
        await client.query(
          `UPDATE cleaning_tasks SET status = 'InProgress', start_time = now(), end_time = NULL, updated_at = now()
           WHERE job_id = $1 AND type = 'Inspection'`,
          [job.id]
        );
      }
    }
    return job;
  });
}

/**
 * A housekeeper closes a stayover without servicing the room: "Do not
 * disturb" on the door ('dnd'), the guest said no ('refused'), or something
 * else ('other', which needs a note). Whichever of the two — bedding or
 * toiletry — reaches the door first does it for both: every task not already
 * Completed becomes Skipped and the job is finished.
 * Only for a stayover. A fault in a room is reported with "Report a problem".
 */
async function skipStayover(taskId, staffId, reason, note) {
  if (!SKIP_REASONS.includes(reason)) {
    throw new ApiError(400, `reason must be one of: ${SKIP_REASONS.join(', ')}`);
  }
  const closedNote = String(note || '').trim() || null;
  if (reason === 'other' && !closedNote) throw new ApiError(400, 'Say why the room was not serviced');

  return withTransaction(async (client) => {
    const { job } = await loadOwnTask(client, taskId, staffId);
    if (job.reason !== 'stayover') {
      throw new ApiError(409, 'Only a stayover can be closed without cleaning. This room has to be cleaned.');
    }
    await closeStayovers(client, [job.id], reason, { note: closedNote, staffId });
    return job;
  });
}

// ---------------------------------------------------------------------------
// Inspection decisions
// ---------------------------------------------------------------------------

// Who decided an inspection, as the cleaning_inspections column that records
// them: a staff member (the inspector, or front desk staff standing in for
// one) or a manager.
const byStaff = (id) => ({ column: 'inspector_id', id });
const byAdmin = (id) => ({ column: 'admin_id', id });

async function markApproved(client, job, by) {
  // start_time is already set when the room reached Inspection; it is only
  // missing when a manager marks the room ready before that.
  await client.query(
    `UPDATE cleaning_tasks
     SET status = 'Completed', start_time = COALESCE(start_time, now()), end_time = now(), updated_at = now()
     WHERE job_id = $1 AND type = 'Inspection'`,
    [job.id]
  );
  await setJobStatus(client, job, 'Ready', ', ready_at = now()');
  await client.query(
    `INSERT INTO cleaning_inspections (job_id, ${by.column}, result) VALUES ($1, $2, 'approved')`,
    [job.id, by.id]
  );
}

// Only the failed tasks go back to Pending; the rest stay Completed.
// `photo`: { key, contentType } of the inspector's photo in private storage, if one was sent.
async function markRejected(client, job, by, failed, failureReason, photo = null) {
  await client.query(
    `UPDATE cleaning_tasks
     SET status = 'Pending', start_time = NULL, end_time = NULL, failure_reason = $1, updated_at = now()
     WHERE job_id = $2 AND type = ANY($3)`,
    [failureReason, job.id, failed]
  );
  // Same inspector stays assigned; their task waits for the redo.
  await client.query(
    `UPDATE cleaning_tasks SET status = 'Pending', start_time = NULL, end_time = NULL, updated_at = now()
     WHERE job_id = $1 AND type = 'Inspection'`,
    [job.id]
  );
  await setJobStatus(client, job, 'Cleaning');
  await client.query(
    `INSERT INTO cleaning_inspections (job_id, ${by.column}, result, failed_tasks, failure_reason, photo_key, photo_content_type)
     VALUES ($1, $2, 'rejected', $3, $4, $5, $6)`,
    [job.id, by.id, failed, failureReason, photo ? photo.key : null, photo ? photo.contentType : null]
  );
}

function failedTaskList(failedTasks) {
  const failed = [...new Set(failedTasks)];
  if (failed.length === 0 || failed.some((t) => !CLEANING_TYPES.includes(t))) {
    throw new ApiError(400, 'failedTasks must list Bedding and/or Toiletry');
  }
  return failed;
}

// ----- The inspector, on their own inspection task -----

async function loadInspection(client, taskId, staffId) {
  const { job, task } = await loadOwnTask(client, taskId, staffId);
  if (task.type !== 'Inspection') throw new ApiError(400, 'Not an inspection task');
  if (job.status !== 'Inspection') throw new ApiError(409, 'Room is not ready for inspection yet');
  return { job, task };
}

async function approveInspection(taskId, staffId) {
  return withTransaction(async (client) => {
    const { job } = await loadInspection(client, taskId, staffId);
    await markApproved(client, job, byStaff(staffId));
    return job;
  });
}

/**
 * The inspector sends a room back. `photoFile` (optional): a photo of what is
 * wrong, as the upload gives it — { buffer, mimetype }. It goes to private
 * storage, and the housekeeper who redoes the work can open it.
 */
async function rejectInspection(taskId, staffId, failedTasks, failureReason, photoFile = null) {
  const failed = failedTaskList(failedTasks);
  let photo = null;
  try {
    return await withTransaction(async (client) => {
      const { job } = await loadInspection(client, taskId, staffId);
      if (photoFile) {
        photo = { key: newInspectionPhotoKey(job.id, photoFile.mimetype), contentType: photoFile.mimetype };
        await storage.put(photo.key, photoFile.buffer, photoFile.mimetype);
      }
      await markRejected(client, job, byStaff(staffId), failed, failureReason, photo);
      return job;
    });
  } catch (err) {
    // Don't leave a photo behind for a rejection that was never saved.
    if (photo) await storage.remove(photo.key).catch(() => {});
    throw err;
  }
}

/**
 * The photo that came with the latest "send back" of a task's room, for the
 * people working on that room: { photo_key, photo_content_type }.
 * Refused for staff who have no task on the job.
 */
async function rejectionPhoto(taskId, staffId) {
  const { rows } = await query(`SELECT job_id FROM cleaning_tasks WHERE id = $1`, [taskId]);
  if (rows.length === 0) throw new ApiError(404, 'Task not found');
  const jobId = rows[0].job_id;

  const { rows: mine } = await query(
    `SELECT 1 FROM cleaning_tasks WHERE job_id = $1 AND assigned_staff_id = $2 LIMIT 1`,
    [jobId, staffId]
  );
  if (mine.length === 0) throw new ApiError(403, 'You are not working on this room');

  const { rows: last } = await query(
    `SELECT photo_key, photo_content_type FROM cleaning_inspections
     WHERE job_id = $1 AND result = 'rejected'
     ORDER BY created_at DESC, id DESC LIMIT 1`,
    [jobId]
  );
  if (!last[0] || !last[0].photo_key) throw new ApiError(404, 'The inspector did not add a photo');
  return last[0];
}

// Deletes inspectors' photos of rooms that became Ready more than
// PHOTO_RETENTION_DAYS ago. Returns how many were deleted. Safe to repeat.
async function purgeOldInspectionPhotos() {
  const { rows } = await query(
    `SELECT ci.id, ci.photo_key FROM cleaning_inspections ci
     JOIN cleaning_jobs cj ON cj.id = ci.job_id
     WHERE ci.photo_key IS NOT NULL AND cj.status = 'Ready' AND cj.ready_at < now() - ($1 || ' days')::interval`,
    [String(PHOTO_RETENTION_DAYS)]
  );
  let purged = 0;
  for (const row of rows) {
    try {
      // eslint-disable-next-line no-await-in-loop -- a handful of files, one at a time
      await storage.remove(row.photo_key);
      // eslint-disable-next-line no-await-in-loop
      await query(`UPDATE cleaning_inspections SET photo_key = NULL, photo_content_type = NULL WHERE id = $1`, [row.id]);
      purged += 1;
    } catch (err) {
      console.error(`[jobs] could not delete the photo of cleaning inspection ${row.id}:`, err.message);
    }
  }
  return purged;
}

// ----- A manager or the front desk, in the inspector's place -----

// `actor`: { type: 'admin' | 'staff', id }, as deskAuth sets it.
const decidedBy = (actor) => (actor.type === 'admin' ? byAdmin(actor.id) : byStaff(actor.id));

// A stayover finishes by itself when both tasks are done, or is closed by the
// housekeeper at the door. There is nothing for anyone to approve or send back.
const NOT_INSPECTED = 'A stayover is not inspected: it finishes when both tasks are done';

/**
 * Approve a cleaned room when no inspector is around to. Cleaning must have
 * finished (the room is at Inspection) — unless `force`, which makes the room
 * Ready from any state: for a room marked dirty by mistake, or cleaned without
 * the app. Callers offer `force` to managers only.
 */
async function approveJob(jobId, actor, { force = false } = {}) {
  return withTransaction(async (client) => {
    const job = await lockJob(client, jobId);
    if (job.status === 'Ready') throw new ApiError(409, 'This room is already marked ready');
    if (job.reason === 'stayover') throw new ApiError(409, NOT_INSPECTED);
    if (job.status !== 'Inspection' && !force) {
      throw new ApiError(409, 'Cleaning has not finished in this room yet, so it cannot be approved');
    }
    await markApproved(client, job, decidedBy(actor));
    return job;
  });
}

async function rejectJob(jobId, actor, failedTasks, failureReason) {
  const failed = failedTaskList(failedTasks);
  return withTransaction(async (client) => {
    const job = await lockJob(client, jobId);
    if (job.reason === 'stayover') throw new ApiError(409, NOT_INSPECTED);
    if (job.status !== 'Inspection') throw new ApiError(409, 'Room is not ready for inspection yet');
    await markRejected(client, job, decidedBy(actor), failed, failureReason);
    return job;
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

// rejection_has_photo: the latest "send back" of the room named this task and
// came with a photo — the redo card then offers "See photo".
const TASK_SELECT = `
  SELECT ct.id, ct.job_id, ct.type, ct.status, ct.start_time, ct.end_time, ct.failure_reason,
         ct.assigned_staff_id, s.name AS assigned_staff_name,
         cj.priority, cj.status AS job_status, cj.reason AS job_reason, cj.source AS job_source,
         cj.notes AS job_notes, cj.job_date, cj.created_at AS job_created_at,
         ru.id AS room_unit_id, ru.unit_number, ru.floor, r.name AS room_type,
         COALESCE((
           SELECT ci.photo_key IS NOT NULL AND ct.type = ANY(ci.failed_tasks)
           FROM cleaning_inspections ci
           WHERE ci.job_id = cj.id AND ci.result = 'rejected'
           ORDER BY ci.created_at DESC, ci.id DESC LIMIT 1
         ), false) AS rejection_has_photo
  FROM cleaning_tasks ct
  JOIN cleaning_jobs cj ON cj.id = ct.job_id
  JOIN room_units ru ON ru.id = cj.room_unit_id
  JOIN rooms r ON r.id = ru.room_type_id
  LEFT JOIN staff s ON s.id = ct.assigned_staff_id`;

// A staff member's open tasks. Cleaners see what's left to do; inspectors
// also see rooms still being cleaned (as "waiting") so they can plan.
async function listTasksForStaff(staffId) {
  const { rows: tasks } = await query(
    `${TASK_SELECT}
     WHERE ct.assigned_staff_id = $1
       AND cj.status <> 'Ready'
       AND ct.status <> 'Completed'
     ORDER BY ${PRIORITY_ORDER_SQL}, ct.id ASC`,
    [staffId]
  );
  if (tasks.length === 0) return tasks;

  // Give inspectors the sibling cleaning tasks (who did it, when) for context.
  const jobIds = tasks.filter((t) => t.type === 'Inspection').map((t) => t.job_id);
  if (jobIds.length > 0) {
    const { rows: siblings } = await query(
      `${TASK_SELECT} WHERE ct.job_id = ANY($1) AND ct.type <> 'Inspection' ORDER BY ct.type`,
      [jobIds]
    );
    for (const t of tasks) {
      if (t.type === 'Inspection') t.cleaning_tasks = siblings.filter((s) => s.job_id === t.job_id);
    }
  }
  return tasks;
}

// Admin board: open jobs plus jobs finished today, each with its tasks (three
// for a full clean, two for a stayover). A stayover that was closed without
// being serviced carries closed_as, closed_note and closed_by_name.
async function listJobsForAdmin({ includeAll = false } = {}) {
  const today = await localToday();
  const { rows: jobs } = await query(
    `SELECT cj.*, ru.unit_number, ru.floor, r.name AS room_type, cb.name AS closed_by_name
     FROM cleaning_jobs cj
     JOIN room_units ru ON ru.id = cj.room_unit_id
     JOIN rooms r ON r.id = ru.room_type_id
     LEFT JOIN staff cb ON cb.id = cj.closed_by_staff_id
     WHERE $1::boolean OR cj.status <> 'Ready' OR (cj.ready_at AT TIME ZONE $2)::date = $3::date
     ORDER BY (cj.status = 'Ready') ASC, ${PRIORITY_ORDER_SQL}`,
    [includeAll, TIMEZONE, today]
  );
  if (jobs.length === 0) return jobs;

  const { rows: tasks } = await query(`${TASK_SELECT} WHERE ct.job_id = ANY($1)`, [jobs.map((j) => j.id)]);
  const { rows: lastInspections } = await query(
    `SELECT DISTINCT ON (job_id) job_id, result, failed_tasks, failure_reason, created_at,
            (photo_key IS NOT NULL) AS has_photo
     FROM cleaning_inspections WHERE job_id = ANY($1)
     ORDER BY job_id, created_at DESC, id DESC`,
    [jobs.map((j) => j.id)]
  );

  return jobs.map((j) => ({
    ...j,
    tasks: Object.fromEntries(tasks.filter((t) => t.job_id === j.id).map((t) => [t.type, t])),
    last_inspection: lastInspections.find((i) => i.job_id === j.id) || null,
  }));
}

// Staff ids with a task on this job — used to target realtime updates.
async function staffIdsForJob(jobId) {
  const { rows } = await query(
    `SELECT DISTINCT assigned_staff_id FROM cleaning_tasks WHERE job_id = $1 AND assigned_staff_id IS NOT NULL`,
    [jobId]
  );
  return rows.map((r) => r.assigned_staff_id);
}

module.exports = {
  PRIORITIES,
  CLEANING_TYPES,
  TASK_TYPES,
  STAFF_ROLES,
  SKIP_REASONS,
  TIMEZONE,
  STAYOVER_HOUR,
  CHECKOUT_HOUR,
  LATE_NOTE,
  markRoomDirty,
  createManualJob,
  createCheckoutJob,
  generateNightlyJobs,
  generateStayoverJobs,
  markLateCheckouts,
  dropUntouchedLateJob,
  assignStaff,
  setPriority,
  startTask,
  pauseTask,
  completeTask,
  skipStayover,
  approveInspection,
  rejectInspection,
  rejectionPhoto,
  purgeOldInspectionPhotos,
  approveJob,
  rejectJob,
  listTasksForStaff,
  listJobsForAdmin,
  staffIdsForJob,
};
