'use client';

import { useState } from 'react';
import api from '../../lib/api';
import EditorialSplit from '../../components/editorial/EditorialSplit';

const CONTACT_IMAGE =
  'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=1200&q=80';
const ADDRESS = 'Chirala Beach Road, Chirala, Andhra Pradesh 523155, India';
const PHONE = '+91 98765 43210';
const EMAIL = 'reservations@gokulamresorts.in';

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
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <EditorialSplit image={CONTACT_IMAGE} imageAlt="Gokulam Resorts front desk">
        <p className="eyebrow">Get in Touch</p>
        <h1 className="section-heading mt-2">Contact Gokulam Resorts</h1>

        <dl className="mt-6 space-y-4">
          <div>
            <dt className="text-sm font-semibold uppercase tracking-wide text-navy-200">Address</dt>
            <dd className="mt-1 text-navy-300">
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(ADDRESS)}`}
                target="_blank" rel="noopener noreferrer"
                className="hover:text-ocean-600"
              >
                {ADDRESS}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold uppercase tracking-wide text-navy-200">Phone</dt>
            <dd className="mt-1 text-navy-300">
              <a href={`tel:${PHONE.replace(/\s/g, '')}`} className="hover:text-ocean-600">{PHONE}</a>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold uppercase tracking-wide text-navy-200">Email</dt>
            <dd className="mt-1 text-navy-300">
              <a href={`mailto:${EMAIL}`} className="hover:text-ocean-600">{EMAIL}</a>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold uppercase tracking-wide text-navy-200">Front Desk Hours</dt>
            <dd className="mt-1 text-navy-300">Open 24 hours, every day</dd>
          </div>
        </dl>
      </EditorialSplit>

      <form onSubmit={handleSubmit} className="card mt-10 mx-auto max-w-xl space-y-4 p-6">
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
  );
}
