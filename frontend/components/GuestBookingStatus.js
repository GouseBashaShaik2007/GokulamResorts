'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import api from '../lib/api';
import { inr, fmtDate, fmtDateTime, errMsg, todayIST, nightsBetween } from '../lib/bookingUi';
import { directionsUrl, telHref, whatsappUrl } from '../lib/site';
import { useContact } from './site/ContactContext';
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
        <li key={s.key} className="text-center" aria-current={i === at ? 'step' : undefined}>
          <span className={`mx-auto block h-1.5 rounded-full ${i <= at ? 'bg-ocean-500' : 'bg-navy-700'}`} />
          <span className={`mt-2 block text-xs ${i === at ? 'font-semibold text-navy-50' : 'text-navy-400'}`}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

// The reference is what a guest needs to keep; one tap puts it on the clipboard.
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — the reference is on screen to copy by hand
    }
  };
  return (
    <button type="button" onClick={copy} className="rounded-full border border-navy-700 px-2.5 py-0.5 text-[11px] font-medium normal-case tracking-normal text-ocean-600 hover:border-ocean-400">
      <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

// Right after paying: say plainly that the money arrived, and what happens now.
function PaymentReceived({ b }) {
  const steps = [
    { done: true, title: 'Payment received', text: `We have your payment of ${inr(b.paid || b.total)}.` },
    {
      title: 'The resort confirms your booking',
      text: `Within 24 hours${b.holdExpiresAt ? ` — by ${fmtDateTime(b.holdExpiresAt)}` : ''}. Your room is held for you meanwhile.`,
    },
    {
      title: 'You get an SMS / WhatsApp',
      text: 'As soon as it is confirmed. If the resort cannot confirm in that time, your payment is refunded in full automatically.',
    },
  ];
  return (
    <div className="card border-green-700/30 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-green-700 text-white" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <div>
          <h1 className="font-serif text-3xl font-semibold text-navy-50">Payment received — thank you</h1>
          <p className="mt-1 text-navy-300">Your booking reference. Keep it: with your mobile number, it is how you look this booking up.</p>
          <p className="mt-3 flex flex-wrap items-center gap-3">
            <span className="font-mono text-3xl font-semibold tracking-wide text-navy-50">{b.reference}</span>
            <CopyButton text={b.reference} />
          </p>
        </div>
      </div>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-navy-400">What happens next</h2>
      <ol className="mt-3 space-y-4">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <span
              className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-sm font-semibold ${step.done ? 'bg-green-700 text-white' : 'border border-navy-600 text-navy-200'}`}
              aria-hidden="true"
            >
              {step.done ? '✓' : i + 1}
            </span>
            <span>
              <span className="block font-medium text-navy-50">{step.title}</span>
              <span className="text-sm text-navy-300">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Summary({ b, justBooked }) {
  const contact = useContact();
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
  const wa = whatsappUrl(`Hello, this is about booking ${b.reference}.`, contact);
  const tel = telHref(contact);
  // The dedicated "payment received" card above already carries the heading and reference.
  const celebrated = justBooked && b.status === 'paid';
  const Title = celebrated ? 'h2' : 'h1';

  return (
    <>
    {celebrated && <PaymentReceived b={b} />}
    <div className="card overflow-hidden">
      <div className="relative h-48 sm:h-56">
        {photo === undefined ? <div className="h-full w-full animate-pulse bg-navy-800" /> : <RoomPhoto src={photo} alt={b.room.type} />}
      </div>
      <div className="space-y-6 p-6 sm:p-8">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider text-navy-400">
            Booking
            <span className="font-mono text-sm font-semibold normal-case tracking-normal text-navy-50">{b.reference}</span>
            <CopyButton text={b.reference} />
          </p>
          <Title className="mt-1 font-serif text-3xl font-semibold text-navy-50" aria-live="polite">{celebrated ? 'Your stay' : s.title}</Title>
          {s.text && !celebrated && <p className="mt-2 text-navy-300">{s.text}</p>}
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
        {b.status === 'paid' && b.holdExpiresAt && !celebrated && (
          <p className="text-xs text-navy-400">
            Confirmation due by {fmtDateTime(b.holdExpiresAt)}. If the resort has not confirmed by then, the booking is
            cancelled and the full amount is refunded automatically.
          </p>
        )}

        {upcoming && (
          <div className="rounded-xl bg-navy-900 p-4 text-sm text-navy-200">
            <p className="font-semibold text-navy-50">Before you arrive</p>
            <ul className="mt-2 space-y-1.5">
              <li>Bring a photo ID (Aadhaar, passport or driving licence) for every adult — the front desk checks them at check-in.</li>
              {contact.checkInTime && <li>Check-in is from {contact.checkInTime} on {fmtDate(b.checkIn)}{contact.checkOutTime ? `; check-out is by ${contact.checkOutTime}` : ''}.</li>}
              <li>
                Find us at{' '}
                <a href={directionsUrl(contact)} target="_blank" rel="noopener noreferrer" className="text-ocean-600 underline">{contact.address}</a>.
              </li>
              {tel && <li>Front desk: <a href={tel} className="text-ocean-600 underline">{contact.phone}</a> — call if your plans or arrival time change.</li>}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <a href={directionsUrl(contact)} target="_blank" rel="noopener noreferrer" className="btn-outline">Directions</a>
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-outline">WhatsApp the front desk</a>}
          <Link href="/" className="btn-gold">Back to home</Link>
        </div>
      </div>
    </div>
    </>
  );
}

function Help() {
  const contact = useContact();
  const wa = whatsappUrl('', contact);
  const tel = telHref(contact);
  return (
    <aside className="space-y-4">
      <h2 className="font-serif text-2xl font-semibold text-navy-50">What you can do here</h2>
      <ul className="space-y-3 text-navy-200">
        <li className="flex gap-3"><span className="text-ocean-500" aria-hidden="true">✓</span> See whether your booking is confirmed, and its reference</li>
        <li className="flex gap-3"><span className="text-ocean-500" aria-hidden="true">✓</span> Check your dates, room number and what you paid</li>
        <li className="flex gap-3"><span className="text-ocean-500" aria-hidden="true">✓</span> Track a refund</li>
        <li className="flex gap-3"><span className="text-ocean-500" aria-hidden="true">✓</span> Get directions to the resort</li>
      </ul>
      <p className="text-sm text-navy-400">
        To change dates or cancel, contact the resort{wa ? ' on WhatsApp' : ''} at{' '}
        {tel ? <a className="text-ocean-600 underline" href={tel}>{contact.phone}</a> : <a className="text-ocean-600 underline" href={`mailto:${contact.email}`}>{contact.email}</a>}.
        Your reference is in the SMS / WhatsApp we sent after booking.
      </p>
    </aside>
  );
}

/**
 * Looks up a booking by reference + phone. If both are known up front (right
 * after paying, same tab) it loads straight away; otherwise it asks for them.
 * `justBooked`: this is the page a guest lands on after paying, so a booking
 * that is still awaiting the resort's confirmation gets the "payment received,
 * here is what happens next" card on top.
 */
export default function GuestBookingStatus({ initialRef = '', initialPhone = '', intro = '', justBooked = false }) {
  const [form, setForm] = useState({ ref: initialRef, phone: initialPhone });
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const lastLookup = useRef(null); // { reference, phone } of the booking on screen

  const lookup = useCallback(async (reference, phone) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/bookings/lookup', { params: { reference, phone } });
      lastLookup.current = { reference, phone };
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

  // While the booking is waiting on payment or the resort's approval, check
  // again quietly so "Booking confirmed" appears without a reload. Once a
  // minute: the lookup API allows 30 requests per 15 minutes.
  const waiting = !!booking && ['pending_payment', 'paid'].includes(booking.status);
  useEffect(() => {
    if (!waiting) return undefined;
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible' || !lastLookup.current) return;
      try {
        const res = await api.get('/bookings/lookup', { params: lastLookup.current });
        setBooking(res.data.booking);
      } catch {
        // keep what's on screen; the next check may succeed
      }
    }, 60000);
    return () => clearInterval(id);
  }, [waiting]);

  if (booking) {
    return (
      <div className="space-y-4">
        <Summary b={booking} justBooked={justBooked} />
        <button type="button" onClick={() => setBooking(null)} className="text-sm text-navy-400 underline">Look up another booking</button>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="card p-8">
        <p className="eyebrow">My Booking</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-navy-50">Find your booking</h1>
        {intro && <p className="mt-2 text-sm text-navy-300">{intro}</p>}
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            lookup(form.ref.trim().toUpperCase(), form.phone);
          }}
        >
          <div>
            <label className="label" htmlFor="bookingRef">Booking reference</label>
            <input id="bookingRef" required className="input-field" placeholder="e.g. GKL-7F3K2" autoCapitalize="characters" value={form.ref} onChange={(e) => setForm((f) => ({ ...f, ref: e.target.value.toUpperCase() }))} />
          </div>
          <div>
            <label className="label" htmlFor="lookupPhone">Mobile number used for the booking</label>
            <PhoneInput id="lookupPhone" required value={form.phone} onChange={(phone) => setForm((f) => ({ ...f, phone }))} />
          </div>
          {error && (
            <div role="alert" className="text-sm">
              <p className="text-red-700">{error}</p>
              <p className="mt-1 text-xs text-navy-400">
                Check the reference (it looks like GKL-7F3K2) and use the mobile number the booking was made with, with its country code.
              </p>
            </div>
          )}
          <button disabled={loading} className="btn-gold w-full disabled:opacity-60">{loading ? 'Looking up…' : 'Show my booking'}</button>
        </form>
      </div>
      <Help />
    </div>
  );
}
