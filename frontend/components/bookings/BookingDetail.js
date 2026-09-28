'use client';

import { useCallback, useEffect, useState } from 'react';
import api, { authFor } from '../../lib/api';
import {
  StatusBadge, inr, fmtDate, fmtDateTime, nightsBetween, todayIST, addDays, errMsg, ID_TYPES,
} from '../../lib/bookingUi';

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
];

const ACTION_LABEL = {
  booking_created: 'Booking created',
  payment_captured: 'Online payment received',
  payment_recorded: 'Payment recorded',
  payment_window_expired: 'Payment window expired',
  approval_window_expired: 'Not approved in time — auto-cancelled',
  booking_approved: 'Approved',
  booking_rejected: 'Rejected',
  booking_cancelled: 'Cancelled',
  discount_applied: 'Discount applied',
  discount_removed: 'Discount removed',
  refund_initiated: 'Refund initiated',
  refund_processed: 'Refund completed',
  refund_failed: 'Refund FAILED',
  refund_paid_out: 'Refund paid out at counter',
  id_verified: 'ID verified',
  id_removed: 'ID removed',
  id_viewed: 'ID viewed',
  id_purged: 'ID file deleted (retention)',
  checked_in: 'Checked in',
  stay_extended: 'Stay extended',
  checked_out: 'Checked out',
  no_show: 'Marked no-show',
};

function Section({ title, children, right }) {
  return (
    <section className="border-t border-navy-800 py-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-navy-400">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children, strong }) {
  return (
    <div className="flex justify-between gap-4 py-0.5 text-sm">
      <span className="text-navy-400">{label}</span>
      <span className={strong ? 'font-semibold text-navy-50' : 'text-navy-100'}>{children}</span>
    </div>
  );
}

const btn = 'rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50';

