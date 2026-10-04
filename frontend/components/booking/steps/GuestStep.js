'use client';

import { useState } from 'react';
import { useBooking } from '../BookingContext';
import { inr } from '../../../lib/bookingUi';
import PhoneInput, { isValidPhone } from '../../site/PhoneInput';
import StaySummary from '../StaySummary';

// What is wrong with each field, or '' when it is fine. Checked when the guest
// leaves a field and again on submit, so a slip is shown under the field it
// belongs to instead of as one sentence from the server after "Pay".
const CHECKS = {
  name: (v) => (v.trim().length < 2 || !/\p{L}/u.test(v) ? 'Enter the name of the guest who will check in.' : ''),
  phone: (v) => (isValidPhone(v) ? '' : 'Enter a mobile number we can reach you on — 10 digits for India.'),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter an email address, like name@example.com.'),
};
const FIELD_ID = { name: 'guestName', phone: 'guestPhone', email: 'guestEmail' };

export default function GuestStep() {
  const { pick, guest, setGuest, goTo, submitAndPay, status, error } = useBooking();
  const [problems, setProblems] = useState({});

  const setField = (k) => (e) => setGuest({ [k]: e.target.value });
  const check = (k) => setProblems((p) => ({ ...p, [k]: CHECKS[k](guest[k] || '') }));
  // Once a field has been flagged, clear the message as soon as it is put right.
  const recheck = (k, value) => problems[k] && setProblems((p) => ({ ...p, [k]: CHECKS[k](value) }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const found = Object.fromEntries(Object.keys(CHECKS).map((k) => [k, CHECKS[k](guest[k] || '')]));
    setProblems(found);
    const first = Object.keys(found).find((k) => found[k]);
    if (first) {
      document.getElementById(FIELD_ID[first])?.focus();
      return;
    }
    submitAndPay();
  };

  if (!pick) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-navy-400">Please choose a room first.</p>
        <button type="button" onClick={() => goTo('room')} className="btn-outline">Back to rooms</button>
      </div>
    );
  }

  const isSubmitting = status === 'booking' || status === 'paying';
  const problem = (k) => problems[k] && <p id={`${FIELD_ID[k]}Problem`} role="alert" className="mt-1 text-sm text-red-700">{problems[k]}</p>;
  const invalidProps = (k) => (problems[k] ? { 'aria-invalid': true, 'aria-describedby': `${FIELD_ID[k]}Problem` } : {});

  return (
    // noValidate: the messages below replace the browser's own bubbles.
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Step 3 of 4</p>
          <h2 className="mt-1 font-serif text-2xl font-semibold text-navy-50">Your Details</h2>
        </div>
        <button type="button" onClick={() => goTo('room')} className="text-xs text-gold-600 hover:underline">
          Change room
        </button>
      </div>

      <StaySummary />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="guestName">Full name</label>
          <input
            id="guestName" required autoComplete="name" maxLength={150}
            className={`input-field ${problems.name ? 'border-red-600' : ''}`}
            value={guest.name}
            onChange={(e) => { setField('name')(e); recheck('name', e.target.value); }}
            onBlur={() => check('name')}
            placeholder="Priya Sharma"
            {...invalidProps('name')}
          />
          {problem('name')}
        </div>
        <div>
          <label className="label" htmlFor="guestPhone">Mobile (SMS / WhatsApp updates)</label>
          <PhoneInput
            id="guestPhone" required value={guest.phone}
            onChange={(phone) => { setGuest({ phone }); recheck('phone', phone); }}
            onBlur={() => check('phone')}
            invalid={!!problems.phone}
            describedBy={problems.phone ? 'guestPhoneProblem' : undefined}
          />
          {problem('phone')}
        </div>
        <div>
          <label className="label" htmlFor="guestEmail">Email</label>
          <input
            id="guestEmail" type="email" required autoComplete="email"
            className={`input-field ${problems.email ? 'border-red-600' : ''}`}
            value={guest.email}
            onChange={(e) => { setField('email')(e); recheck('email', e.target.value); }}
            onBlur={() => check('email')}
            placeholder="priya@example.com"
            {...invalidProps('email')}
          />
          {problem('email')}
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="guestRequests">Special requests (optional)</label>
          <textarea id="guestRequests" rows={2} maxLength={1000} className="input-field" value={guest.specialRequests} onChange={setField('specialRequests')} placeholder="Early check-in, anniversary setup, dietary needs..." aria-describedby="guestRequestsHint" />
          <p id="guestRequestsHint" className="mt-1 text-xs text-navy-400">We&apos;ll do our best. Requests depend on what&apos;s available on the day.</p>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</div>}

      <button type="submit" disabled={isSubmitting} className="btn-gold w-full disabled:opacity-60">
        {status === 'booking' && 'Holding your room...'}
        {status === 'paying' && 'Waiting for payment...'}
        {(status === 'idle' || status === 'error') && `Pay ${inr(pick.quote.total)} · Room ${pick.unit.unitNumber}`}
      </button>
      {/* The approval step is unusual, so it is spelled out before the guest pays. */}
      <ol className="space-y-1.5 rounded-xl bg-navy-900 p-4 text-sm text-navy-200">
        <li><span className="font-semibold text-navy-50">1. You pay now.</span> The full amount, securely through Razorpay.</li>
        <li><span className="font-semibold text-navy-50">2. We confirm within 24 hours.</span> If the resort can&apos;t confirm, you are refunded in full automatically.</li>
      </ol>
      <p className="text-center text-xs text-navy-400">
        <span className="font-semibold text-gold-600">Best rate when you book direct.</span> Please bring a photo ID for every adult at check-in.
      </p>
    </form>
  );
}
