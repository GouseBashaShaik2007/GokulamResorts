'use client';

import { inr, fmtDateTime } from '@/lib/bookingUi';
import { CopyButton } from './parts';

/** Right after paying: say plainly that the money arrived, and what happens now. */
export default function PaymentReceived({ b }) {
  const steps = [
    { done: true, title: 'Payment received', text: `We have your payment of ${inr(b.paid || b.total)}.` },
    {
      title: 'The resort confirms your booking',
      text: `Within 24 hours${b.holdExpiresAt ? ` — by ${fmtDateTime(b.holdExpiresAt)}` : ''}. Your room is held for you meanwhile.`,
    },
    {
      title: 'You get an SMS / WhatsApp',
      text: 'As soon as it is confirmed. If the resort cannot confirm in that time, your payment is refunded in full automatically.',
    },
  ];
  return (
    <div className="card border-green-700/30 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-green-700 text-white" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <div>
          <h1 className="font-serif text-3xl font-semibold text-navy-50">Payment received — thank you</h1>
          <p className="mt-1 text-navy-300">Your booking reference. Keep it: with your mobile number, it is how you look this booking up.</p>
          <p className="mt-3 flex flex-wrap items-center gap-3">
            <span className="font-mono text-3xl font-semibold tracking-wide text-navy-50">{b.reference}</span>
            <CopyButton text={b.reference} />
          </p>
        </div>
      </div>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-navy-400">What happens next</h2>
      <ol className="mt-3 space-y-4">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <span
              className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-sm font-semibold ${step.done ? 'bg-green-700 text-white' : 'border border-navy-600 text-navy-200'}`}
              aria-hidden="true"
            >
              {step.done ? '✓' : i + 1}
            </span>
            <span>
              <span className="block font-medium text-navy-50">{step.title}</span>
              <span className="text-sm text-navy-300">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
