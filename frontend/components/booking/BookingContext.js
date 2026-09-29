'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useBookingCheckout } from '../../lib/useBookingCheckout';
import { errMsg } from '../../lib/bookingUi';

const BookingCtx = createContext(null);

const emptyStay = { checkIn: '', checkOut: '', adults: 1, children: 0 };
const emptyGuest = { name: '', email: '', phone: '', specialRequests: '' };

function loadPersistedStay() {
  if (typeof window === 'undefined') return emptyStay;
  try {
    const raw = window.sessionStorage.getItem('gokulam_booking_stay');
    return raw ? { ...emptyStay, ...JSON.parse(raw) } : emptyStay;
  } catch {
    return emptyStay;
  }
}

export function BookingProvider({ children }) {
  const checkout = useBookingCheckout();

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState('stay'); // 'stay' | 'room' | 'guest' | 'pay'
  const [stay, setStayState] = useState(emptyStay);
  const [roomTypeFilter, setRoomTypeFilter] = useState(null);
  const [pick, setPick] = useState(null);
  const [guest, setGuestState] = useState(emptyGuest);
  const [hold, setHold] = useState(null); // {bookingId, holdExpiresAt, orderId, amount, currency, keyId, mock}
  const [status, setStatus] = useState('idle'); // idle | booking | paying | error
  const [error, setError] = useState('');

  useEffect(() => setStayState(loadPersistedStay()), []);

  const persistStay = useCallback((next) => {
    try {
      window.sessionStorage.setItem('gokulam_booking_stay', JSON.stringify(next));
    } catch {
      // ignore — non-essential convenience
    }
  }, []);

  const setStay = useCallback(
    (partial) => {
      setStayState((s) => {
        const next = typeof partial === 'function' ? partial(s) : { ...s, ...partial };
        persistStay(next);
        return next;
      });
      // Dates/guests changed — any previously picked unit no longer applies.
      setPick(null);
    },
    [persistStay]
  );

  const setGuest = useCallback((partial) => {
    setGuestState((g) => (typeof partial === 'function' ? partial(g) : { ...g, ...partial }));
  }, []);

  const goTo = useCallback((nextStep) => {
    setError('');
    setStep(nextStep);
  }, []);

  const datesValid = !!(stay.checkIn && stay.checkOut && stay.checkOut > stay.checkIn);

  const openBooking = useCallback(
    (prefill = {}) => {
      setError('');
      if (prefill.roomTypeId) setRoomTypeFilter(prefill.roomTypeId);

      if (hold) {
        // A hold from earlier in this session is still live — resume there
        // instead of losing it and double-booking a second room.
        setStep('pay');
      } else if (datesValid) {
        setStep('room');
      } else {
        setStep('stay');
      }
      setIsOpen(true);
    },
    [hold, datesValid]
  );

  const close = useCallback(() => setIsOpen(false), []);

  const reset = useCallback(() => {
    setHold(null);
    setPick(null);
    setGuestState(emptyGuest);
    setRoomTypeFilter(null);
    setStatus('idle');
    setError('');
    setStep('stay');
    setIsOpen(false);
  }, []);

  // Room + order creation, then either the mock confirm UI or a live
  // Razorpay checkout — same two calls, same order, as the old BookingForm.
  const submitAndPay = useCallback(async () => {
    if (!pick) {
      setError('Please choose a room number.');
      return;
    }
    setError('');
    setStatus('booking');
    try {
      const order = await checkout.createHoldAndOrder({
        roomUnitId: pick.unit.id,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        adults: stay.adults,
        children: stay.children,
        guest,
      });
      setHold(order);
      setStep('pay');

      if (order.mock) {
        setStatus('idle');
        return;
      }

      await checkout.ensureRazorpayLoaded();
      setStatus('paying');
      checkout.openRazorpayCheckout({
        order,
        description: `Room ${pick.unit.unitNumber} · ${stay.checkIn} to ${stay.checkOut}`,
        guest,
        onSuccess: () => reset(),
        onDismiss: () => setStatus('idle'),
        onFail: (msg) => {
          setStatus('error');
          setError(msg);
        },
        onVerifyError: (msg) => {
          setStatus('error');
          setError(msg);
        },
      });
    } catch (err) {
      setStatus('error');
      setError(errMsg(err, err.message || 'Something went wrong. Please try again.'));
      if (err?.response?.status === 409) {
        // Someone else took the room — send the guest back to pick again.
        setPick(null);
        setStep('room');
      }
    }
  }, [pick, stay, guest, checkout, reset]);

  // Re-open Razorpay for an existing order (e.g. the guest dismissed it,
  // or closed and reopened the panel) without re-holding the room.
  const resumePayment = useCallback(async () => {
    if (!hold || hold.mock) return;
    setError('');
    try {
      await checkout.ensureRazorpayLoaded();
      setStatus('paying');
      checkout.openRazorpayCheckout({
        order: hold,
        description: `Room ${pick?.unit?.unitNumber || ''} · ${stay.checkIn} to ${stay.checkOut}`,
        guest,
        onSuccess: () => reset(),
        onDismiss: () => setStatus('idle'),
        onFail: (msg) => {
          setStatus('error');
          setError(msg);
        },
        onVerifyError: (msg) => {
          setStatus('error');
          setError(msg);
        },
      });
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Could not open checkout. Please try again.');
    }
  }, [hold, pick, stay, guest, checkout, reset]);

  const confirmMock = useCallback(async () => {
    if (!hold) return;
    setError('');
    setStatus('paying');
    try {
      await checkout.confirmMockPayment({ bookingId: hold.bookingId, reference: hold.reference, orderId: hold.orderId });
      reset();
    } catch (err) {
      setStatus('error');
      setError(errMsg(err, 'Payment verification failed. Please try again.'));
    }
  }, [hold, checkout, reset]);

  const value = useMemo(
    () => ({
      isOpen,
      step,
      stay,
      datesValid,
      roomTypeFilter,
      clearRoomTypeFilter: () => setRoomTypeFilter(null),
      pick,
      setPick,
      guest,
      hold,
      status,
      error,
      setStay,
      setGuest,
      goTo,
      openBooking,
      close,
      reset,
      submitAndPay,
      resumePayment,
      confirmMock,
    }),
    [
      isOpen,
      step,
      stay,
      datesValid,
      roomTypeFilter,
      pick,
      guest,
      hold,
      status,
      error,
      setStay,
      setGuest,
      goTo,
      openBooking,
      close,
      reset,
      submitAndPay,
      resumePayment,
      confirmMock,
    ]
  );

  return <BookingCtx.Provider value={value}>{children}</BookingCtx.Provider>;
}

export function useBooking() {
  const ctx = useContext(BookingCtx);
  if (!ctx) throw new Error('useBooking must be used within BookingProvider');
  return ctx;
}
