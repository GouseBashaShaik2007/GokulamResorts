'use client';

import { useState } from 'react';
import api from '../../../lib/api';
import { inr, fmtDate, fmtDateTime, errMsg, ID_TYPES } from '../../../lib/bookingUi';
import { METHODS, Row, Section } from './parts';

// The read-only parts of the booking detail panel. `b` is the full booking
// from GET /desk/bookings/:id.

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

export function StaySection({ b, nights }) {
  return (
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
  );
}

export function GuestSection({ b }) {
  return (
    <Section title="Guest">
      <Row label="Phone">{b.guest_phone}</Row>
      {b.guest_email && <Row label="Email">{b.guest_email}</Row>}
      {b.special_requests && <p className="mt-1 text-sm italic text-ink-500">“{b.special_requests}”</p>}
    </Section>
  );
}

// A refund owed in cash / UPI / card: the desk records paying it back.
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
      <span className="text-gold-700">Pay back {inr(refund.amount)}:</span>
      <select className="rounded border border-sand-400 bg-sand-200 px-2 py-1" aria-label="Refund method" value={method} onChange={(e) => setMethod(e.target.value)}>
        {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
      <input required minLength={2} className="flex-1 rounded border border-sand-400 bg-sand-200 px-2 py-1" aria-label="Refund reference" placeholder="Reference" value={reference} onChange={(e) => setReference(e.target.value)} />
      <button className="rounded bg-ocean-500 px-3 py-1 font-medium text-white">Paid out</button>
    </form>
  );
}

/** Price breakdown, payments, refunds and any refund the desk still has to pay out. */
export function MoneySection({ b, nights, due, auth, onPayoutDone, onError }) {
  const pendingPayouts = b.refunds.filter((r) => r.status === 'pending' && r.method !== 'razorpay');
  return (
    <Section title="Money">
      <Row label={`Room (${inr(b.nightly_rate)} × ${nights})`}>{inr(b.base_amount)}</Row>
      {Number(b.promo_discount) > 0 && <Row label="Promotions">−{inr(b.promo_discount)}</Row>}
      {Number(b.manual_discount_amount) > 0 && (
        <Row label={`Manager discount (${b.manual_discount_type === 'percent' ? `${Number(b.manual_discount_value)}%` : inr(b.manual_discount_value)})`}>
          −{inr(b.manual_discount_amount)}
        </Row>
      )}
      {b.manual_discount_reason && Number(b.manual_discount_amount) > 0 && <p className="text-right text-xs text-ink-400">“{b.manual_discount_reason}”</p>}
      {(b.tax_details || []).map((t) => (
        <Row key={t.rate} label={`GST ${t.rate}% (${t.nights} night${t.nights > 1 ? 's' : ''})`}>{inr(t.tax)}</Row>
      ))}
      <Row label={Number(b.tax_amount) > 0 ? 'Total incl. GST' : 'Total'} strong>{inr(b.total_amount)}</Row>
      <Row label="Paid (net of refunds)">{inr(b.amount_paid)}</Row>
      <Row label="Balance due" strong>{due > 0 ? <span className="text-red-700">{inr(due)}</span> : inr(0)}</Row>

      {b.payments.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-ink-500">
          {b.payments.map((p) => (
            <li key={p.id} className="flex justify-between gap-2">
              <span>
                + {inr(p.amount)} · {p.method.toUpperCase()} {p.reference ? `· ${p.reference}` : p.razorpay_payment_id ? `· ${p.razorpay_payment_id}` : ''}
                {p.recorded_by ? ` · ${p.recorded_by}` : ''}
              </span>
              <span className="text-ink-400">{fmtDateTime(p.captured_at || p.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
      {b.refunds.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {b.refunds.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-ink-500">
              <span>
                − {inr(r.amount)} refund · {r.method.toUpperCase()} ·{' '}
                <span className={r.status === 'failed' ? 'text-red-700' : r.status === 'pending' ? 'text-gold-600' : 'text-green-700'}>{r.status}</span>
                {r.reference ? ` · ${r.reference}` : ''} — {r.reason}
              </span>
            </li>
          ))}
        </ul>
      )}
      {pendingPayouts.map((r) => (
        <PayoutForm key={r.id} refund={r} auth={auth} onDone={onPayoutDone} onError={onError} />
      ))}
    </Section>
  );
}

/** Guest IDs on file. `onView` (managers only) opens one; `onRemove` deletes one before check-in. */
export function DocumentsSection({ b, onView, onRemove }) {
  const activeDocs = b.documents.filter((d) => !d.purged_at);
  return (
    <Section title={`Guest IDs (${activeDocs.length} of ${b.adults} adult${b.adults > 1 ? 's' : ''})`}>
      {b.documents.length === 0 && <p className="text-sm text-ink-400">None yet. At least the primary guest&apos;s ID is needed to check in.</p>}
      <ul className="space-y-2">
        {b.documents.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sand-200 px-3 py-2 text-sm">
            <span className="text-ink-800">
              {d.guest_name}
              {d.is_primary && <span className="ml-2 rounded bg-gold-500/15 px-1.5 text-[10px] uppercase text-gold-600">Primary</span>}
              <span className="block text-xs text-ink-400">
                {ID_TYPES.find((t) => t.value === d.id_type)?.label.replace(' (masked)', '')} ····{d.id_last4} · {d.nationality} · verified by {d.verified_by} {fmtDateTime(d.verified_at)}
                {d.purged_at && ` · file deleted ${fmtDate(d.purged_at)}`}
              </span>
            </span>
            <span className="flex gap-2">
              {onView && !d.purged_at && (
                <button onClick={() => onView(d)} className="text-xs text-gold-600 underline">View</button>
              )}
              {b.status === 'confirmed' && (
                <button onClick={() => onRemove(d)} className="text-xs text-red-700 underline">Remove</button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Everything that has happened to the booking, and the messages sent to the guest. */
export function HistorySection({ b }) {
  return (
    <Section title="History">
      <ol className="space-y-1.5 text-xs">
        {b.events.map((e) => (
          <li key={e.id} className="flex justify-between gap-3">
            <span className="text-ink-700">
              {ACTION_LABEL[e.action] || e.action}
              <span className="text-ink-400"> · {e.actor_name}</span>
              {e.details?.reason && <span className="text-ink-400"> — {e.details.reason}</span>}
              {e.action === 'stay_extended' && <span className="text-ink-400"> — to {fmtDate(e.details.to)}</span>}
              {e.details?.amount && ['refund_initiated', 'payment_recorded', 'payment_captured'].includes(e.action) && (
                <span className="text-ink-400"> — {inr(e.details.amount)}</span>
              )}
            </span>
            <span className="whitespace-nowrap text-ink-400">{fmtDateTime(e.created_at)}</span>
          </li>
        ))}
      </ol>
      {b.notifications.length > 0 && (
        <p className="mt-3 text-xs text-ink-400">
          Messages: {[...new Set(b.notifications.map((n) => n.template.replace(/_/g, ' ')))].join(', ')} (SMS / WhatsApp{b.guest_email ? ' / email' : ''})
        </p>
      )}
    </Section>
  );
}
