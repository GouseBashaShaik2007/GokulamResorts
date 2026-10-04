'use client';

import { useEffect, useState } from 'react';
import { telHref, whatsappUrl } from '@/lib/site';
import { useContact } from '../site/ContactContext';
import PhoneInput from '../site/PhoneInput';

// Supporting text beside the form: what the page is for, and who to contact to change a booking.
function LookupHelp() {
  const contact = useContact();
  const wa = whatsappUrl('', contact);
  const tel = telHref(contact);
  return (
    <aside className="space-y-3 text-sm text-navy-300 lg:pt-10">
      <h2 className="font-serif text-xl font-semibold text-navy-50">What you can do here</h2>
      <p>See whether your booking is confirmed, check your dates, room number and what you paid, track a refund, and get directions.</p>
      <p>
        To change dates or cancel, contact the resort{wa ? ' on WhatsApp' : ''} at{' '}
        {tel ? <a className="text-ocean-600 underline" href={tel}>{contact.phone}</a> : <a className="text-ocean-600 underline" href={`mailto:${contact.email}`}>{contact.email}</a>}.
      </p>
      <p className="text-navy-400">Your reference is in the SMS / WhatsApp we sent after booking.</p>
    </aside>
  );
}

/**
 * Asks for a booking reference and the mobile number it was made with.
 * `onLookup(reference, phone)` runs the search; `error` is its last failure.
 */
export default function LookupForm({ initialRef = '', initialPhone = '', intro = '', loading, error, onLookup }) {
  const [form, setForm] = useState({ ref: initialRef, phone: initialPhone });

  // A link from an SMS already carries the reference; the phone is all that is left to type.
  useEffect(() => {
    if (initialRef) document.getElementById('lookupPhone')?.focus();
  }, [initialRef]);

  return (
    <div className="grid gap-10 lg:grid-cols-[3fr_2fr]">
      <div className="card p-8">
        <p className="eyebrow">My Booking</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-navy-50">Find your booking</h1>
        {intro && <p className="mt-2 text-sm text-navy-300">{intro}</p>}
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onLookup(form.ref.trim().toUpperCase(), form.phone);
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
      <LookupHelp />
    </div>
  );
}
