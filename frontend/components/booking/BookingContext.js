'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useBookingCheckout } from '../../lib/useBookingCheckout';
import { errMsg, todayIST } from '../../lib/bookingUi';

// Three contexts, so a screen only re-renders for what it actually shows:
//   StayCtx   the dates and guest counts (hero form, floating bar, room pages)
//   PanelCtx  whether the booking panel is open, and how to open it (navbar, buttons)
//   BookingCtx everything, for the steps inside the panel
// Typing a name in the panel changes only BookingCtx, so the navbar, hero form
// and floating bar stay still.
const StayCtx = createContext(null);
const PanelCtx = createContext(null);
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

// A link someone shared can carry their dates and party:
// /rooms/sea-view?checkIn=2026-12-24&checkOut=2026-12-27&adults=2&children=1
// (see components/site/ShareRoom.js). Past or back-to-front dates are ignored.
function stayFromAddress() {
  try {
    const q = new URLSearchParams(window.location.search);
    const isDate = (value) => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value || '');
    const checkIn = q.get('checkIn');
    const checkOut = q.get('checkOut');
    if (!isDate(checkIn) || !isDate(checkOut) || checkIn < todayIST() || checkOut <= checkIn) return null;
    return {
      checkIn,
      checkOut,
      adults: cleanCount('adults', q.get('adults') || 1),
      children: cleanCount('children', q.get('children') || 0),
    };
  } catch {
    return null;
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

// ---------- the panel's state, and every way it may change ----------
//
// step:   'stay' | 'room' | 'guest' | 'pay'
// status: 'idle' | 'booking' (holding the room) | 'paying' | 'error'
// pick:   the chosen room type and its price { roomType, quote }
// hold:   the order for a room held for payment
//         { bookingId, reference, holdExpiresAt, orderId, amount, currency, keyId, mock }
// heldStay: the dates and guests that hold was made for
const initialPanel = {
  isOpen: false,
  step: 'stay',
  roomTypeFilter: null,
  pick: null,
  guest: emptyGuest,
  hold: null,
  heldStay: null,
  status: 'idle',
  error: '',
  restored: false,
};

function panelReducer(state, action) {
  switch (action.type) {
    // After a refresh: put back a room that is still on hold.
    case 'restored': {
      const saved = action.saved;
      if (!saved) return { ...state, restored: true };
      return {
        ...state,
        restored: true,
        hold: saved.hold,
        heldStay: saved.heldStay || null,
        pick: saved.pick || null,
        guest: { ...emptyGuest, ...saved.guest },
      };
    }
    case 'opened': {
      // A room already on hold always resumes at payment — otherwise the guest
      // could hold a second room while the first is still theirs.
      const step = state.hold ? 'pay' : action.step || (action.datesValid ? 'room' : 'stay');
      return { ...state, isOpen: true, error: '', step, roomTypeFilter: action.roomTypeId || state.roomTypeFilter };
    }
    case 'closed':
      return { ...state, isOpen: false };
    case 'wentTo':
      return { ...state, error: '', step: action.step };
    // New dates or guest counts: the chosen room was priced for the old ones.
    // A room on hold keeps its own dates (heldStay), so it is left alone.
    case 'stayChanged':
      return state.hold || !state.pick ? state : { ...state, pick: null };
    case 'picked':
      return { ...state, pick: action.pick };
    case 'guestEdited':
      return { ...state, guest: typeof action.change === 'function' ? action.change(state.guest) : { ...state.guest, ...action.change } };
    case 'filterCleared':
      return { ...state, roomTypeFilter: null };
    case 'bookingStarted':
      return { ...state, error: '', status: 'booking' };
    case 'held':
      // A simulated order waits for the guest's tap; a live one goes on to Razorpay.
      return { ...state, hold: action.order, heldStay: action.stay, step: 'pay', status: action.order.mock ? 'idle' : state.status };
    case 'paymentOpened':
      return { ...state, error: '', status: 'paying' };
    case 'paymentDismissed':
      return { ...state, status: 'idle' };
    case 'failed':
      return {
        ...state,
        status: 'error',
        error: action.message,
        // Someone else took the room — back to the list to pick again.
        ...(action.roomTaken ? { pick: null, step: 'room' } : {}),
      };
    case 'problem':
      return { ...state, error: action.message };
    // The hold ran out: drop it and the picked room, but keep the dates and the
    // guest's details so they only have to choose a room again.
    case 'holdReleased':
      return { ...state, hold: null, heldStay: null, pick: null, status: 'idle', error: '', step: 'room' };
    // Paid, or "Start over".
    case 'reset':
      return { ...initialPanel, restored: state.restored };
    default:
      return state;
  }
}

export function BookingProvider({ children }) {
  const checkout = useBookingCheckout();
  const [stay, setStayState] = useState(emptyStay);
  const [panel, dispatch] = useReducer(panelReducer, initialPanel);
  // The room type of the room page currently on screen, if any — so "Book"
  // from the navbar or floating bar continues with that room, not all rooms.
  const pageRoomTypeId = useRef(null);

  // Restore after a refresh: the dates, and a room still on hold for payment.
  // Without this a reload on the payment step loses the hold, and the guest's
  // own hold then blocks them from re-booking the room until it expires.
  useEffect(() => {
    // Dates in the address (a shared link) come before what this tab remembered.
    const shared = stayFromAddress();
    setStayState(shared || loadPersistedStay());
    if (shared) {
      try {
        window.sessionStorage.setItem(STAY_KEY, JSON.stringify(shared));
      } catch {
        // ignore — non-essential convenience
      }
    }
    dispatch({ type: 'restored', saved: loadPersistedHold() });
  }, []);

  const { restored, hold, heldStay, pick, guest } = panel;
  useEffect(() => {
    if (!restored) return; // don't wipe the saved hold before it has been read
    try {
      if (hold) window.sessionStorage.setItem(HOLD_KEY, JSON.stringify({ hold, heldStay, pick, guest }));
      else window.sessionStorage.removeItem(HOLD_KEY);
    } catch {
      // storage blocked — the hold just won't survive a refresh
    }
  }, [restored, hold, heldStay, pick, guest]);

  const setStay = useCallback((partial) => {
    setStayState((s) => {
      const merged = typeof partial === 'function' ? partial(s) : { ...s, ...partial };
      const next = { ...merged, adults: cleanCount('adults', merged.adults), children: cleanCount('children', merged.children) };
      try {
        window.sessionStorage.setItem(STAY_KEY, JSON.stringify(next));
      } catch {
        // ignore — non-essential convenience
      }
      return next;
    });
    dispatch({ type: 'stayChanged' });
  }, []);

  const datesValid = !!(stay.checkIn && stay.checkOut && stay.checkOut > stay.checkIn);
  const adults = countOf('adults', stay.adults);
  const kids = countOf('children', stay.children);

  const stayValue = useMemo(
    () => ({
      stay,
      setStay,
      datesValid,
      // Guest counts as numbers, safe to send or add up (stay.adults may be '' mid-edit).
      adults,
      children: kids,
      guests: adults + kids,
    }),
    [stay, setStay, datesValid, adults, kids]
  );

  // ---------- opening and closing ----------

  /** `prefill.roomTypeId`: show only that room type. `prefill.step`: open on that step. */
  const openBooking = useCallback(
    (prefill = {}) => dispatch({ type: 'opened', datesValid, step: prefill.step, roomTypeId: prefill.roomTypeId || pageRoomTypeId.current }),
    [datesValid]
  );
  const close = useCallback(() => dispatch({ type: 'closed' }), []);
  const setPageRoomTypeId = useCallback((id) => {
    pageRoomTypeId.current = id;
  }, []);

  const panelValue = useMemo(
    () => ({ isOpen: panel.isOpen, openBooking, close, setPageRoomTypeId }),
    [panel.isOpen, openBooking, close, setPageRoomTypeId]
  );

  // ---------- inside the panel ----------

  const goTo = useCallback((step) => dispatch({ type: 'wentTo', step }), []);
  const setPick = useCallback((next) => dispatch({ type: 'picked', pick: next }), []);
  const setGuest = useCallback((change) => dispatch({ type: 'guestEdited', change }), []);
  const clearRoomTypeFilter = useCallback(() => dispatch({ type: 'filterCleared' }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);
  const releaseHold = useCallback(() => dispatch({ type: 'holdReleased' }), []);

  // The stay being paid for: the held room's own dates once there is a hold
  // (the guest may have changed the dates on the page since), else the current ones.
  const bookedStay = useMemo(
    () => (hold && heldStay) || { checkIn: stay.checkIn, checkOut: stay.checkOut, adults, children: kids },
    [hold, heldStay, stay.checkIn, stay.checkOut, adults, kids]
  );

  // Razorpay for an order that already exists — a new one, or one the guest
  // came back to. The one place the checkout window is opened.
  const openCheckout = useCallback(
    async (order, forStay, roomName) => {
      await checkout.ensureRazorpayLoaded();
      dispatch({ type: 'paymentOpened' });
      const failed = (message) => dispatch({ type: 'failed', message });
      checkout.openRazorpayCheckout({
        order,
        description: `${roomName || 'Room'} · ${forStay.checkIn} to ${forStay.checkOut}`,
        guest,
        onSuccess: reset,
        onDismiss: () => dispatch({ type: 'paymentDismissed' }),
        onFail: failed,
        onVerifyError: failed,
      });
    },
    [checkout, guest, reset]
  );

  // Hold the room and create its order, then either the simulated-payment
  // screen or a live Razorpay checkout.
  const submitAndPay = useCallback(async () => {
    if (!pick) {
      dispatch({ type: 'problem', message: 'Please choose a room.' });
      return;
    }
    dispatch({ type: 'bookingStarted' });
    const forStay = { checkIn: stay.checkIn, checkOut: stay.checkOut, adults, children: kids };
    try {
      const order = await checkout.createHoldAndOrder({ roomTypeId: pick.roomType.id, ...forStay, guest });
      dispatch({ type: 'held', order, stay: forStay });
      if (!order.mock) await openCheckout(order, forStay, pick.roomType.name);
    } catch (err) {
      dispatch({
        type: 'failed',
        message: errMsg(err, err.message || 'Something went wrong. Please try again.'),
        roomTaken: err?.response?.status === 409,
      });
    }
  }, [pick, stay.checkIn, stay.checkOut, adults, kids, guest, checkout, openCheckout]);

  // Re-open Razorpay for the held room (the guest dismissed it, or closed and
  // reopened the panel) without holding the room again.
  const resumePayment = useCallback(async () => {
    if (!hold || hold.mock) return;
    try {
      await openCheckout(hold, bookedStay, pick?.roomType?.name);
    } catch (err) {
      dispatch({ type: 'failed', message: err.message || 'Could not open checkout. Please try again.' });
    }
  }, [hold, bookedStay, pick, openCheckout]);

  const confirmMock = useCallback(async () => {
    if (!hold) return;
    dispatch({ type: 'paymentOpened' });
    try {
      await checkout.confirmMockPayment({ bookingId: hold.bookingId, reference: hold.reference, orderId: hold.orderId });
      reset();
    } catch (err) {
      dispatch({ type: 'failed', message: errMsg(err, 'Payment verification failed. Please try again.') });
    }
  }, [hold, checkout, reset]);

  const value = useMemo(
    () => ({
      ...stayValue,
      ...panelValue,
      step: panel.step,
      roomTypeFilter: panel.roomTypeFilter,
      pick,
      guest,
      hold,
      bookedStay,
      status: panel.status,
      error: panel.error,
      clearRoomTypeFilter,
      setPick,
      setGuest,
      goTo,
      reset,
      releaseHold,
      submitAndPay,
      resumePayment,
      confirmMock,
    }),
    [
      stayValue,
      panelValue,
      panel.step,
      panel.roomTypeFilter,
      panel.status,
      panel.error,
      pick,
      guest,
      hold,
      bookedStay,
      clearRoomTypeFilter,
      setPick,
      setGuest,
      goTo,
      reset,
      releaseHold,
      submitAndPay,
      resumePayment,
      confirmMock,
    ]
  );

  return (
    <StayCtx.Provider value={stayValue}>
      <PanelCtx.Provider value={panelValue}>
        <BookingCtx.Provider value={value}>{children}</BookingCtx.Provider>
      </PanelCtx.Provider>
    </StayCtx.Provider>
  );
}

function useCtx(ctx, name) {
  const value = useContext(ctx);
  if (!value) throw new Error(`${name} must be used within BookingProvider`);
  return value;
}

/** The dates and guest counts: { stay, setStay, datesValid, adults, children, guests }. */
export const useStay = () => useCtx(StayCtx, 'useStay');

/** Opening and closing the booking panel: { isOpen, openBooking, close, setPageRoomTypeId }. */
export const useBookingPanel = () => useCtx(PanelCtx, 'useBookingPanel');

/** Everything — for the steps inside the panel. Re-renders on every change. */
export const useBooking = () => useCtx(BookingCtx, 'useBooking');
