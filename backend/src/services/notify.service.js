/**
 * Guest messages over SMS (primary), WhatsApp and email (backup).
 *
 * Messages are written to the `notifications` outbox inside the same
 * transaction as the booking change, then delivered after commit by flush()
 * (also retried every minute by the scheduler). A booking change can therefore
 * never be lost because a provider was down, and nothing is sent for a change
 * that rolled back.
 *
 * Delivery: NOTIFY_DRIVER=log (default) records messages as 'logged' and prints
 * them; no provider is wired yet. To go live, add a driver below — e.g. MSG91 or
 * Gupshup for SMS (Indian SMS needs DLT-registered templates) and the WhatsApp
 * Business API (pre-approved templates) — and set NOTIFY_DRIVER to its name.
 */
const { query } = require('../db/pool');

const SITE = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim();
const inr = (n) => `Rs ${Number(n).toLocaleString('en-IN')}`;

// Plain text, short enough for one SMS where possible.
const TEMPLATES = {
  booking_received: (b) =>
    `Gokulam Resorts: payment of ${inr(b.amount_paid)} received for booking ${b.reference} (Room ${b.unit_number}, ${b.check_in} to ${b.check_out}). Our manager will confirm within 24 hours. Status: ${SITE}/booking/status?ref=${b.reference}`,
  booking_confirmed: (b) =>
    `Gokulam Resorts: booking ${b.reference} is CONFIRMED. Room ${b.unit_number}, ${b.check_in} to ${b.check_out}. Please carry a photo ID for every adult guest.`,
  booking_rejected: (b, x) =>
    `Gokulam Resorts: sorry, we could not confirm booking ${b.reference}. ${refundLine(x)}`,
  booking_cancelled: (b, x) =>
    `Gokulam Resorts: booking ${b.reference} has been cancelled. ${refundLine(x)}`,
  booking_expired: (b, x) =>
    `Gokulam Resorts: booking ${b.reference} could not be confirmed in time and has been cancelled. ${refundLine(x)}`,
  refund_issued: (b, x) =>
    `Gokulam Resorts: a refund of ${inr(x.refund)} for booking ${b.reference} has been initiated. ${x.reason ? `Reason: ${x.reason}.` : ''}`,
  stay_extended: (b, x) =>
    `Gokulam Resorts: your stay in Room ${b.unit_number} is extended to ${b.check_out}.${x.balance > 0 ? ` Balance due: ${inr(x.balance)}.` : ''}`,
  checked_out: (b) =>
    `Thank you for staying at Gokulam Resorts, ${b.guest_name.split(' ')[0]}! We hope to welcome you back to Chirala Beach soon.`,
};

function refundLine(x = {}) {
  if (!x.refund) return '';
  return x.offline
    ? `A refund of ${inr(x.refund)} will be paid at the resort counter.`
    : `A full refund of ${inr(x.refund)} has been initiated to your original payment method (5-7 working days).`;
}

/**
 * Queue a message on every channel we have an address for.
 * `booking` needs id, guest_name, guest_phone, guest_email, unit_number, dates, amount_paid.
 */
async function enqueue(client, booking, template, extra = {}) {
  const body = TEMPLATES[template](booking, extra);
  const targets = [
    ['sms', booking.guest_phone],
    ['whatsapp', booking.guest_phone],
    ['email', booking.guest_email],
  ].filter(([, to]) => to);

  for (const [channel, recipient] of targets) {
    await client.query(
      `INSERT INTO notifications (booking_id, channel, recipient, template, body) VALUES ($1, $2, $3, $4, $5)`,
      [booking.id, channel, recipient, template, body]
    );
  }
}

const DRIVERS = {
  // Records the message without sending it. Replace per channel when a provider is chosen.
  log: async (n) => {
    console.log(`[notify:${n.channel}] -> ${n.recipient}: ${n.body}`);
    return { status: 'logged', provider: 'log' };
  },
};

let flushing = false;
async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    const driver = DRIVERS[process.env.NOTIFY_DRIVER || 'log'] || DRIVERS.log;
    const { rows } = await query(`SELECT * FROM notifications WHERE status = 'queued' ORDER BY id LIMIT 100`);
    for (const n of rows) {
      try {
        const result = await driver(n);
        await query(`UPDATE notifications SET status = $1, provider = $2, sent_at = now() WHERE id = $3`, [
          result.status,
          result.provider,
          n.id,
        ]);
      } catch (err) {
        await query(`UPDATE notifications SET status = 'failed', error = $1 WHERE id = $2`, [err.message, n.id]);
      }
    }
  } catch (err) {
    console.error('[notify] flush failed:', err.message);
  } finally {
    flushing = false;
  }
}

module.exports = { enqueue, flush, TEMPLATES };
