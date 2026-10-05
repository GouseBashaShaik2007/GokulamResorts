const { query } = require('../db/pool');

/**
 * Record a "who did what" entry. Never throws into the caller's request —
 * a logging failure shouldn't fail the action it's logging, so errors are
 * swallowed after being logged to the console.
 *
 * @param {object} entry
 * @param {'admin'|'staff'|'kitchen'|'guest'|'system'} entry.actorType
 * @param {number|null} [entry.actorId]
 * @param {string} entry.action - short machine-readable verb, e.g. 'kitchen_order_status_change'
 * @param {object} [entry.details] - free-form JSON context (order id, from/to status, etc.)
 * @param {number} [entry.bookingId] - only set when the action relates to a booking
 */
async function logAction({ actorType, actorId = null, action, details = {}, bookingId = null }) {
  try {
    await query(
      `INSERT INTO audit_log (booking_id, actor_type, actor_id, action, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [bookingId, actorType, actorId, action, JSON.stringify(details)]
    );
  } catch (err) {
    console.error('audit log write failed:', err.message, { actorType, actorId, action });
  }
}

module.exports = { logAction };
