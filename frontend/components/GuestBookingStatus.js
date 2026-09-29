'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../lib/api';
import { inr, fmtDate, fmtDateTime, errMsg } from '../lib/bookingUi';
import Reveal from './motion/Reveal';

// Guest-facing wording for each status.
const GUEST_STATUS = {
  pending_payment: { icon: '⏳', title: 'Payment pending', text: 'Your room is held briefly while you complete payment.' },
  paid: { icon: '💳', title: 'Payment received', text: 'The resort is reviewing your booking and will confirm within 24 hours. You will get an SMS / WhatsApp as soon as it is confirmed. If it cannot be confirmed, your payment is refunded in full automatically.' },
  confirmed: { icon: '✅', title: 'Booking confirmed', text: 'We look forward to welcoming you. Please bring a photo ID (Aadhaar, passport or driving licence) for every adult guest.' },
  checked_in: { icon: '🏖️', title: 'Enjoy your stay', text: 'You are checked in.' },
  checked_out: { icon: '🙏', title: 'Thank you for staying with us', text: 'We hope to see you again at Chirala Beach.' },
  cancelled: { icon: '✖️', title: 'Booking cancelled', text: '' },
  rejected: { icon: '✖️', title: 'Booking could not be confirmed', text: 'We are sorry — the resort could not accept this booking.' },
  no_show: { icon: '✖️', title: 'Marked as no-show', text: 'The booking was closed because the guest did not arrive.' },
};

function Card({ b }) {
  const s = GUEST_STATUS[b.status] || { icon: '', title: b.status, text: '' };
  const refunded = b.refunds.reduce((sum, r) => sum + (r.status !== 'failed' ? r.amount : 0), 0);
  return (
    <Reveal as="div" className="card mx-auto max-w-lg p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/10 text-3xl">{s.icon}</div>
      <h1 className="section-heading">{s.title}</h1>
      {s.text && <p className="mt-2 text-navy-300">{s.text}</p>}
      {b.closeReason && b.status === 'cancelled' && <p className="mt-2 text-navy-300">{b.closeReason}.</p>}

      <dl className="mt-6 space-y-3 rounded-xl border border-navy-700 bg-navy-800 p-5 text-left text-sm">
        <div className="flex justify-between"><dt className="text-navy-400">Booking Reference</dt><dd className="text-navy-50">{b.reference}</dd></div>
        <div className="flex justify-between"><dt className="text-navy-400">Guest</dt><dd className="text-navy-50">{b.guestName}</dd></div>
        <div className="flex justify-between gap-4">
          <dt className="text-navy-400">Room</dt>
          <dd className="text-right text-navy-50">{b.room.unitNumber} · {b.room.type}{b.room.view ? ` · ${b.room.view}` : ''}</dd>
        </div>
        <div className="flex justify-between"><dt className="text-navy-400">Check-in</dt><dd className="text-navy-50">{fmtDate(b.checkIn)} · from 12 PM</dd></div>
        <div className="flex justify-between"><dt className="text-navy-400">Check-out</dt><dd className="text-navy-50">{fmtDate(b.checkOut)} · by 11 AM</dd></div>
        <div className="flex justify-between"><dt className="text-navy-400">Guests</dt><dd className="text-navy-50">{b.adults} adult{b.adults > 1 ? 's' : ''}{b.children ? `, ${b.children} child${b.children > 1 ? 'ren' : ''}` : ''}</dd></div>
        <div className="flex justify-between"><dt className="text-navy-400">Total</dt><dd className="price">{inr(b.total)}</dd></div>
        {b.balanceDue > 0 && b.status !== 'pending_payment' && (
          <div className="flex justify-between"><dt className="text-navy-400">Due at the resort</dt><dd className="text-red-300">{inr(b.balanceDue)}</dd></div>
        )}
        {refunded > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-navy-400">Refund</dt>
            <dd className="text-right text-green-300">
              {inr(refunded)}
              <span className="block text-xs text-navy-400">
                {b.refunds.some((r) => r.method !== 'razorpay' && r.status === 'pending')
                  ? 'Collect at the resort counter'
                  : 'To your original payment method (5–7 working days)'}
              </span>
            </dd>
          </div>
        )}
        {b.status === 'paid' && b.holdExpiresAt && (
          <p className="pt-1 text-xs text-navy-400">Confirmation due by {fmtDateTime(b.holdExpiresAt)}.</p>
        )}
      </dl>

      <p className="mt-6 text-xs text-navy-400">
        Keep your booking reference. You can check this page any time with your reference and mobile number.
      </p>
      <Link href="/" className="btn-gold mt-6 inline-flex">Back to Home</Link>
    </Reveal>
  );
}

/**
 * Looks up a booking by reference + phone. If both are known up front (right
 * after paying, same tab) it loads straight away; otherwise it asks for them.
 */
export default function GuestBookingStatus({ initialRef = '', initialPhone = '' }) {
  const [form, setForm] = useState({ ref: initialRef, phone: initialPhone });
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const lookup = useCallback(async (reference, phone) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/bookings/lookup', { params: { reference, phone } });
      setBooking(res.data.booking);
    } catch (err) {
      setBooking(null);
      setError(errMsg(err, 'We could not find that booking.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialRef && initialPhone) lookup(initialRef, initialPhone);
  }, [initialRef, initialPhone, lookup]);

  if (booking) return <Card b={booking} />;

  return (
    <div className="card mx-auto max-w-md p-8">
      <p className="eyebrow">My Booking</p>
      <h1 className="mt-2 font-serif text-2xl font-bold text-navy-50">Check your booking</h1>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          lookup(form.ref.trim().toUpperCase(), form.phone);
        }}
      >
        <div>
          <label className="label" htmlFor="bookingRef">Booking Reference</label>
          <input id="bookingRef" required className="input-field" placeholder="e.g. GKL-7F3K2" value={form.ref} onChange={(e) => setForm((f) => ({ ...f, ref: e.target.value }))} />
        </div>
        <div>
          <label className="label" htmlFor="lookupPhone">Mobile number used for the booking</label>
          <input id="lookupPhone" required type="tel" className="input-field" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button disabled={loading} className="btn-gold w-full disabled:opacity-60">{loading ? 'Looking up…' : 'Show booking'}</button>
      </form>
    </div>
  );
}
