'use client';

import { useState } from 'react';
import { inr, addDays, ID_TYPES } from '../../../lib/bookingUi';
import { METHODS, btn } from './parts';

// The forms that open under the action buttons. Each keeps its own fields (so
// nothing typed in one can leak into another) and starts fresh every time it
// is opened. `onSubmit` receives the values; `busy` is true while one is saving.

/** Manager: reject a paid booking, or cancel one. `kind`: 'reject' | 'cancel'. */
export function RejectCancelForm({ kind, b, busy, onSubmit }) {
  const [reason, setReason] = useState('');
  return (
    <form
      className="mt-3 space-y-2 rounded-xl border border-red-500/30 bg-red-500/5 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(reason);
      }}
    >
      <p className="text-sm text-navy-100">
        {kind === 'reject' ? 'Reject' : 'Cancel'} and refund {inr(b.amount_paid)}{' '}
        {b.payments.some((p) => p.method !== 'razorpay') ? '(counter payments are refunded at the desk)' : 'to the original payment method'}.
      </p>
      <input required minLength={3} className="input-field py-2 text-sm" aria-label="Reason" placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button disabled={busy} className={`${btn} bg-red-600 text-white`}>Confirm {kind}</button>
    </form>
  );
}

/** Manager: a one-off discount on this booking. */
export function DiscountForm({ busy, onSubmit }) {
  const [form, setForm] = useState({ type: 'percent', value: '', reason: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form
      className="mt-3 space-y-2 rounded-xl border border-gold-500/30 bg-gold-500/5 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ type: form.type, value: Number(form.value), reason: form.reason });
      }}
    >
      <div className="flex gap-2">
        <select className="input-field w-32 py-2 text-sm" aria-label="Discount type" value={form.type} onChange={set('type')}>
          <option value="percent">% off</option>
          <option value="fixed">₹ off</option>
        </select>
        <input required type="number" min="0" step="0.01" max={form.type === 'percent' ? 100 : undefined} className="input-field py-2 text-sm" aria-label="Discount value" placeholder={form.type === 'percent' ? 'e.g. 10' : 'e.g. 1500'} value={form.value} onChange={set('value')} />
      </div>
      <input required minLength={3} className="input-field py-2 text-sm" aria-label="Reason" placeholder="Reason (required, logged)" value={form.reason} onChange={set('reason')} />
      <p className="text-xs text-navy-400">
        Replaces any earlier manual discount (0 removes it). Applied after promotions. If the guest already paid more than the new total, the difference is refunded automatically.
      </p>
      <button disabled={busy} className={`${btn} bg-ocean-500 text-white`}>Apply discount</button>
    </form>
  );
}

/** Record money taken at the counter, up to the balance `due`. */
export function PaymentForm({ due, busy, onSubmit }) {
  const [form, setForm] = useState({ amount: due, method: 'cash', reference: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form
      className="mt-3 space-y-2 rounded-xl border border-green-500/30 bg-green-500/5 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ amount: Number(form.amount), method: form.method, reference: form.reference });
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <input required type="number" min="1" step="0.01" max={due} className="input-field py-2 text-sm" aria-label="Amount" value={form.amount} onChange={set('amount')} />
        <select className="input-field py-2 text-sm" aria-label="Payment method" value={form.method} onChange={set('method')}>
          {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      <input required minLength={2} className="input-field py-2 text-sm" aria-label="Payment reference" placeholder="Reference — receipt no. / UPI UTR / card slip no." value={form.reference} onChange={set('reference')} />
      <button disabled={busy} className={`${btn} bg-green-700 text-white`}>Save payment</button>
    </form>
  );
}

/** Move the check-out date later. */
export function ExtendForm({ b, busy, onSubmit }) {
  const [checkOut, setCheckOut] = useState(addDays(b.check_out, 1));
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-navy-600 bg-navy-800/50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(checkOut);
      }}
    >
      <div>
        <label className="label">New check-out</label>
        <input aria-label="New check-out" required type="date" min={addDays(b.check_out, 1)} className="input-field py-2 text-sm" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
      </div>
      <button disabled={busy} className={`${btn} bg-ocean-500 text-white`}>Extend</button>
      <p className="w-full text-xs text-navy-400">Extra nights use current rates and promotions and are added as a balance due.</p>
    </form>
  );
}

/** Add a guest's verified ID. `onSubmit` receives the FormData to upload. */
export function IdUploadForm({ b, hasPrimary, busy, onSubmit }) {
  const [form, setForm] = useState({
    guestName: hasPrimary ? '' : b.guest_name,
    idType: 'Aadhaar',
    idLast4: '',
    nationality: 'Indian',
    isPrimary: !hasPrimary,
    maskedConfirmed: false,
    file: null,
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const data = new FormData();
    data.append('guestName', form.guestName || '');
    data.append('idType', form.idType || 'Aadhaar');
    data.append('idLast4', form.idLast4 || '');
    data.append('nationality', form.nationality || 'Indian');
    data.append('isPrimary', String(!!form.isPrimary));
    data.append('maskedConfirmed', String(!!form.maskedConfirmed));
    if (form.file) data.append('file', form.file);
    onSubmit(data);
  };

  return (
    <form className="mt-3 space-y-3 rounded-xl border border-navy-600 bg-navy-800/50 p-4" onSubmit={submit}>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="label">Guest name (as on ID)</label>
          <input aria-label="Guest name (as on ID)" required className="input-field py-2 text-sm" value={form.guestName} onChange={set('guestName')} />
        </div>
        <div>
          <label className="label">ID type</label>
          <select aria-label="ID type" className="input-field py-2 text-sm" value={form.idType} onChange={set('idType')}>
            {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Last 4 characters of ID no.</label>
          <input aria-label="Last 4 characters of ID no." required maxLength={4} pattern="[A-Za-z0-9]{4}" className="input-field py-2 text-sm tracking-widest" placeholder="1234" value={form.idLast4} onChange={set('idLast4')} />
        </div>
        <div>
          <label className="label">Nationality</label>
          <input aria-label="Nationality" className="input-field py-2 text-sm" value={form.nationality} onChange={set('nationality')} />
        </div>
      </div>
      <div>
        <label className="label">Photo or PDF of the ID (max 5 MB)</label>
        <input aria-label="Photo or PDF of the ID (max 5 MB)"
          required type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
          className="block w-full text-sm text-navy-200 file:mr-3 file:rounded-lg file:border-0 file:bg-navy-700 file:px-3 file:py-2 file:text-navy-100"
          onChange={(e) => setForm((f) => ({ ...f, file: e.target.files[0] }))}
        />
      </div>
      {form.idType === 'Aadhaar' && (
        <label className="flex items-start gap-2 rounded-lg bg-gold-500/10 p-3 text-sm text-gold-800">
          <input type="checkbox" className="mt-1" checked={form.maskedConfirmed} onChange={set('maskedConfirmed')} />
          The first 8 digits are covered in this image — only the last 4 digits are visible (masked Aadhaar).
        </label>
      )}
      <label className="flex items-center gap-2 text-sm text-navy-200">
        <input type="checkbox" checked={form.isPrimary} disabled={hasPrimary} onChange={set('isPrimary')} />
        Primary guest {hasPrimary && '(already recorded)'}
      </label>
      <p className="text-xs text-navy-400">
        By saving you confirm you checked the original ID against the guest. The file is stored privately and only managers can open it.
      </p>
      <button disabled={busy || (form.idType === 'Aadhaar' && !form.maskedConfirmed)} className={`${btn} bg-ocean-500 text-white`}>
        Save verified ID
      </button>
    </form>
  );
}
