'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../lib/api';
import { loadRazorpayScript } from '../lib/loadRazorpay';
import { inr, todayIST, addDays, errMsg } from '../lib/bookingUi';
import RoomPicker from './bookings/RoomPicker';

// Remember the phone for this booking in this tab so the confirmation page can
// look it up without asking again (the status API needs booking id + phone).
const rememberBooking = (bookingId, phone) => {
  try {
    window.sessionStorage.setItem(`gokulam_booking_${bookingId}`, phone);
  } catch {
    // storage blocked — the confirmation page will ask for the phone instead
  }
};

export default function BookingForm({ room }) {
  const router = useRouter();
  const today = todayIST();
  const [stay, setStay] = useState({ checkIn: '', checkOut: '', adults: 1, children: 0 });
  const [types, setTypes] = useState(null);
  const [pick, setPick] = useState(null);
  const [guest, setGuest] = useState({ name: '', email: '', phone: '', specialRequests: '' });
  const [status, setStatus] = useState('idle'); // idle | booking | paying | error
  const [error, setError] = useState('');
  const [mockPayment, setMockPayment] = useState(null);

  const guests = Number(stay.adults) + Number(stay.children);
  const datesValid = stay.checkIn && stay.checkOut && stay.checkOut > stay.checkIn;

  // Live room-number availability for this room type.
  useEffect(() => {
    setPick(null);
    if (!datesValid) {
      setTypes(null);
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await api.get('/availability', {
          params: { checkIn: stay.checkIn, checkOut: stay.checkOut, roomTypeId: room.id, guests },
        });
        if (!cancelled) {
          setTypes(res.data.types);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setTypes(null);
          setError(errMsg(err, 'Could not check availability'));
        }
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [stay.checkIn, stay.checkOut, guests, room.id, datesValid]);

  const setS = (k) => (e) => {
    const value = e.target.value;
    setStay((s) => {
      const next = { ...s, [k]: value };
      if (k === 'checkIn' && (!s.checkOut || s.checkOut <= value)) next.checkOut = addDays(value, 1);
      return next;
    });
  };
  const setG = (k) => (e) => setGuest((g) => ({ ...g, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!pick) {
      setError('Please choose a room number.');
      return;
    }

    try {
      setStatus('booking');

      // STEP 1 — hold the chosen room on our server (15 minutes to pay)
      const bookingRes = await api.post('/book-room', {
        roomUnitId: pick.unit.id,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        adults: Number(stay.adults),
        children: Number(stay.children),
        ...guest,
      });
      const { bookingId } = bookingRes.data;
      rememberBooking(bookingId, guest.phone);

      // STEP 2 — Razorpay order for the held amount
      const orderRes = await api.post('/create-order', { bookingId, phone: guest.phone });
      const { orderId, amount: orderAmount, currency, keyId, mock } = orderRes.data;

      // Development: no live gateway configured — simulate the payment.
      if (mock) {
        setMockPayment({ bookingId, orderId, amount: orderAmount });
        setStatus('idle');
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        throw new Error('Unable to load Razorpay checkout. Please check your connection and try again.');
      }

      setStatus('paying');

      // STEP 3 — Razorpay Checkout
      const rzp = new window.Razorpay({
        key: keyId,
        amount: orderAmount,
        currency,
        name: 'Gokulam Resorts',
        description: `Room ${pick.unit.unitNumber} · ${stay.checkIn} to ${stay.checkOut}`,
        order_id: orderId,
        prefill: { name: guest.name, email: guest.email, contact: guest.phone },
        theme: { color: '#c9a227' },
        handler: async (response) => {
          try {
            // STEP 4 — server verifies the signature; booking becomes "paid, awaiting approval"
            await api.post('/verify-payment', {
              bookingId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            router.push(`/booking/confirmation?id=${bookingId}`);
          } catch (err) {
            setStatus('error');
            setError(
              errMsg(err, 'Payment verification failed. If an amount was deducted, it will be refunded automatically.')
            );
          }
        },
        modal: { ondismiss: () => setStatus('idle') },
      });

      rzp.on('payment.failed', (resp) => {
        setStatus('error');
        setError(resp?.error?.description || 'Payment failed. Please try again.');
      });

      rzp.open();
    } catch (err) {
      setStatus('error');
      setError(errMsg(err, err.message || 'Something went wrong. Please try again.'));
      if (err?.response?.status === 409) setStay((s) => ({ ...s })); // refresh availability
    }
  };

  const confirmMockPayment = async () => {
    setError('');
    setStatus('paying');
    try {
      await api.post('/verify-payment', {
        bookingId: mockPayment.bookingId,
        razorpay_order_id: mockPayment.orderId,
        razorpay_payment_id: `pay_mock_${mockPayment.bookingId}_${Date.now()}`,
        razorpay_signature: 'mock_signature',
      });
      router.push(`/booking/confirmation?id=${mockPayment.bookingId}`);
    } catch (err) {
      setStatus('error');
      setError(errMsg(err, 'Payment verification failed. Please try again.'));
    }
  };

  const isSubmitting = status === 'booking' || status === 'paying';

  if (mockPayment) {
    return (
      <div className="card space-y-5 p-6 text-center">
        <p className="eyebrow">Demo Checkout</p>
        <p className="text-navy-300">
          No live payment gateway is connected yet. Simulate a successful payment to send this booking to the
          resort for confirmation.
        </p>
        <p className="font-serif text-3xl font-bold text-gold-400">{inr(mockPayment.amount / 100)}</p>
        {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" onClick={confirmMockPayment} disabled={status === 'paying'} className="btn-gold px-6 py-2 disabled:opacity-60">
            {status === 'paying' ? 'Confirming...' : 'Simulate Successful Payment'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-6 p-6">
      {/* Step 1 — dates & guests */}
      <div>
        <p className="mb-3 text-sm font-semibold text-navy-100">1. Dates & guests</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="checkIn">Check-in</label>
            <input id="checkIn" type="date" required min={today} className="input-field" value={stay.checkIn} onChange={setS('checkIn')} />
          </div>
          <div>
            <label className="label" htmlFor="checkOut">Check-out</label>
            <input id="checkOut" type="date" required min={stay.checkIn ? addDays(stay.checkIn, 1) : addDays(today, 1)} className="input-field" value={stay.checkOut} onChange={setS('checkOut')} />
          </div>
          <div>
            <label className="label" htmlFor="adults">Adults</label>
            <input id="adults" type="number" min={1} max={room.capacity} required className="input-field" value={stay.adults} onChange={setS('adults')} />
          </div>
          <div>
            <label className="label" htmlFor="children">Children</label>
            <input id="children" type="number" min={0} max={room.capacity - 1} className="input-field" value={stay.children} onChange={setS('children')} />
          </div>
        </div>
        <p className="mt-1 text-xs text-navy-400">Up to {room.capacity} guests in this room type.</p>
      </div>

      {/* Step 2 — pick the actual room */}
      <div>
        <p className="mb-3 text-sm font-semibold text-navy-100">2. Choose your room</p>
        {!datesValid && <p className="text-sm text-navy-400">Pick your dates to see which rooms are free.</p>}
        {datesValid && guests > room.capacity && <p className="text-sm text-red-300">Too many guests for this room type.</p>}
        {datesValid && guests <= room.capacity && (
          <RoomPicker types={types} selectedId={pick?.unit.id} onSelect={(unit, roomType, quote) => setPick({ unit, quote })} showType={false} />
        )}
      </div>

      {/* Step 3 — guest details */}
      {pick && (
        <div>
          <p className="mb-3 text-sm font-semibold text-navy-100">3. Your details</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="name">Full name</label>
              <input id="name" required className="input-field" value={guest.name} onChange={setG('name')} placeholder="Priya Sharma" />
            </div>
            <div>
              <label className="label" htmlFor="phone">Mobile (SMS / WhatsApp updates)</label>
              <input id="phone" type="tel" required className="input-field" value={guest.phone} onChange={setG('phone')} placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" required className="input-field" value={guest.email} onChange={setG('email')} placeholder="priya@example.com" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="specialRequests">Special requests (optional)</label>
              <textarea id="specialRequests" rows={2} className="input-field" value={guest.specialRequests} onChange={setG('specialRequests')} placeholder="Early check-in, anniversary setup, dietary needs..." />
            </div>
          </div>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

      {pick && (
        <>
          <button type="submit" disabled={isSubmitting} className="btn-gold w-full disabled:opacity-60">
            {status === 'booking' && 'Holding your room...'}
            {status === 'paying' && 'Waiting for payment...'}
            {(status === 'idle' || status === 'error') && `Pay ${inr(pick.quote.total)} · Room ${pick.unit.unitNumber}`}
          </button>
          <p className="text-center text-xs text-navy-400">
            Full payment now via Razorpay. The resort confirms your booking within 24 hours — if it can't, you get a
            full refund automatically. Please bring a photo ID for every adult at check-in.
          </p>
        </>
      )}
    </form>
  );
}
