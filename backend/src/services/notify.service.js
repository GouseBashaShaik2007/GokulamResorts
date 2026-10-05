/**
 * Guest messages: about a booking, and about a food order.
 *
 * SMS comes first. WhatsApp and email can be added per message by listing
 * them in NOTIFY_CHANNELS (e.g. "sms,email"); the default is SMS alone.
 *
 * Messages are written to the `notifications` outbox inside the same
 * transaction as the change they are about, then delivered after commit by
 * flush() (also retried every minute by the scheduler). A change can therefore
 * never be lost because a provider was down, and nothing is sent for a change
 * that rolled back.
 *
 * Delivery: NOTIFY_DRIVER=log (default) records messages as 'logged' and prints
 * them; no provider is wired yet. To go live, add a driver below — e.g. MSG91 or
 * Gupshup for SMS (Indian SMS needs DLT-registered templates, and the text sent
 * must match the registered wording) — and set NOTIFY_DRIVER to its name.
 */
const { query } = require('../db/pool');

const SITE = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim();
const inr = (n) => `Rs ${Number(n).toLocaleString('en-IN')}`;

const ALL_CHANNELS = ['sms', 'whatsapp', 'email'];
const CHANNELS = (process.env.NOTIFY_CHANNELS || 'sms')
  .split(',')
  .map((c) => c.trim().toLowerCase())
  .filter((c) => ALL_CHANNELS.includes(c));

// Plain text, short enough for one SMS where possible. A guest is not told a
// room number before they arrive: the front desk gives the room at check-in.
const TEMPLATES = {
  // `x.paid`: the booking was just paid for online.
  booking_confirmed: (b, x = {}) =>
    `Gokulam Resorts: ${x.paid ? `payment of ${inr(b.amount_paid)} received. ` : ''}Booking ${b.reference} is CONFIRMED: ${b.room_type}, ${b.check_in} to ${b.check_out}. Please carry a photo ID for every adult guest.${x.paid ? ` Details: ${SITE}/booking/status?ref=${b.reference}` : ''}`,
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

// Where a food order is going, as the guest would say it.
function orderPlace(o) {
  if (o.room_number) return `Room ${o.room_number}`;
  if (o.table_number) return `Table ${o.table_number}`;
  return 'the counter';
}

// `o`: a food_orders row (id, total_amount, public_token, table_number, room_number, paid_at).
const ORDER_TEMPLATES = {
  order_placed: (o) =>
    `Gokulam Resorts: order #${o.id} received${o.paid_at ? `, ${inr(o.total_amount)} paid` : ''}. Follow it here: ${SITE}/order/track/${o.public_token}`,
  order_ready: (o) =>
    o.room_number
      ? `Gokulam Resorts: order #${o.id} is on its way to Room ${o.room_number}.`
      : o.table_number
        ? `Gokulam Resorts: order #${o.id} is ready and is being brought to Table ${o.table_number}.`
        : `Gokulam Resorts: order #${o.id} is ready. Please collect it at ${orderPlace(o)}.`,
  // `x.refund`: the amount going back, when the order had been paid online.
  // `x.refundFailed`: it was paid online and the refund could not be started.
  order_cancelled: (o, x = {}) =>
    `Gokulam Resorts: order #${o.id} has been cancelled.${
      x.refund
        ? ` ${inr(x.refund)} is being refunded to the way you paid.`
        : x.refundFailed
          ? ' Please speak to our staff about your payment: it will be returned to you.'
          : ''
    }`,
};

async function queue(client, { bookingId = null, foodOrderId = null }, targets, template, body) {
  for (const [channel, recipient] of targets) {
    if (!recipient || !CHANNELS.includes(channel)) continue;
    await client.query(
      `INSERT INTO notifications (booking_id, food_order_id, channel, recipient, template, body) VALUES ($1, $2, $3, $4, $5, $6)`,
      [bookingId, foodOrderId, channel, recipient, template, body]
    );
  }
}

/**
 * Queue a message about a booking on every channel in use that we have an
 * address for. `booking` needs id, reference, guest_name, guest_phone,
 * guest_email, room_type, unit_number, dates, amount_paid.
 */
async function enqueue(client, booking, template, extra = {}) {
  const body = TEMPLATES[template](booking, extra);
  await queue(
    client,
    { bookingId: booking.id },
    [
      ['sms', booking.guest_phone],
      ['whatsapp', booking.guest_phone],
      ['email', booking.guest_email],
    ],
    template,
    body
  );
}

/**
 * Queue a message about a food order, if the guest left a phone number
 * (nothing happens otherwise). `client`: a transaction client, or anything
 * with query(). `order`: the food_orders row — id, customer_phone,
 * total_amount, public_token, table_number, room_number, paid_at.
 * `template`: 'order_placed' | 'order_ready' | 'order_cancelled'.
 * Call flush() once the change is committed.
 */
async function enqueueOrder(client, order, template, extra = {}) {
  if (!order?.customer_phone) return;
  const body = ORDER_TEMPLATES[template](order, extra);
  await queue(
    client,
    { foodOrderId: order.id },
    [
      ['sms', order.customer_phone],
      ['whatsapp', order.customer_phone],
    ],
    template,
    body
  );
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

module.exports = { enqueue, enqueueOrder, flush, TEMPLATES, ORDER_TEMPLATES, CHANNELS };
