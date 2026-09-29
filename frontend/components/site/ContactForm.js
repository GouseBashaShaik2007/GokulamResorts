'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { errMsg, todayIST, addDays } from '@/lib/bookingUi';

const REASONS = ['Stay', 'Event', 'Wedding', 'Other'];
const empty = { name: '', email: '', phone: '', reason: 'Stay', checkIn: '', checkOut: '', message: '' };

export default function ContactForm() {
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');

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
        phone: form.phone || undefined,
        checkIn: form.checkIn || undefined,
        checkOut: form.checkOut || undefined,
      });
      setStatus('sent');
      setForm(empty);
    } catch (err) {
      setStatus('error');
      setError(errMsg(err, 'Could not send your message. Please try again.'));
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-6 sm:p-8">
      <fieldset>
        <legend className="label">What is it about?</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <label key={r} className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm ${form.reason === r ? 'border-ocean-500 bg-ocean-500 text-white' : 'border-navy-700 text-navy-200'}`}>
              <input type="radio" name="reason" value={r} checked={form.reason === r} onChange={set('reason')} className="sr-only" />
              {r}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="c-name">Name</label>
          <input id="c-name" required className="input-field" value={form.name} onChange={set('name')} />
        </div>
        <div>
          <label className="label" htmlFor="c-email">Email</label>
          <input id="c-email" type="email" required className="input-field" value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label className="label" htmlFor="c-phone">Phone (optional)</label>
          <input id="c-phone" type="tel" className="input-field" value={form.phone} onChange={set('phone')} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="c-in">{form.reason === 'Stay' ? 'Check-in' : 'From'}</label>
            <input id="c-in" type="date" min={today} className="input-field px-3" value={form.checkIn} onChange={(e) => setForm((f) => ({ ...f, checkIn: e.target.value, checkOut: f.checkOut && f.checkOut > e.target.value ? f.checkOut : '' }))} />
          </div>
          <div>
            <label className="label" htmlFor="c-out">{form.reason === 'Stay' ? 'Check-out' : 'To'}</label>
            <input id="c-out" type="date" min={form.checkIn ? addDays(form.checkIn, 1) : today} className="input-field px-3" value={form.checkOut} onChange={set('checkOut')} />
          </div>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="c-msg">Message</label>
        <textarea id="c-msg" rows={4} required className="input-field" value={form.message} onChange={set('message')} placeholder={form.reason === 'Wedding' ? 'Guest count, preferred dates, anything you have in mind…' : ''} />
      </div>

      {status === 'sent' && (
        <p className="rounded-lg border border-green-600/40 bg-green-600/10 px-4 py-3 text-sm text-green-800">Message sent — we&apos;ll get back to you shortly.</p>
      )}
      {status === 'error' && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={status === 'sending'} className="btn-gold w-full disabled:opacity-60">
        {status === 'sending' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
