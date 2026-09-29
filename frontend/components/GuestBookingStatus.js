'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../lib/api';
import { inr, fmtDate, fmtDateTime, errMsg, todayIST, nightsBetween } from '../lib/bookingUi';
import { CONTACT, directionsUrl, whatsappUrl } from '../lib/site';
import { realPhotos } from '../lib/rooms';
import PhoneInput from './site/PhoneInput';
import RoomPhoto from './site/RoomPhoto';

// Guest-facing wording for each status.
const GUEST_STATUS = {
  pending_payment: { title: 'Payment pending', text: 'Your room is held briefly while you complete payment.' },
  paid: { title: 'Payment received', text: 'The resort is reviewing your booking and will confirm within 24 hours. You will get an SMS / WhatsApp as soon as it is confirmed. If it cannot be confirmed, your payment is refunded in full automatically.' },
  confirmed: { title: 'Booking confirmed', text: 'We look forward to welcoming you.' },
  checked_in: { title: 'Enjoy your stay', text: 'You are checked in.' },
  checked_out: { title: 'Thank you for staying with us', text: 'We hope to see you again at Chirala Beach.' },
  cancelled: { title: 'Booking cancelled', text: '' },
  rejected: { title: 'Booking could not be confirmed', text: 'We are sorry — the resort could not accept this booking.' },
  no_show: { title: 'Marked as no-show', text: 'The booking was closed because the guest did not arrive.' },
};

// Stay progress, in the order a booking actually moves.
const STEPS = [
  { key: 'paid', label: 'Paid' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'checked_in', label: 'Checked in' },
  { key: 'checked_out', label: 'Checked out' },
];
const STEP_INDEX = { pending_payment: -1, paid: 0, confirmed: 1, checked_in: 2, checked_out: 3 };

