// Append-only record of who did what to a booking (or system-wide).
// actor = { type: 'admin' | 'staff' | 'guest' | 'system', id }
async function audit(client, { bookingId = null, actor, action, details = {} }) {
  await client.query(
    `INSERT INTO audit_log (booking_id, actor_type, actor_id, action, details) VALUES ($1, $2, $3, $4, $5)`,
    [bookingId, actor.type, actor.id || null, action, details]
  );
}

const SYSTEM = { type: 'system', id: null };
const GUEST = { type: 'guest', id: null };

module.exports = { audit, SYSTEM, GUEST };
