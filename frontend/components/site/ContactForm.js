'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { errMsg, fmtDate, todayIST, addDays } from '@/lib/bookingUi';
import PhoneInput from './PhoneInput';

const REASONS = ['Stay', 'Event', 'Wedding', 'Other'];
// `website` is a decoy: hidden from people, filled in by form-spam bots.
const empty = { name: '', email: '', phone: '', reason: 'Stay', checkIn: '', checkOut: '', message: '', website: '' };

export default function ContactForm() {
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null); // what was sent, for the confirmation

  // /contact?reason=Wedding preselects the reason.
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get('reason');
    if (REASONS.includes(r)) setForm((f) => ({ ...f, reason: r }));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const today = todayIST();

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
        checkOut: form.checkOut || undefined,
      });
      setSent(form);
      setStatus('sent');
      setForm(empty);
    } catch (err) {
      setStatus('error');
      setError(errMsg(err, 'Could not send your message. Please try again.'));
    }
  };

  if (status === 'sent' && sent) {
    return (
      <div className="card space-y-4 p-6 sm:p-8" role="status">
        <p className="eyebrow">Message sent</p>
        <h2 className="font-serif text-2xl font-semibold text-navy-50">Thank you, {sent.name.split(' ')[0]}</h2>
        <p className="text-navy-300">We&apos;ll get back to you shortly at {sent.email}.</p>
        <dl className="space-y-2 rounded-xl bg-navy-900 p-4 text-sm">
          <div className="flex gap-3"><dt className="w-20 flex-none text-navy-400">About</dt><dd className="text-navy-100">{sent.reason}</dd></div>
          {sent.checkIn && (
            <div className="flex gap-3">
              <dt className="w-20 flex-none text-navy-400">Dates</dt>
              <dd className="text-navy-100">{fmtDate(sent.checkIn)}{sent.checkOut ? ` → ${fmtDate(sent.checkOut)}` : ''}</dd>
            </div>
          )}
          <div className="flex gap-3"><dt className="w-20 flex-none text-navy-400">Message</dt><dd className="whitespace-pre-line text-navy-100">{sent.message}</dd></div>
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
          {REASONS.map((r) => (
            <label key={r} className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ocean-400 has-[:focus-visible]:ring-offset-2 ${form.reason === r ? 'border-ocean-500 bg-ocean-500 text-white' : 'border-navy-700 text-navy-200'}`}>
              <input type="radio" name="reason" value={r} checked={form.reason === r} onChange={set('reason')} className="sr-only" />
              {r}
            </label>
          ))}
        </div>
      </fieldset>

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
          <label className="label" htmlFor="c-in">{form.reason === 'Stay' ? 'Check-in' : 'From'} (optional)</label>
          <input id="c-in" type="date" min={today} className="input-field px-3" value={form.checkIn} onChange={(e) => setForm((f) => ({ ...f, checkIn: e.target.value, checkOut: f.checkOut && f.checkOut > e.target.value ? f.checkOut : '' }))} />
        </div>
        <div>
          <label className="label" htmlFor="c-out">{form.reason === 'Stay' ? 'Check-out' : 'To'} (optional)</label>
          <input id="c-out" type="date" min={form.checkIn ? addDays(form.checkIn, 1) : today} className="input-field px-3" value={form.checkOut} onChange={set('checkOut')} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="c-msg">Message</label>
        <textarea id="c-msg" rows={4} required minLength={5} maxLength={2000} className="input-field" value={form.message} onChange={set('message')} placeholder={form.reason === 'Wedding' ? 'Guest count, preferred dates, anything you have in mind…' : ''} />
      </div>

      {/* Decoy field for spam bots: off-screen, skipped by the keyboard and by screen readers. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="c-website">Website</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
      </div>

      {status === 'error' && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={status === 'sending'} className="btn-gold w-full disabled:opacity-60">
        {status === 'sending' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
