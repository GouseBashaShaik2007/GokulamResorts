'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { errMsg, fmtDate, todayIST, addDays } from '@/lib/bookingUi';
import { CONTACT_REASONS } from '@/lib/contactReasons';
import OpenBookingButton from '../booking/OpenBookingButton';
import PhoneInput from './PhoneInput';

// What each reason asks for beyond name and message.
//   dates: labels for the two date fields, or `day` for a single date
//   party: label for "how many people", where that is the first thing we need
//   budget: whether to ask what they plan to spend (never required)
const REASON = {
  Stay: { dates: ['Check-in', 'Check-out'] },
  Dining: { day: 'Date', party: 'How many people' },
  Event: { dates: ['From', 'To'], party: 'Number of guests', budget: true },
  Wedding: { dates: ['From', 'To'], party: 'Number of guests', budget: true, placeholder: 'Ceremonies you are planning, rooms needed for family, anything you have in mind…' },
  Other: { dates: ['From', 'To'] },
};

// `website` is a decoy: hidden from people, filled in by form-spam bots.
const empty = { name: '', email: '', phone: '', reason: 'Stay', checkIn: '', checkOut: '', guests: '', budget: '', message: '', website: '' };

/** `initialReason`: the reason to open on (the page reads it from /contact?reason=…). */
export default function ContactForm({ initialReason }) {
  const [form, setForm] = useState({ ...empty, reason: initialReason || empty.reason });
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null); // what was sent, for the confirmation

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const today = todayIST();
  const needs = REASON[form.reason];

  const submit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setError('');
    try {
      await api.post('/contact', {
        ...form,
        // The phone field always carries a country code; only send a real number.
        phone: /\d{6,}/.test(form.phone) ? form.phone : undefined,
        checkIn: form.checkIn || undefined,
        checkOut: (!needs.day && form.checkOut) || undefined,
        guests: needs.party && form.guests ? Number(form.guests) : undefined,
        budget: (needs.budget && form.budget.trim()) || undefined,
      });
      setSent(form);
      setStatus('sent');
      setForm({ ...empty, reason: form.reason });
    } catch (err) {
      setStatus('error');
      setError(errMsg(err, 'Could not send your message. Please try again.'));
    }
  };

  if (status === 'sent' && sent) {
    const sentNeeds = REASON[sent.reason];
    return (
      <div className="card space-y-4 p-6 sm:p-8" role="status">
        <p className="eyebrow">Message sent</p>
        <h2 className="font-serif text-2xl font-semibold text-ink-900">Thank you, {sent.name.split(' ')[0]}</h2>
        <p className="text-ink-500">We&apos;ll get back to you shortly at {sent.email}.</p>
        <dl className="space-y-2 rounded-xl bg-sand-100 p-4 text-sm">
          <div className="flex gap-3"><dt className="w-20 flex-none text-ink-400">About</dt><dd className="text-ink-800">{sent.reason}</dd></div>
          {sent.checkIn && (
            <div className="flex gap-3">
              <dt className="w-20 flex-none text-ink-400">{sentNeeds.day ? 'Date' : 'Dates'}</dt>
              <dd className="text-ink-800">{fmtDate(sent.checkIn)}{!sentNeeds.day && sent.checkOut ? ` → ${fmtDate(sent.checkOut)}` : ''}</dd>
            </div>
          )}
          {sentNeeds.party && sent.guests && (
            <div className="flex gap-3"><dt className="w-20 flex-none text-ink-400">People</dt><dd className="text-ink-800">{sent.guests}</dd></div>
          )}
          {sentNeeds.budget && sent.budget.trim() && (
            <div className="flex gap-3"><dt className="w-20 flex-none text-ink-400">Budget</dt><dd className="text-ink-800">{sent.budget}</dd></div>
          )}
          <div className="flex gap-3"><dt className="w-20 flex-none text-ink-400">Message</dt><dd className="whitespace-pre-line text-ink-800">{sent.message}</dd></div>
        </dl>
        <button type="button" onClick={() => setStatus('idle')} className="btn-outline">Send another message</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6 sm:p-8">
      <fieldset>
        <legend className="label">What is it about?</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {CONTACT_REASONS.map((r) => (
            <label key={r} className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ocean-400 has-[:focus-visible]:ring-offset-2 ${form.reason === r ? 'border-ocean-500 bg-ocean-500 text-white' : 'border-sand-300 text-ink-700'}`}>
              <input type="radio" name="reason" value={r} checked={form.reason === r} onChange={set('reason')} className="sr-only" />
              {r}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Whether a room is free, and what it costs, is answered at once by the booking panel. */}
      {form.reason === 'Stay' && (
        <p className="rounded-xl bg-sand-100 px-4 py-3 text-sm text-ink-700">
          Want to know if a room is free for your dates, and the price?{' '}
          <OpenBookingButton className="font-semibold text-ocean-600 underline underline-offset-2">Check availability now</OpenBookingButton>
          {' '}— it answers straight away. For anything else about a stay, write to us below.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="c-name">Name</label>
          <input id="c-name" required autoComplete="name" className="input-field" value={form.name} onChange={set('name')} />
        </div>
        <div>
          <label className="label" htmlFor="c-email">Email</label>
          <input id="c-email" type="email" required autoComplete="email" className="input-field" value={form.email} onChange={set('email')} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="c-phone">Phone (optional)</label>
          <PhoneInput id="c-phone" value={form.phone} onChange={(phone) => setForm((f) => ({ ...f, phone }))} />
        </div>
        {/* Dates get a row of their own: side by side with the phone they were too narrow to show a year. */}
        <div>
          <label className="label" htmlFor="c-in">{needs.day || needs.dates[0]} (optional)</label>
          <input id="c-in" type="date" min={today} className="input-field px-3" value={form.checkIn} onChange={(e) => setForm((f) => ({ ...f, checkIn: e.target.value, checkOut: f.checkOut && f.checkOut > e.target.value ? f.checkOut : '' }))} />
        </div>
        {needs.dates && (
          <div>
            <label className="label" htmlFor="c-out">{needs.dates[1]} (optional)</label>
            <input id="c-out" type="date" min={form.checkIn ? addDays(form.checkIn, 1) : today} className="input-field px-3" value={form.checkOut} onChange={set('checkOut')} />
          </div>
        )}
        {needs.party && (
          <div className={needs.dates && !needs.budget ? 'sm:col-span-2' : ''}>
            <label className="label" htmlFor="c-guests">{needs.party} (optional)</label>
            <input id="c-guests" type="number" inputMode="numeric" min={1} max={5000} className="input-field" value={form.guests} onChange={set('guests')} />
          </div>
        )}
        {needs.budget && (
          <div>
            <label className="label" htmlFor="c-budget">Budget (optional)</label>
            <input id="c-budget" maxLength={100} className="input-field" placeholder="e.g. around ₹5 lakh" value={form.budget} onChange={set('budget')} />
          </div>
        )}
      </div>

      <div>
        <label className="label" htmlFor="c-msg">Message</label>
        <textarea id="c-msg" rows={4} required minLength={5} maxLength={2000} className="input-field" value={form.message} onChange={set('message')} placeholder={needs.placeholder || ''} />
      </div>

      {/* Decoy field for spam bots: off-screen, skipped by the keyboard and by screen readers. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="c-website">Website</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
      </div>

      {status === 'error' && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={status === 'sending'} className="btn-primary w-full disabled:opacity-60">
        {status === 'sending' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