export default function BookingDetail({ bookingId, mode, onClose, onChanged, refreshKey }) {
  const auth = authFor(mode);
  const isAdmin = mode === 'admin';
  const [b, setB] = useState(null);
  const [panel, setPanel] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/desk/bookings/${bookingId}`, auth());
      setB(res.data.booking);
    } catch (err) {
      setError(errMsg(err, 'Could not load booking'));
    }
  }, [bookingId, auth]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const open = (name, initial = {}) => {
    setPanel(panel === name ? null : name);
    setForm(initial);
    setError('');
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const run = async (fn, success) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fn();
      setPanel(null);
      const warnings = res?.data?.warnings;
      setNotice([success, ...(warnings || [])].filter(Boolean).join(' · '));
      await load();
      onChanged?.();
    } catch (err) {
      setError(errMsg(err, 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  };

  const post = (path, body) => api.post(`/desk/bookings/${bookingId}${path}`, body || {}, auth());
  const adminPost = (path, body) => api.post(`/admin/bookings/${bookingId}${path}`, body || {}, auth());

  const viewDocument = async (docId) => {
    const win = window.open('', '_blank'); // open synchronously so popup blockers allow it
    try {
      const res = await api.get(`/admin/documents/${docId}/url`, auth());
      win.location = res.data.url;
      load();
    } catch (err) {
      win.close();
      setError(errMsg(err, 'Could not open document'));
    }
  };

  const uploadDocument = (e) => {
    e.preventDefault();
    const data = new FormData();
    data.append('guestName', form.guestName || '');
    data.append('idType', form.idType || 'Aadhaar');
    data.append('idLast4', form.idLast4 || '');
    data.append('nationality', form.nationality || 'Indian');
    data.append('isPrimary', String(!!form.isPrimary));
    data.append('maskedConfirmed', String(!!form.maskedConfirmed));
    if (form.file) data.append('file', form.file);
    run(
      () => api.post(`/desk/bookings/${bookingId}/documents`, data, auth({ headers: { 'Content-Type': 'multipart/form-data' } })),
      'ID saved'
    );
  };

  if (!b) {
    return (
      <Shell onClose={onClose}>
        <p className="p-6 text-navy-300">{error || 'Loading…'}</p>
      </Shell>
    );
  }

  const today = todayIST();
  const due = Number(b.balance_due);
  const nights = nightsBetween(b.check_in, b.check_out);
  const activeDocs = b.documents.filter((d) => !d.purged_at);
  const hasPrimary = activeDocs.some((d) => d.is_primary);
  const pendingPayouts = b.refunds.filter((r) => r.status === 'pending' && r.method !== 'razorpay');

  // Why check-in is not possible yet (shown on the disabled button).
  const checkInBlock =
    b.status !== 'confirmed' ? null
    : today < b.check_in ? `Opens ${fmtDate(b.check_in)}`
    : due > 0 ? `Collect ${inr(due)} first`
    : !hasPrimary ? 'Add primary guest ID'
    : b.room_status !== 'Ready' ? `Room ${b.room_status.toLowerCase()}`
    : null;

  return (
    <Shell onClose={onClose}>
      <div className="flex items-start justify-between gap-3 px-6 pt-6">
        <div>
          <p className="text-xs text-navy-400">
            Booking #{b.id} · {b.source === 'online' ? 'Online' : 'Counter'} · {fmtDateTime(b.created_at)}
          </p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-navy-50">{b.guest_name}</h2>
          <div className="mt-2">
            <StatusBadge status={b.status} />
          </div>
        </div>
        <button onClick={onClose} className="rounded-full border border-navy-600 px-3 py-1 text-navy-300 hover:text-navy-50" aria-label="Close">
          ✕
        </button>
      </div>

      <div className="px-6 pb-8">
        {b.status === 'paid' && b.hold_expires_at && (
          <p className="mt-3 rounded-lg bg-gold-500/10 px-3 py-2 text-sm text-gold-300">
            Waiting for manager approval — auto-cancels with full refund at {fmtDateTime(b.hold_expires_at)}.
          </p>
        )}
        {b.close_reason && <p className="mt-3 rounded-lg bg-navy-800 px-3 py-2 text-sm text-navy-200">Reason: {b.close_reason}</p>}
        {notice && <p className="mt-3 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-300">{notice}</p>}
        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

        {/* ---------------- Actions ---------------- */}
        <div className="mt-4 flex flex-wrap gap-2">
          {isAdmin && b.status === 'paid' && (
            <>
              <button disabled={busy} onClick={() => run(() => adminPost('/approve'), 'Approved — guest notified')} className={`${btn} bg-green-500 text-navy-950`}>
                Approve
              </button>
              <button disabled={busy} onClick={() => open('reject')} className={`${btn} border border-red-500/60 text-red-300`}>Reject</button>
            </>
          )}
          {b.status === 'confirmed' && (
            <button
              disabled={busy || !!checkInBlock}
              onClick={() => run(() => post('/check-in'), 'Checked in')}
              className={`${btn} bg-gold-500 text-navy-950`}
              title={checkInBlock || ''}
            >
              Check in{checkInBlock ? ` · ${checkInBlock}` : ''}
            </button>
          )}
          {b.status === 'checked_in' && (
            <button
              disabled={busy || due > 0}
              onClick={() => {
                const early = today < b.check_out;
                if (!early || confirm(`Early check-out: the stay ends today instead of ${fmtDate(b.check_out)}. No automatic refund for unused nights. Continue?`)) {
                  run(() => post('/check-out'), 'Checked out — housekeeping notified');
                }
              }}
              className={`${btn} bg-gold-500 text-navy-950`}
            >
              Check out{due > 0 ? ` · collect ${inr(due)}` : ''}
            </button>
          )}
          {['confirmed', 'checked_in'].includes(b.status) && due > 0 && (
            <button disabled={busy} onClick={() => open('payment', { amount: due, method: 'cash' })} className={`${btn} bg-green-500 text-navy-950`}>
              Record payment
            </button>
          )}
          {['confirmed', 'checked_in'].includes(b.status) && (
            <button disabled={busy} onClick={() => open('upload', { idType: 'Aadhaar', isPrimary: !hasPrimary, guestName: hasPrimary ? '' : b.guest_name, nationality: 'Indian' })} className={`${btn} border border-navy-600 text-navy-100`}>
              + Guest ID
            </button>
          )}
          {['confirmed', 'checked_in'].includes(b.status) && (
            <button disabled={busy} onClick={() => open('extend', { checkOut: addDays(b.check_out, 1) })} className={`${btn} border border-navy-600 text-navy-100`}>
              Extend stay
            </button>
          )}
          {b.status === 'confirmed' && today >= b.check_in && (
            <button
              disabled={busy}
              onClick={() => confirm('Mark as no-show? The room is released and the payment is kept (no refund).') && run(() => post('/no-show'), 'Marked no-show')}
              className={`${btn} border border-orange-400/50 text-orange-300`}
            >
              No-show
            </button>
          )}
          {isAdmin && ['paid', 'confirmed', 'checked_in'].includes(b.status) && (
            <button disabled={busy} onClick={() => open('discount', { type: 'percent', value: '' })} className={`${btn} border border-gold-500/50 text-gold-400`}>
              Discount
            </button>
          )}
          {isAdmin && ['pending_payment', 'paid', 'confirmed'].includes(b.status) && (
            <button disabled={busy} onClick={() => open('cancel')} className={`${btn} border border-red-500/40 text-red-300`}>
              Cancel booking
            </button>
          )}
        </div>

        {/* ---------------- Action forms ---------------- */}
        {(panel === 'reject' || panel === 'cancel') && (
          <form
            className="mt-3 space-y-2 rounded-xl border border-red-500/30 bg-red-500/5 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => adminPost(`/${panel}`, { reason: form.reason }), panel === 'reject' ? 'Rejected — refund initiated' : 'Cancelled — refund initiated');
            }}
          >
            <p className="text-sm text-navy-100">
              {panel === 'reject' ? 'Reject' : 'Cancel'} and refund {inr(b.amount_paid)}{' '}
              {b.payments.some((p) => p.method !== 'razorpay') ? '(counter payments are refunded at the desk)' : 'to the original payment method'}.
            </p>
            <input required minLength={3} className="input-field py-2 text-sm" placeholder="Reason (required)" value={form.reason || ''} onChange={set('reason')} />
            <button disabled={busy} className={`${btn} bg-red-500 text-white`}>Confirm {panel}</button>
          </form>
        )}

        {panel === 'discount' && (
          <form
            className="mt-3 space-y-2 rounded-xl border border-gold-500/30 bg-gold-500/5 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => adminPost('/discount', { type: form.type, value: Number(form.value), reason: form.reason }), 'Discount applied');
            }}
          >
            <div className="flex gap-2">
              <select className="input-field w-32 py-2 text-sm" value={form.type} onChange={set('type')}>
                <option value="percent">% off</option>
                <option value="fixed">₹ off</option>
              </select>
              <input required type="number" min="0" step="0.01" max={form.type === 'percent' ? 100 : undefined} className="input-field py-2 text-sm" placeholder={form.type === 'percent' ? 'e.g. 10' : 'e.g. 1500'} value={form.value} onChange={set('value')} />
            </div>
            <input required minLength={3} className="input-field py-2 text-sm" placeholder="Reason (required, logged)" value={form.reason || ''} onChange={set('reason')} />
            <p className="text-xs text-navy-400">
              Replaces any earlier manual discount (0 removes it). Applied after promotions. If the guest already paid more than the new total, the difference is refunded automatically.
            </p>
            <button disabled={busy} className={`${btn} bg-gold-500 text-navy-950`}>Apply discount</button>
          </form>
        )}

        {panel === 'payment' && (
          <form
            className="mt-3 space-y-2 rounded-xl border border-green-500/30 bg-green-500/5 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => post('/payments', { amount: Number(form.amount), method: form.method, reference: form.reference }), 'Payment recorded');
            }}
          >
            <div className="grid grid-cols-2 gap-2">
              <input required type="number" min="1" step="0.01" max={due} className="input-field py-2 text-sm" value={form.amount} onChange={set('amount')} />
              <select className="input-field py-2 text-sm" value={form.method} onChange={set('method')}>
                {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <input required minLength={2} className="input-field py-2 text-sm" placeholder="Reference — receipt no. / UPI UTR / card slip no." value={form.reference || ''} onChange={set('reference')} />
            <button disabled={busy} className={`${btn} bg-green-500 text-navy-950`}>Save payment</button>
          </form>
        )}

        {panel === 'extend' && (
          <form
            className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-navy-600 bg-navy-800/50 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => post('/extend', { checkOut: form.checkOut }), 'Stay extended — collect the new balance');
            }}
          >
            <div>
              <label className="label">New check-out</label>
              <input required type="date" min={addDays(b.check_out, 1)} className="input-field py-2 text-sm" value={form.checkOut} onChange={set('checkOut')} />
            </div>
            <button disabled={busy} className={`${btn} bg-gold-500 text-navy-950`}>Extend</button>
            <p className="w-full text-xs text-navy-400">Extra nights use current rates and promotions and are added as a balance due.</p>
          </form>
        )}

        {panel === 'upload' && (
          <form className="mt-3 space-y-3 rounded-xl border border-navy-600 bg-navy-800/50 p-4" onSubmit={uploadDocument}>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="label">Guest name (as on ID)</label>
                <input required className="input-field py-2 text-sm" value={form.guestName} onChange={set('guestName')} />
              </div>
              <div>
                <label className="label">ID type</label>
                <select className="input-field py-2 text-sm" value={form.idType} onChange={set('idType')}>
                  {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Last 4 characters of ID no.</label>
                <input required maxLength={4} pattern="[A-Za-z0-9]{4}" className="input-field py-2 text-sm tracking-widest" placeholder="1234" value={form.idLast4 || ''} onChange={set('idLast4')} />
              </div>
              <div>
                <label className="label">Nationality</label>
                <input className="input-field py-2 text-sm" value={form.nationality} onChange={set('nationality')} />
              </div>
            </div>
            <div>
              <label className="label">Photo or PDF of the ID (max 5 MB)</label>
              <input
                required type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment"
                className="block w-full text-sm text-navy-200 file:mr-3 file:rounded-lg file:border-0 file:bg-navy-700 file:px-3 file:py-2 file:text-navy-100"
                onChange={(e) => setForm((f) => ({ ...f, file: e.target.files[0] }))}
              />
            </div>
            {form.idType === 'Aadhaar' && (
              <label className="flex items-start gap-2 rounded-lg bg-gold-500/10 p-3 text-sm text-gold-200">
                <input type="checkbox" className="mt-1" checked={!!form.maskedConfirmed} onChange={set('maskedConfirmed')} />
                The first 8 digits are covered in this image — only the last 4 digits are visible (masked Aadhaar).
              </label>
            )}
            <label className="flex items-center gap-2 text-sm text-navy-200">
              <input type="checkbox" checked={!!form.isPrimary} disabled={hasPrimary} onChange={set('isPrimary')} />
              Primary guest {hasPrimary && '(already recorded)'}
            </label>
            <p className="text-xs text-navy-400">
              By saving you confirm you checked the original ID against the guest. The file is stored privately and only managers can open it.
            </p>
            <button disabled={busy || (form.idType === 'Aadhaar' && !form.maskedConfirmed)} className={`${btn} bg-gold-500 text-navy-950`}>
              Save verified ID
            </button>
          </form>
        )}

        {/* ---------------- Details ---------------- */}
        <Section title="Stay">
          <Row label="Room" strong>{b.unit_number} · {b.room_type}{b.view_label ? ` · ${b.view_label}` : ''}</Row>
          <Row label="Dates">{fmtDate(b.check_in)} → {fmtDate(b.check_out)} ({nights} night{nights === 1 ? '' : 's'})</Row>
          {b.original_check_out !== b.check_out && <Row label="Originally until">{fmtDate(b.original_check_out)}</Row>}
          <Row label="Guests">{b.adults} adult{b.adults > 1 ? 's' : ''}{b.children ? `, ${b.children} child${b.children > 1 ? 'ren' : ''}` : ''}</Row>
          <Row label="Housekeeping">{b.room_status}</Row>
          {b.checked_in_at && <Row label="Checked in">{fmtDateTime(b.checked_in_at)}</Row>}
          {b.checked_out_at && <Row label="Checked out">{fmtDateTime(b.checked_out_at)}</Row>}
          {b.cleaningJob && <Row label="Cleaning job">#{b.cleaningJob.id} · {b.cleaningJob.status}</Row>}
        </Section>

        <Section title="Guest">
          <Row label="Phone">{b.guest_phone}</Row>
          {b.guest_email && <Row label="Email">{b.guest_email}</Row>}
          {b.special_requests && <p className="mt-1 text-sm italic text-navy-300">“{b.special_requests}”</p>}
        </Section>

        <Section title="Money">
          <Row label={`Room (${inr(b.nightly_rate)} × ${nights})`}>{inr(b.base_amount)}</Row>
          {Number(b.promo_discount) > 0 && <Row label="Promotions">−{inr(b.promo_discount)}</Row>}
          {Number(b.manual_discount_amount) > 0 && (
            <Row label={`Manager discount (${b.manual_discount_type === 'percent' ? `${Number(b.manual_discount_value)}%` : inr(b.manual_discount_value)})`}>
              −{inr(b.manual_discount_amount)}
            </Row>
          )}
          {b.manual_discount_reason && Number(b.manual_discount_amount) > 0 && <p className="text-right text-xs text-navy-400">“{b.manual_discount_reason}”</p>}
          <Row label="Total" strong>{inr(b.total_amount)}</Row>
          <Row label="Paid (net of refunds)">{inr(b.amount_paid)}</Row>
          <Row label="Balance due" strong>{due > 0 ? <span className="text-red-300">{inr(due)}</span> : inr(0)}</Row>

          {b.payments.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-navy-300">
              {b.payments.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span>
                    + {inr(p.amount)} · {p.method.toUpperCase()} {p.reference ? `· ${p.reference}` : p.razorpay_payment_id ? `· ${p.razorpay_payment_id}` : ''}
                    {p.recorded_by ? ` · ${p.recorded_by}` : ''}
                  </span>
                  <span className="text-navy-500">{fmtDateTime(p.captured_at || p.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
          {b.refunds.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {b.refunds.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-navy-300">
                  <span>
                    − {inr(r.amount)} refund · {r.method.toUpperCase()} ·{' '}
                    <span className={r.status === 'failed' ? 'text-red-300' : r.status === 'pending' ? 'text-gold-400' : 'text-green-300'}>{r.status}</span>
                    {r.reference ? ` · ${r.reference}` : ''} — {r.reason}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {pendingPayouts.map((r) => (
            <PayoutForm key={r.id} refund={r} auth={auth} onDone={() => { setNotice('Refund payout recorded'); load(); onChanged?.(); }} onError={setError} />
          ))}
        </Section>

        <Section title={`Guest IDs (${activeDocs.length} of ${b.adults} adult${b.adults > 1 ? 's' : ''})`}>
          {b.documents.length === 0 && <p className="text-sm text-navy-500">None yet. At least the primary guest's ID is needed to check in.</p>}
          <ul className="space-y-2">
            {b.documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-navy-800 px-3 py-2 text-sm">
                <span className="text-navy-100">
                  {d.guest_name}
                  {d.is_primary && <span className="ml-2 rounded bg-gold-500/15 px-1.5 text-[10px] uppercase text-gold-400">Primary</span>}
                  <span className="block text-xs text-navy-400">
                    {ID_TYPES.find((t) => t.value === d.id_type)?.label.replace(' (masked)', '')} ····{d.id_last4} · {d.nationality} · verified by {d.verified_by} {fmtDateTime(d.verified_at)}
                    {d.purged_at && ` · file deleted ${fmtDate(d.purged_at)}`}
                  </span>
                </span>
                <span className="flex gap-2">
                  {isAdmin && !d.purged_at && (
                    <button onClick={() => viewDocument(d.id)} className="text-xs text-gold-400 underline">View</button>
                  )}
                  {b.status === 'confirmed' && (
                    <button
                      onClick={() => confirm('Remove this ID?') && run(() => api.delete(`/desk/bookings/${b.id}/documents/${d.id}`, auth()), 'ID removed')}
                      className="text-xs text-red-300 underline"
                    >
                      Remove
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="History">
          <ol className="space-y-1.5 text-xs">
            {b.events.map((e) => (
              <li key={e.id} className="flex justify-between gap-3">
                <span className="text-navy-200">
                  {ACTION_LABEL[e.action] || e.action}
                  <span className="text-navy-500"> · {e.actor_name}</span>
                  {e.details?.reason && <span className="text-navy-400"> — {e.details.reason}</span>}
                  {e.action === 'stay_extended' && <span className="text-navy-400"> — to {fmtDate(e.details.to)}</span>}
                  {e.details?.amount && ['refund_initiated', 'payment_recorded', 'payment_captured'].includes(e.action) && (
                    <span className="text-navy-400"> — {inr(e.details.amount)}</span>
                  )}
                </span>
                <span className="whitespace-nowrap text-navy-500">{fmtDateTime(e.created_at)}</span>
              </li>
            ))}
          </ol>
          {b.notifications.length > 0 && (
            <p className="mt-3 text-xs text-navy-500">
              Messages: {[...new Set(b.notifications.map((n) => n.template.replace(/_/g, ' ')))].join(', ')} (SMS / WhatsApp{b.guest_email ? ' / email' : ''})
            </p>
          )}
        </Section>
      </div>
    </Shell>
  );
}

function PayoutForm({ refund, auth, onDone, onError }) {
  const [method, setMethod] = useState(refund.method);
  const [reference, setReference] = useState('');
  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-gold-500/40 bg-gold-500/5 p-3 text-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api.post(`/desk/refunds/${refund.id}/complete`, { method, reference }, auth());
          onDone();
        } catch (err) {
          onError(errMsg(err, 'Could not record payout'));
        }
      }}
    >
      <span className="text-gold-300">Pay back {inr(refund.amount)}:</span>
      <select className="rounded border border-navy-600 bg-navy-800 px-2 py-1" value={method} onChange={(e) => setMethod(e.target.value)}>
        {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
      <input required minLength={2} className="flex-1 rounded border border-navy-600 bg-navy-800 px-2 py-1" placeholder="Reference" value={reference} onChange={(e) => setReference(e.target.value)} />
      <button className="rounded bg-gold-500 px-3 py-1 font-medium text-navy-950">Paid out</button>
    </form>
  );
}

function Shell({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/60" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-navy-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
