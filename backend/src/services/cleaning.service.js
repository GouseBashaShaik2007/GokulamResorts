/**
 * Housekeeping state machine. Every job/task transition goes through here so
 * the rules live in one place (controllers and the nightly cron both use it).
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
 * Transitions lock the job row (SELECT ... FOR UPDATE) so bedding and toiletry
 * completing at the same moment can't both miss the "both done" check.
 */
const { query, withTransaction } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const { TIMEZONE, localToday } = require('../utils/dates');

const PRIORITIES = ['VIP', 'High', 'Normal'];
const CLEANING_TYPES = ['Bedding', 'Toiletry'];
const TASK_TYPES = ['Bedding', 'Toiletry', 'Inspection'];
const STAFF_ROLES = ['FrontDesk', 'Bedding', 'Toiletry', 'Inspector'];
const ROLE_FOR_TASK = { Bedding: 'Bedding', Toiletry: 'Toiletry', Inspection: 'Inspector' };

// priority DESC, created_at ASC — used by every task/job list.
const PRIORITY_ORDER_SQL = `CASE cj.priority WHEN 'VIP' THEN 3 WHEN 'High' THEN 2 ELSE 1 END DESC, cj.created_at ASC`;

async function lockJob(client, jobId) {
  const { rows } = await client.query(`SELECT * FROM cleaning_jobs WHERE id = $1 FOR UPDATE`, [jobId]);
  if (rows.length === 0) throw new ApiError(404, 'Cleaning job not found');
  return rows[0];
}

async function setJobStatus(client, job, status, extra = '') {
  await client.query(
    `UPDATE cleaning_jobs SET status = $1, updated_at = now() ${extra} WHERE id = $2`,
    [status, job.id]
  );
  await client.query(`UPDATE room_units SET status = $1, updated_at = now() WHERE id = $2`, [
    status,
    job.room_unit_id,
  ]);
}

async function createTasks(client, jobId) {
  await client.query(
    `INSERT INTO cleaning_tasks (job_id, type) SELECT $1, unnest($2::text[])`,
    [jobId, TASK_TYPES]
  );
}

// ---------------------------------------------------------------------------
// Job creation
// ---------------------------------------------------------------------------