function Countdown({ checkIn }) {
  const days = nightsBetween(todayIST(), checkIn);
  if (days < 0) return null;
  return (
    <div className="rounded-xl bg-ocean-500 px-5 py-4 text-white">
      <p className="text-3xl font-semibold">{days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`}</p>
      <p className="text-sm text-white/80">{days === 0 ? 'is check-in day' : 'until check-in'} · {fmtDate(checkIn)}</p>
    </div>
  );
}

function Progress({ status }) {
  const at = STEP_INDEX[status];
  if (at === undefined) return null;
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Booking progress">
      {STEPS.map((s, i) => (
        <li key={s.key} className="text-center">
          <span className={`mx-auto block h-1.5 rounded-full ${i <= at ? 'bg-ocean-500' : 'bg-navy-700'}`} />
          <span className={`mt-2 block text-xs ${i === at ? 'font-semibold text-navy-50' : 'text-navy-400'}`}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

function Summary({ b }) {
  const [photo, setPhoto] = useState(undefined);
  useEffect(() => {
    if (!b.room.typeId) return setPhoto(null);
    api.get(`/rooms/${b.room.typeId}`).then((r) => setPhoto(realPhotos(r.data.room)[0] || null)).catch(() => setPhoto(null));
    return undefined;
  }, [b.room.typeId]);

  const s = GUEST_STATUS[b.status] || { title: b.status, text: '' };
  const refunded = b.refunds.reduce((sum, r) => sum + (r.status !== 'failed' ? r.amount : 0), 0);
  const nights = nightsBetween(b.checkIn, b.checkOut);
  const upcoming = ['paid', 'confirmed'].includes(b.status);
  const wa = whatsappUrl(`Hello, this is about booking ${b.reference}.`);

  return (
    <div className="card overflow-hidden">
      <div className="h-48 sm:h-56">{photo !== undefined && <RoomPhoto src={photo} alt={b.room.type} />}</div>
      <div className="space-y-6 p-6 sm:p-8">
        <div>
          <p className="text-xs uppercase tracking-wider text-navy-400">Booking {b.reference}</p>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-navy-50">{s.title}</h2>
          {s.text && <p className="mt-2 text-navy-300">{s.text}</p>}
          {b.closeReason && b.status === 'cancelled' && <p className="mt-2 text-navy-300">{b.closeReason}.</p>}
        </div>

        <Progress status={b.status} />
        {upcoming && <Countdown checkIn={b.checkIn} />}

        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt className="text-navy-400">Guest</dt><dd className="text-navy-50">{b.guestName}</dd></div>
          <div><dt className="text-navy-400">Room</dt><dd className="text-navy-50">{b.room.unitNumber} · {b.room.type}{b.room.view ? ` · ${b.room.view}` : ''}</dd></div>
          <div><dt className="text-navy-400">Check-in</dt><dd className="text-navy-50">{fmtDate(b.checkIn)}</dd></div>
          <div><dt className="text-navy-400">Check-out</dt><dd className="text-navy-50">{fmtDate(b.checkOut)} · {nights} night{nights > 1 ? 's' : ''}</dd></div>
          <div><dt className="text-navy-400">Guests</dt><dd className="text-navy-50">{b.adults} adult{b.adults > 1 ? 's' : ''}{b.children ? `, ${b.children} child${b.children > 1 ? 'ren' : ''}` : ''}</dd></div>
          <div>
            <dt className="text-navy-400">Total</dt>
            <dd className="text-navy-50"><span className="price">{inr(b.total)}</span>{b.tax > 0 && <span className="ml-1 text-xs text-navy-400">incl. GST {inr(b.tax)}</span>}</dd>
          </div>
          {b.balanceDue > 0 && b.status !== 'pending_payment' && (
            <div><dt className="text-navy-400">Due at the resort</dt><dd className="font-semibold text-red-700">{inr(b.balanceDue)}</dd></div>
          )}
          {refunded > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-navy-400">Refund</dt>
              <dd className="text-green-800">
                {inr(refunded)} —{' '}
                {b.refunds.some((r) => r.method !== 'razorpay' && r.status === 'pending')
                  ? 'collect at the resort counter'
                  : 'to your original payment method (5–7 working days)'}
              </dd>
            </div>
          )}
        </dl>
        {b.status === 'paid' && b.holdExpiresAt && <p className="text-xs text-navy-400">Confirmation due by {fmtDateTime(b.holdExpiresAt)}.</p>}

        {upcoming && (
          <div className="rounded-xl bg-navy-900 p-4 text-sm text-navy-200">
            <p className="font-semibold text-navy-50">Before you arrive</p>
            <p className="mt-1">Bring a photo ID (Aadhaar, passport or driving licence) for every adult — the front desk checks them at check-in.</p>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <a href={directionsUrl()} target="_blank" rel="noopener noreferrer" className="btn-outline">Directions</a>
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-outline">WhatsApp the front desk</a>}
          <Link href="/" className="btn-gold">Back to home</Link>
        </div>
      </div>
    </div>
  );
}

function Help() {
  const wa = whatsappUrl();
  return (
    <aside className="space-y-4">
      <h2 className="font-serif text-2xl font-semibold text-navy-50">What you can do here</h2>
      <ul className="space-y-3 text-navy-200">
        <li className="flex gap-3"><span className="text-ocean-500">✓</span> See whether your booking is confirmed, and its reference</li>
        <li className="flex gap-3"><span className="text-ocean-500">✓</span> Check your dates, room number and what you paid</li>
        <li className="flex gap-3"><span className="text-ocean-500">✓</span> Track a refund</li>
        <li className="flex gap-3"><span className="text-ocean-500">✓</span> Get directions to the resort</li>
      </ul>
      <p className="text-sm text-navy-400">
        To change dates or cancel, contact the resort{wa ? ' on WhatsApp' : ''} at{' '}
        {CONTACT.phone ? <a className="text-ocean-600 underline" href={`tel:${CONTACT.phone.replace(/\s/g, '')}`}>{CONTACT.phone}</a> : <a className="text-ocean-600 underline" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>}.
        Your reference is in the SMS / WhatsApp we sent after booking.
      </p>
    </aside>
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

  if (booking) {
    return (
      <div className="space-y-4">
        <Summary b={booking} />
        <button type="button" onClick={() => setBooking(null)} className="text-sm text-navy-400 underline">Look up another booking</button>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="card p-8">
        <p className="eyebrow">My Booking</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-navy-50">Find your booking</h1>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            lookup(form.ref.trim().toUpperCase(), form.phone);
          }}
        >
          <div>
            <label className="label" htmlFor="bookingRef">Booking reference</label>
            <input id="bookingRef" required className="input-field uppercase" placeholder="e.g. GKL-7F3K2" value={form.ref} onChange={(e) => setForm((f) => ({ ...f, ref: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="lookupPhone">Mobile number used for the booking</label>
            <PhoneInput id="lookupPhone" required value={form.phone} onChange={(phone) => setForm((f) => ({ ...f, phone }))} />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="btn-gold w-full disabled:opacity-60">{loading ? 'Looking up…' : 'Show my booking'}</button>
        </form>
      </div>
      <Help />
    </div>
  );
}
