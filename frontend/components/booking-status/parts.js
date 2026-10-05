'use client';

import { useState } from 'react';
import { fmtDate, nightsBetween, todayIST, inr } from '@/lib/bookingUi';

// Small pieces of the guest's booking page: wording per status, the progress
// bar, the countdown to check-in and the copy button.

const sum = (refunds) => refunds.reduce((total, r) => total + (r.status !== 'failed' ? r.amount : 0), 0);

/** Heading and sentence for a booking's status, as the guest should read it. */
export function statusFor(b) {
  const refunded = sum(b.refunds);
  // What happened to the money, for bookings that did not go ahead.
  const money = refunded > 0 ? `${inr(refunded)} is being refunded — details below.` : b.paid > 0 ? '' : 'No payment was taken.';

  switch (b.status) {
    case 'pending_payment':
      return { title: 'Payment pending', text: 'Your room is held briefly while you complete payment.' };
    case 'paid':
      return {
        title: 'Payment received',
        text: 'The resort is reviewing your booking and will confirm within 24 hours. You will get an SMS / WhatsApp as soon as it is confirmed. If it cannot be confirmed, your payment is refunded in full automatically.',
      };
    case 'confirmed':
      return { title: 'Booking confirmed', text: 'We look forward to welcoming you.' };
    case 'checked_in':
      return { title: 'Enjoy your stay', text: 'You are checked in.' };
    case 'checked_out':
      return { title: 'Thank you for staying with us', text: 'We hope to see you again at Chirala Beach.' };
    case 'cancelled':
      return { title: 'Booking cancelled', text: ['This booking will not go ahead.', money].filter(Boolean).join(' ') };
    case 'rejected':
      return { title: 'Booking could not be confirmed', text: ['We are sorry — the resort could not accept this booking.', money].filter(Boolean).join(' ') };
    case 'no_show':
      return { title: 'Marked as no-show', text: 'The booking was closed because the guest did not arrive. As our policy says, the payment for a no-show is not refunded.' };
    default:
      return { title: b.status, text: '' };
  }
}

/** Total refunded (or being refunded) on a booking. */
export const refundedTotal = (b) => sum(b.refunds);

// Stay progress, in the order a booking actually moves.
const STEPS = [
  { key: 'paid', label: 'Paid' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'checked_in', label: 'Checked in' },
  { key: 'checked_out', label: 'Checked out' },
];
const STEP_INDEX = { pending_payment: -1, paid: 0, confirmed: 1, checked_in: 2, checked_out: 3 };

export function StayProgress({ status }) {
  const at = STEP_INDEX[status];
  if (at === undefined) return null;
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Booking progress">
      {STEPS.map((s, i) => (
        <li key={s.key} className="text-center" aria-current={i === at ? 'step' : undefined}>
          <span className={`mx-auto block h-1.5 rounded-full ${i <= at ? 'bg-ocean-500' : 'bg-sand-300'}`} />
          <span className={`mt-2 block text-xs ${i === at ? 'font-semibold text-ink-900' : 'text-ink-400'}`}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function CheckInCountdown({ checkIn }) {
  const days = nightsBetween(todayIST(), checkIn);
  if (days < 0) return null;
  return (
    <div className="rounded-xl bg-ocean-500 px-5 py-4 text-white">
      <p className="text-3xl font-semibold">{days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`}</p>
      <p className="text-sm text-white/80">{days === 0 ? 'is check-in day' : 'until check-in'} · {fmtDate(checkIn)}</p>
    </div>
  );
}

// The reference is what a guest needs to keep; one tap puts it on the clipboard.
export function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — the reference is on screen to copy by hand
    }
  };
  return (
    <button type="button" onClick={copy} className="no-print rounded-full border border-sand-300 px-2.5 py-0.5 text-[11px] font-medium normal-case tracking-normal text-ocean-600 hover:border-ocean-400">
      <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}