// Admin marks a room Dirty by hand.
async function createManualJob({ roomUnitId, priority = 'Normal', notes, adminId }) {
  return withTransaction(async (client) => {
    const { rows: units } = await client.query(
      `SELECT id FROM room_units WHERE id = $1 AND is_active = true FOR UPDATE`,
      [roomUnitId]
    );
    if (units.length === 0) throw new ApiError(404, 'Room not found');

    const today = await localToday(client);
    const { rows } = await client.query(
      `INSERT INTO cleaning_jobs (room_unit_id, job_date, source, reason, priority, notes, created_by)
       VALUES ($1, $2, 'manual', 'manual', $3, $4, $5)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [roomUnitId, today, priority, notes || null, adminId || null]
    );
    if (rows.length === 0) throw new ApiError(409, 'This room already has an open cleaning job');

    const job = rows[0];
    await createTasks(client, job.id);
    await setJobStatus(client, job, 'Dirty');
    return job;
  });
}

/**
 * Cleaning job for a checked-out stay. Called inside the check-out transaction
 * (source 'checkout') and by the nightly safety net (source 'nightly').
 * One job per stay (unique on booking_id). If the room already has an open
 * job (e.g. a manager marked it dirty), that job is linked to the stay instead
 * of creating a second one. Priority is High when the room has an arrival today.
 * Returns { job, created }.
 */
async function createCheckoutJob(client, booking, source) {
  const today = await localToday(client);
  const { rows: arrivals } = await client.query(
    `SELECT 1 FROM bookings WHERE room_unit_id = $1 AND id <> $2 AND status IN ('paid', 'confirmed') AND check_in = $3`,
    [booking.room_unit_id, booking.id, today]
  );
  const priority = arrivals.length > 0 ? 'High' : 'Normal';

  const { rows } = await client.query(
    `INSERT INTO cleaning_jobs (room_unit_id, booking_id, job_date, source, reason, priority)
     VALUES ($1, $2, $3, $4, 'checkout', $5)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [booking.room_unit_id, booking.id, today, source, priority]
  );
  if (rows.length > 0) {
    const job = rows[0];
    await createTasks(client, job.id);
    await setJobStatus(client, job, 'Dirty');
    return { job, created: true };
  }

  const { rows: linked } = await client.query(
    `UPDATE cleaning_jobs SET booking_id = $1, updated_at = now()
     WHERE room_unit_id = $2 AND status <> 'Ready' AND booking_id IS NULL
     RETURNING *`,
    [booking.id, booking.room_unit_id]
  );
  return { job: linked[0] || null, created: false };
}

/**
 * 11 PM safety net: any stay checked out in the last few days that has no
 * cleaning job (e.g. the check-out transaction's job insert was skipped)
 * gets one now. Returns the created jobs.
 */
async function generateNightlyJobs() {
  const day = await localToday();
  const { rows: missed } = await query(
    `SELECT b.id, b.room_unit_id FROM bookings b
     WHERE b.status = 'checked_out' AND b.checked_out_at > now() - interval '3 days'
       AND NOT EXISTS (SELECT 1 FROM cleaning_jobs cj WHERE cj.booking_id = b.id)
     ORDER BY b.checked_out_at`
  );
  const jobs = [];
  for (const booking of missed) {
    const { job, created } = await withTransaction((client) => createCheckoutJob(client, booking, 'nightly'));
    if (created) jobs.push(job);
  }
  return { date: day, jobs };
}

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------

/**
 * Assign staff to a job's tasks. `assignments` = { Bedding, Toiletry, Inspection }
 * with staff ids (any may be omitted). Completed tasks can't be reassigned.
 */
async function assignStaff(jobId, assignments) {
  return withTransaction(async (client) => {
    const job = await lockJob(client, jobId);
    if (job.status === 'Ready') throw new ApiError(409, 'This job is already finished');

    for (const type of TASK_TYPES) {
      const staffId = assignments[type];
      if (staffId === undefined) continue;

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

      const { rows: taskRows } = await client.query(
        `SELECT id, status, assigned_staff_id FROM cleaning_tasks WHERE job_id = $1 AND type = $2`,
        [jobId, type]
      );
      const task = taskRows[0];
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
  // A manager can mark a room ready before its tasks are done; nothing more happens on it then.
  if (job.status === 'Ready') throw new ApiError(409, 'This room is already marked ready');
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
      await setJobStatus(client, job, 'Inspection');
      await client.query(
        `UPDATE cleaning_tasks SET status = 'InProgress', start_time = now(), end_time = NULL, updated_at = now()
         WHERE job_id = $1 AND type = 'Inspection'`,
        [job.id]
      );
    }
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
async function markRejected(client, job, by, failed, failureReason) {
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
    `INSERT INTO cleaning_inspections (job_id, ${by.column}, result, failed_tasks, failure_reason)
     VALUES ($1, $2, 'rejected', $3, $4)`,
    [job.id, by.id, failed, failureReason]
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

async function rejectInspection(taskId, staffId, failedTasks, failureReason) {
  const failed = failedTaskList(failedTasks);
  return withTransaction(async (client) => {
    const { job } = await loadInspection(client, taskId, staffId);
    await markRejected(client, job, byStaff(staffId), failed, failureReason);
    return job;
  });
}

// ----- A manager or the front desk, in the inspector's place -----

// `actor`: { type: 'admin' | 'staff', id }, as deskAuth sets it.
const decidedBy = (actor) => (actor.type === 'admin' ? byAdmin(actor.id) : byStaff(actor.id));

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
    if (job.status !== 'Inspection') throw new ApiError(409, 'Room is not ready for inspection yet');
    await markRejected(client, job, decidedBy(actor), failed, failureReason);
    return job;
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

const TASK_SELECT = `
  SELECT ct.id, ct.job_id, ct.type, ct.status, ct.start_time, ct.end_time, ct.failure_reason,
         ct.assigned_staff_id, s.name AS assigned_staff_name,
         cj.priority, cj.status AS job_status, cj.reason AS job_reason, cj.notes AS job_notes,
         cj.job_date, cj.created_at AS job_created_at,
         ru.id AS room_unit_id, ru.unit_number, ru.floor, r.name AS room_type
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

// Admin board: open jobs plus jobs finished today, each with its three tasks.
async function listJobsForAdmin({ includeAll = false } = {}) {
  const today = await localToday();
  const { rows: jobs } = await query(
    `SELECT cj.*, ru.unit_number, ru.floor, r.name AS room_type
     FROM cleaning_jobs cj
     JOIN room_units ru ON ru.id = cj.room_unit_id
     JOIN rooms r ON r.id = ru.room_type_id
     WHERE $1::boolean OR cj.status <> 'Ready' OR (cj.ready_at AT TIME ZONE $2)::date = $3::date
     ORDER BY (cj.status = 'Ready') ASC, ${PRIORITY_ORDER_SQL}`,
    [includeAll, TIMEZONE, today]
  );
  if (jobs.length === 0) return jobs;

  const { rows: tasks } = await query(`${TASK_SELECT} WHERE ct.job_id = ANY($1)`, [jobs.map((j) => j.id)]);
  const { rows: lastInspections } = await query(
    `SELECT DISTINCT ON (job_id) job_id, result, failed_tasks, failure_reason, created_at
     FROM cleaning_inspections WHERE job_id = ANY($1)
     ORDER BY job_id, created_at DESC`,
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
  TIMEZONE,
  createManualJob,
  createCheckoutJob,
  generateNightlyJobs,
  assignStaff,
  setPriority,
  startTask,
  pauseTask,
  completeTask,
  approveInspection,
  rejectInspection,
  approveJob,
  rejectJob,
  listTasksForStaff,
  listJobsForAdmin,
  staffIdsForJob,
};
