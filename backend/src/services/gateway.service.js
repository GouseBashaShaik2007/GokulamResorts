/**
 * Razorpay wrapper with a mock mode for development.
 *
 * RAZORPAY_MODE=live  real orders, signature checks and refunds (needs keys).
 * RAZORPAY_MODE=mock  fake order ids, any signature accepted for mock orders,
 *                     refunds succeed instantly. Refused when NODE_ENV=production.
 * Unset: live if real-looking keys are configured, otherwise mock.
 */
const crypto = require('crypto');

const KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const hasRealKeys = /^rzp_(test|live)_/.test(KEY_ID) && !/x{6,}/i.test(KEY_ID) && KEY_SECRET && !/x{6,}/i.test(KEY_SECRET);
const MODE = process.env.RAZORPAY_MODE || (hasRealKeys ? 'live' : 'mock');

if (MODE === 'mock' && process.env.NODE_ENV === 'production') {
  throw new Error('RAZORPAY_MODE=mock is not allowed in production. Configure real Razorpay keys.');
}
if (MODE === 'mock') {
  console.warn('[payments] Razorpay MOCK mode — no real money moves. Set real keys to go live.');
}

let client = null;
function razorpay() {
  if (!client) {
    const Razorpay = require('razorpay');
    client = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
  }
  return client;
}

const isMock = () => MODE === 'mock';
const toPaise = (inr) => Math.round(Number(inr) * 100);

async function createOrder({ amount, receipt, notes }) {
  if (isMock()) {
    return { id: `order_mock_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, amount: toPaise(amount), currency: 'INR' };
  }
  return razorpay().orders.create({ amount: toPaise(amount), currency: 'INR', receipt, notes });
}

// Checkout success callback signature: HMAC_SHA256(order_id|payment_id, key_secret).
function verifyCheckoutSignature(orderId, paymentId, signature) {
  if (isMock()) return orderId.startsWith('order_mock_');
  return safeEqualHex(
    crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex'),
    signature
  );
}

// Webhook signature: HMAC_SHA256(raw body, webhook secret).
function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !rawBody) return false;
  return safeEqualHex(crypto.createHmac('sha256', secret).update(rawBody).digest('hex'), signature);
}

function safeEqualHex(expected, received) {
  const a = Buffer.from(String(expected), 'utf8');
  const b = Buffer.from(String(received || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Refund part or all of a captured payment. Returns { id, status: 'pending' | 'processed' }. */
async function refundPayment(razorpayPaymentId, amount, notes) {
  if (isMock()) {
    return { id: `rfnd_mock_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, status: 'processed' };
  }
  const refund = await razorpay().payments.refund(razorpayPaymentId, { amount: toPaise(amount), speed: 'normal', notes });
  return { id: refund.id, status: refund.status === 'processed' ? 'processed' : 'pending' };
}

module.exports = {
  MODE,
  isMock,
  publicKeyId: () => (isMock() ? 'mock' : KEY_ID),
  createOrder,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  refundPayment,
};
