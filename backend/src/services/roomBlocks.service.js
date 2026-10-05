/**
 * Rooms taken out of order: a broken AC, a leak, repainting. A block covers
 * the nights [start_date, end_date) of one room; end_date NULL means "until
 * someone puts it back". On a blocked night the room is not offered, cannot
 * be booked and cannot be checked into.
 *
 * Bookings already in the room are left alone — the desk moves them to another
 * room (booking.service's moveBooking). `affected` lists the ones that need it.
 */
const { query, withTransaction } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const { localToday } = require('../utils/dates');

// Lazily required: booking.service requires this file.
const liveStatuses = () => require('./booking.service').BLOCKING;

/**
 * SQL for use inside another query: is this room out of order on any night of
 * [from, to)? e.g. `AND NOT ${blockedSql('ru.id', '$1', '$2')}`.
 */
const blockedSql = (unit, from, to) => `EXISTS (
         SELECT 1 FROM room_blocks rb
         WHERE rb.room_unit_id = ${unit}
           AND daterange(rb.start_date, rb.end_date) && daterange(${from}::date, ${to}::date)
       )`;

/** The first block on a room that touches the nights [from, to), or null. */
async function findBlock(client, roomUnitId, from, to) {
  const { rows } = await client.query(
    `SELECT id, start_date, end_date, reason FROM room_blocks
     WHERE room_unit_id = $1 AND daterange(start_date, end_date) && daterange($2::date, $3::date)
     ORDER BY start_date LIMIT 1`,
    [roomUnitId, from, to]
  );
  return rows[0] || null;
}

/** For staff: which room, until when, and why. `unit`: { unit_number }. */
const outOfOrderMessage = (unit, block) =>
  `Room ${unit.unit_number} is out of order ${block.end_date ? `until ${block.end_date}` : 'until further notice'}: ${block.reason}.`;

/** Refuses (409) when the room is out of order on any night of [from, to). `unit`: { id, unit_number }. */
async function assertNotBlocked(client, unit, from, to, hint = 'Choose another room.') {
  const block = await findBlock(client, unit.id, from, to);
  if (block) throw new ApiError(409, `${outOfOrderMessage(unit, block)} ${hint}`);
}

const BLOCK_SELECT = `
  SELECT rb.id, rb.room_unit_id, ru.unit_number, rb.start_date, rb.end_date, rb.reason, rb.room_issue_id,
         rb.created_at, rb.ended_at, COALESCE(s.name, a.name) AS created_by
  FROM room_blocks rb
  JOIN room_units ru ON ru.id = rb.room_unit_id
  LEFT JOIN staff s ON s.id = rb.created_by_staff_id
  LEFT JOIN admins a ON a.id = rb.created_by_admin_id`;

// Live bookings in the block's room on its nights: the ones that need another room.
async function affectedBookings(client, block) {
  const { rows } = await client.query(
    `SELECT b.id, b.reference, b.guest_name, b.status, b.check_in, b.check_out
     FROM bookings b
     WHERE b.room_unit_id = $1 AND b.status = ANY($2)
       AND NOT (b.status = 'pending_payment' AND b.hold_expires_at < now())
       AND daterange(b.check_in, b.check_out) && daterange($3::date, $4::date)
     ORDER BY b.check_in, b.id`,
    [block.room_unit_id, liveStatuses(), block.start_date, block.end_date]
  );
  return rows;
}

// `actor`: { type: 'admin' | 'staff', id }, as deskAuth sets it.
const by = (actor) => (actor.type === 'staff' ? [actor.id, null] : [null, actor.id]);

/**
 * Take a room out of order from startDate (default: today) until endDate —
 * the day it is back; left out, until further notice. roomIssueId links the
 * housekeeping report it came from. Returns { block, affected }.
 */
async function create({ roomUnitId, startDate = null, endDate = null, reason, roomIssueId = null }, actor) {
  return withTransaction(async (client) => {
    // Locking the room puts a booking being made for it this instant on one side or the other.
    const { rows: units } = await client.query(
      `SELECT id, unit_number FROM room_units WHERE id = $1 AND is_active FOR UPDATE`,
      [roomUnitId]
    );
    const unit = units[0];
    if (!unit) throw new ApiError(404, 'Room not found');

    const today = await localToday(client);
    const from = startDate || today;
    if (from < today) throw new ApiError(400, 'A room cannot be taken out of order from a past date');
    if (endDate && endDate <= from) throw new ApiError(400, 'The day the room is back must be after the day it goes out');

    if (roomIssueId) {
      const { rows: issues } = await client.query(`SELECT room_unit_id FROM room_issues WHERE id = $1`, [roomIssueId]);
      if (issues.length === 0 || issues[0].room_unit_id !== unit.id) {
        throw new ApiError(400, `That report is not about room ${unit.unit_number}`);
      }
    }

    await client.query('SAVEPOINT block_guard');
    let id;
    try {
      const { rows } = await client.query(
        `INSERT INTO room_blocks (room_unit_id, start_date, end_date, reason, room_issue_id, created_by_staff_id, created_by_admin_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [unit.id, from, endDate, reason, roomIssueId, ...by(actor)]
      );
      id = rows[0].id;
      await client.query('RELEASE SAVEPOINT block_guard');
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT block_guard');
      if (err.code === '23P01') throw new ApiError(409, `Room ${unit.unit_number} is already out of order on those dates`);
      throw err;
    }

    const { rows } = await client.query(`${BLOCK_SELECT} WHERE rb.id = $1`, [id]);
    return { block: rows[0], affected: await affectedBookings(client, rows[0]) };
  });
}

/** Put a room back in service from today (a block that has not started yet is called off). */
async function end(blockId, actor) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(`${BLOCK_SELECT} WHERE rb.id = $1 FOR UPDATE OF rb`, [blockId]);
    const block = rows[0];
    if (!block) throw new ApiError(404, 'Not found');

    const today = await localToday(client);
    if (block.end_date && block.end_date <= today) {
      throw new ApiError(409, `Room ${block.unit_number} is already back in service`);
    }
    // Under way: it ends today. Not started: it ends where it starts, and covers no night at all.
    const endDate = block.start_date > today ? block.start_date : today;
    await client.query(
      `UPDATE room_blocks SET end_date = $1, ended_at = now(), ended_by_staff_id = $2, ended_by_admin_id = $3 WHERE id = $4`,
      [endDate, ...by(actor), block.id]
    );
    return { ...block, end_date: endDate };
  });
}

/**
 * Blocks touching the days `from`..`to` (both included), each with the
 * bookings that need moving. Without `to`: everything not yet over.
 */
async function list({ from = null, to = null } = {}) {
  const { rows } = await query(
    `${BLOCK_SELECT}
     WHERE (rb.end_date IS NULL OR rb.end_date > rb.start_date)
       AND daterange(rb.start_date, rb.end_date) && daterange($1::date, $2::date + 1)
     ORDER BY rb.start_date, ru.unit_number`,
    [from || (await localToday()), to]
  );
  for (const block of rows) {
    // eslint-disable-next-line no-await-in-loop -- a handful of blocks at most
    block.affected = await affectedBookings({ query }, block);
  }
  return rows;
}

module.exports = { blockedSql, findBlock, outOfOrderMessage, assertNotBlocked, create, end, list };
