'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from './api';
import { loadRazorpayScript } from './loadRazorpay';
import { errMsg } from './bookingUi';

// Remember the phone for this booking in this tab so the confirmation page can
// look it up without asking again (the status API needs booking reference + phone).
export const rememberBooking = (reference, phone) => {
  try {
    window.sessionStorage.setItem(`gokulam_booking_${reference}`, phone);
  } catch {
    // storage blocked — the confirmation page will ask for the phone instead
  }
};

/**
 * The payment-side API calls extracted from the old single-page BookingForm,
 * unchanged in behavior — same endpoints, same request/response shapes, same
 * mock-mode fallback — so the slide-over's PayStep can call them from
 * whichever point in the flow the guest is resuming from.
 *
 * Returns one stable object: BookingContext lists it in dependency arrays, and
 * a new object every render would rebuild its callbacks (and re-render every
 * consumer) on each keystroke.
 */
export function useBookingCheckout() {
  const router = useRouter();

  return useMemo(() => {
    // STEP 1 + 2 — hold the room, then create the Razorpay order for it.
    async function createHoldAndOrder({ roomUnitId, checkIn, checkOut, adults, children, guest }) {
      const bookingRes = await api.post('/book-room', {
        roomUnitId,
        checkIn,
        checkOut,
        adults: Number(adults),
        children: Number(children),
        ...guest,
      });
      const { bookingId, reference, holdExpiresAt } = bookingRes.data;
      rememberBooking(reference, guest.phone);

      const orderRes = await api.post('/create-order', { bookingId, phone: guest.phone });
      const { orderId, amount, currency, keyId, mock } = orderRes.data;

      return { bookingId, reference, holdExpiresAt, orderId, amount, currency, keyId, mock };
    }

    // STEP 3 — open Razorpay Checkout for an already-created order (fresh or resumed).
    function openRazorpayCheckout({ order, description, guest, onSuccess, onDismiss, onFail, onVerifyError }) {
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Gokulam Resorts',
        description,
        order_id: order.orderId,
        prefill: { name: guest.name, email: guest.email, contact: guest.phone },
        theme: { color: '#0E4F5C' },
        handler: async (response) => {
          try {
            // STEP 4 — server verifies the signature; booking becomes "paid, awaiting approval"
            await api.post('/verify-payment', {
              bookingId: order.bookingId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            onSuccess();
            router.push(`/booking/confirmation?ref=${order.reference}`);
          } catch (err) {
            onVerifyError(errMsg(err, 'Payment verification failed. If an amount was deducted, it will be refunded automatically.'));
          }
        },
        modal: { ondismiss: onDismiss },
      });

      rzp.on('payment.failed', (resp) => {
        onFail(resp?.error?.description || 'Payment failed. Please try again.');
      });

      rzp.open();
    }

    async function ensureRazorpayLoaded() {
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        throw new Error('Unable to load Razorpay checkout. Please check your connection and try again.');
      }
    }

    async function confirmMockPayment({ bookingId, reference, orderId }) {
      await api.post('/verify-payment', {
        bookingId,
        razorpay_order_id: orderId,
        razorpay_payment_id: `pay_mock_${bookingId}_${Date.now()}`,
        razorpay_signature: 'mock_signature',
      });
      router.push(`/booking/confirmation?ref=${reference}`);
    }

    return { createHoldAndOrder, openRazorpayCheckout, ensureRazorpayLoaded, confirmMockPayment };
  }, [router]);
}
