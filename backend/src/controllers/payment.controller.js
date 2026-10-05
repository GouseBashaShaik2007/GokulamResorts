const { query } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const asyncHandler = require('../utils/asyncHandler');
const gateway = require('../services/gateway.service');
const bookings = require('../services/booking.service');
const storage = require('../services/storage.service');
const checkouts = require('./checkout.controller');
const foodOrders = require('../services/foodOrders.service');

// POST /api/create-order — { bookingId, phone }
// Razorpay order for a booking that is holding its room (pending_payment).
const createOrder = asyncHandler(async (req, res) => {
  const order = await bookings.createOnlineOrder(Number(req.body.bookingId), req.body.phone);
  res.json({ success: true, ...order });
});

// POST /api/verify-payment
// Body: { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
//
// Razorpay's checkout success callback happens client-side and can be spoofed,
// so we recompute the HMAC-SHA256 signature from order_id + payment_id with our
// secret and compare in constant time. Only then is the payment recorded. The
// booking becomes 'paid' and waits for the manager — it is NOT confirmed yet.
const verifyPayment = asyncHandler(async (req, res) => {
  const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!gateway.verifyCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    await query(`UPDATE payments SET status = 'failed', updated_at = now() WHERE razorpay_order_id = $1 AND status = 'created'`, [
      razorpay_order_id,
    ]);
    throw new ApiError(400, 'Payment verification failed: invalid signature');
  }

  const { rows } = await query(`SELECT booking_id FROM payments WHERE razorpay_order_id = $1`, [razorpay_order_id]);
  if (!rows[0] || rows[0].booking_id !== Number(bookingId)) throw new ApiError(400, 'Order does not match this booking');

  const booking = await bookings.markOnlinePaid({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
    via: 'checkout',
  });

  res.json({
    success: true,
    message:
      booking.status === 'paid'
        ? 'Payment received. Your booking is waiting for confirmation from the resort.'
        : 'Payment received after the booking expired. It has been refunded in full.',
    bookingId: booking.id,
    status: booking.status,
  });
});

// POST /api/razorpay/webhook
// Configure in the Razorpay dashboard with events payment.captured,
// refund.processed and refund.failed, and set RAZORPAY_WEBHOOK_SECRET.
// Covers guests who pay but close the browser before verify-payment runs,
// and tracks refunds to completion.
const webhook = asyncHandler(async (req, res) => {
  if (!gateway.verifyWebhookSignature(req.rawBody, req.headers['x-razorpay-signature'])) {
    throw new ApiError(400, 'Invalid webhook signature');
  }
  const { event, payload } = req.body;

  if (event === 'payment.captured') {
    const p = payload.payment.entity;
    const { rows } = await query(`SELECT 1 FROM payments WHERE razorpay_order_id = $1`, [p.order_id]);
    if (rows.length > 0) {
      await bookings.markOnlinePaid({ orderId: p.order_id, paymentId: p.id, via: 'webhook' });
    } else {
      // Not a booking: a food order paid online, from the kiosk or a room (ignored if it is neither).
      await checkouts.settle({ gatewayOrderId: p.order_id, paymentId: p.id, via: 'webhook' });
    }
  } else if (event === 'refund.processed' || event === 'refund.failed') {
    const outcome = event === 'refund.processed' ? 'processed' : 'failed';
    await bookings.applyRefundWebhook(payload.refund.entity.id, outcome);
    await foodOrders.applyRefundOutcome(payload.refund.entity.id, outcome);
  }
  res.json({ success: true });
});

// GET /api/documents/file?token= — local storage driver only (development).
// The token is a 60-second link issued to a manager by /admin/documents/:id/url.
const documentFile = asyncHandler(async (req, res) => {
  if (storage.DRIVER !== 'local') throw new ApiError(404, 'Not found');
  let file;
  try {
    file = await storage.readLocal(String(req.query.token || ''));
  } catch (err) {
    throw new ApiError(403, 'This document link has expired');
  }
  res.set({ 'Content-Type': file.contentType, 'Cache-Control': 'no-store', 'Content-Disposition': 'inline' });
  res.send(file.buffer);
});

module.exports = { createOrder, verifyPayment, webhook, documentFile };
