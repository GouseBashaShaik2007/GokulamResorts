'use client';

import { useState } from 'react';
import api from '../../lib/api';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setError('');
    try {
      await api.post('/contact', form);
      setStatus('sent');
      setForm({ name: '', email: '', message: '' });
    } catch (err) {
      setStatus('error');
      setError(err?.response?.data?.message || 'Could not send your message. Please try again.');
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <p className="eyebrow">Get in Touch</p>
        <h1 className="section-heading mt-2">Contact Gokulam Resorts</h1>
      </div>

      <div className="grid gap-10 md:grid-cols-2">
        <div className="card space-y-4 p-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-200">Address</h3>
            <p className="mt-1 text-navy-300">Chirala Beach Road, Chirala, Andhra Pradesh 523155, India</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-200">Phone</h3>
            <p className="mt-1 text-navy-300">+91 98765 43210</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-200">Email</h3>
            <p className="mt-1 text-navy-300">reservations@gokulamresorts.in</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-200">Front Desk Hours</h3>
            <p className="mt-1 text-navy-300">Open 24 hours, every day</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input id="name" name="name" required className="input-field" value={form.name} onChange={handleChange} />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="input-field" value={form.email} onChange={handleChange} />
          </div>
          <div>
            <label className="label" htmlFor="message">Message</label>
            <textarea id="message" name="message" rows={4} required className="input-field" value={form.message} onChange={handleChange} />
          </div>

          {status === 'sent' && (
            <p className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-300">
              Message sent! We&apos;ll get back to you shortly.
            </p>
          )}
          {status === 'error' && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
          )}

          <button type="submit" disabled={status === 'sending'} className="btn-gold w-full disabled:opacity-60">
            {status === 'sending' ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>
    </div>
  );
}
