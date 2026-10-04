'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useBookingCheckout } from '../../lib/useBookingCheckout';
import { errMsg, todayIST } from '../../lib/bookingUi';

const BookingCtx = createContext(null);

const STAY_KEY = 'gokulam_booking_stay';
const HOLD_KEY = 'gokulam_booking_hold';

const emptyStay = { checkIn: '', checkOut: '', adults: 1, children: 0 };
const emptyGuest = { name: '', email: '', phone: '', specialRequests: '' };

const LIMITS = { adults: [1, 10], children: [0, 6] };

// What a guest-count field may hold: '' while it is being retyped, otherwise a
// whole number inside the allowed range. Never 0 adults, never 99.
function cleanCount(key, value) {
  if (value === '' || value === null || value === undefined) return '';
  const [min, max] = LIMITS[key];
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

// The number to actually book with (an empty field counts as the minimum).
const countOf = (key, value) => (cleanCount(key, value) === '' ? LIMITS[key][0] : cleanCount(key, value));

function loadPersistedStay() {
  try {
    const raw = window.sessionStorage.getItem(STAY_KEY);
    if (!raw) return emptyStay;
    const saved = { ...emptyStay, ...JSON.parse(raw) };
    // A tab left open overnight: yesterday's check-in can't be booked.
    if (saved.checkIn && saved.checkIn < todayIST()) {
      saved.checkIn = '';
      saved.checkOut = '';
    }
    return { ...saved, adults: cleanCount('adults', saved.adults), children: cleanCount('children', saved.children) };
  } catch {
    return emptyStay;
  }
}

// A room held for payment earlier in this tab, if its hold is still running.
function loadPersistedHold() {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(HOLD_KEY) || 'null');
    if (saved?.hold?.holdExpiresAt && new Date(saved.hold.holdExpiresAt).getTime() > Date.now()) return saved;
  } catch {
    // unreadable — treat as no hold
  }
  return null;
}

export function BookingProvider({ children }) {
  const checkout = useBookingCheckout();

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState('stay'); // 'stay' | 'room' | 'guest' | 'pay'
  const [stay, setStayState] = useState(emptyStay);
  const [roomTypeFilter, setRoomTypeFilter] = useState(null);
  // The room type of the room page currently on screen, if any — so "Book"
  // from the navbar or floating bar continues with that room, not all rooms.
  const [pageRoomTypeId, setPageRoomTypeId] = useState(null);
  const [pick, setPick] = useState(null);
  const [guest, setGuestState] = useState(emptyGuest);
  const [hold, setHold] = useState(null); // {bookingId, holdExpiresAt, orderId, amount, currency, keyId, mock}
  const [status, setStatus] = useState('idle'); // idle | booking | paying | error
  const [error, setError] = useState('');
  const [restored, setRestored] = useState(false);

  // Restore after a refresh: the dates, and a room still on hold for payment.
  // Without this a reload on the payment step loses the hold, and the guest's
  // own hold then blocks them from re-booking the room until it expires.
  useEffect(() => {
    setStayState(loadPersistedStay());
    const saved = loadPersistedHold();
    if (saved) {
      setHold(saved.hold);
      setPick(saved.pick || null);
      setGuestState({ ...emptyGuest, ...saved.guest });
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return; // don't wipe the saved hold before it has been read
    try {
      if (hold) window.sessionStorage.setItem(HOLD_KEY, JSON.stringify({ hold, pick, guest }));
      else window.sessionStorage.removeItem(HOLD_KEY);
    } catch {
      // storage blocked — the hold just won't survive a refresh
    }
  }, [restored, hold, pick, guest]);

  const persistStay = useCallback((next) => {
    try {
      window.sessionStorage.setItem(STAY_KEY, JSON.stringify(next));
    } catch {
      // ignore — non-essential convenience
    }
  }, []);

  const setStay = useCallback(
    (partial) => {
      setStayState((s) => {
        const merged = typeof partial === 'function' ? partial(s) : { ...s, ...partial };
        const next = { ...merged, adults: cleanCount('adults', merged.adults), children: cleanCount('children', merged.children) };
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
  const adults = countOf('adults', stay.adults);
  const kids = countOf('children', stay.children);

  const openBooking = useCallback(
    (prefill = {}) => {
      setError('');
      const typeId = prefill.roomTypeId || pageRoomTypeId;
      if (typeId) setRoomTypeFilter(typeId);

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
    [hold, datesValid, pageRoomTypeId]
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

  // The hold ran out: drop it and the picked room, but keep the dates and the
  // guest's details so they only have to choose a room again.
  const releaseHold = useCallback(() => {
    setHold(null);
    setPick(null);
    setStatus('idle');
    setError('');
    setStep('room');
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
        adults,
        children: kids,
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
  }, [pick, stay.checkIn, stay.checkOut, adults, kids, guest, checkout, reset]);

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
  }, [hold, pick, stay.checkIn, stay.checkOut, guest, checkout, reset]);

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

  const clearRoomTypeFilter = useCallback(() => setRoomTypeFilter(null), []);

  const value = useMemo(
    () => ({
      isOpen,
      step,
      stay,
      datesValid,
      // Guest counts as numbers, safe to send or add up (stay.adults may be '' mid-edit).
      adults,
      children: kids,
      guests: adults + kids,
      roomTypeFilter,
      clearRoomTypeFilter,
      setPageRoomTypeId,
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
      releaseHold,
      submitAndPay,
      resumePayment,
      confirmMock,
    }),
    [
      isOpen,
      step,
      stay,
      datesValid,
      adults,
      kids,
      roomTypeFilter,
      clearRoomTypeFilter,
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
      releaseHold,
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
