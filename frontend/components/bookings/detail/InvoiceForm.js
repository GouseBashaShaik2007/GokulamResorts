'use client';

import { useState } from 'react';
import { btn } from './parts';

/**
 * Before the GST invoice is printed: is it for the guest, or for a company
 * that will claim the tax back? A company needs its name and GSTIN on it.
 * `b`: the booking. `onSubmit({ billingName, billingGstin })` prints.
 */
export default function InvoiceForm({ b, busy, onSubmit }) {
  const [form, setForm] = useState({ billingName: b.billing_name || '', billingGstin: b.billing_gstin || '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form
      className="mt-3 space-y-2 rounded-xl border border-sand-400 bg-sand-200 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ billingName: form.billingName.trim(), billingGstin: form.billingGstin.trim().toUpperCase() });
      }}
    >
      <p className="text-sm font-medium text-ink-900">
        {b.invoice_number ? `Invoice ${b.invoice_number}` : 'GST invoice'}
      </p>
      <p className="text-xs text-ink-500">
        Made out to {b.guest_name}. If a company is paying, add its name and GSTIN; otherwise leave both empty.
      </p>
      <input className="input-field py-2 text-sm" aria-label="Company name (optional)" placeholder="Company name (optional)" maxLength={150} value={form.billingName} onChange={set('billingName')} />
      <input
        className="input-field py-2 text-sm uppercase"
        aria-label="Company GSTIN (optional)"
        placeholder="Company GSTIN (optional), e.g. 37ABCDE1234F1Z5"
        maxLength={15}
        pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][A-Za-z0-9][Zz][A-Za-z0-9]"
        title="15 characters, for example 37ABCDE1234F1Z5"
        value={form.billingGstin}
        onChange={set('billingGstin')}
      />
      <p className="text-xs text-ink-400">
        {b.invoice_number
          ? 'Printing again uses the same invoice number.'
          : 'The booking gets its invoice number now, the next one in this year’s series.'}
      </p>
      <button disabled={busy} className={`${btn} bg-ocean-500 text-white`}>Print invoice</button>
    </form>
  );
}
