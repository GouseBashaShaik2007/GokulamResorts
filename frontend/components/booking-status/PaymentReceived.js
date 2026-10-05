'use client';

import { inr } from '@/lib/bookingUi';
import { CopyButton } from './parts';

/** Right after paying: say plainly that the money arrived and the booking is confirmed, and what happens now. */
export default function PaymentReceived({ b }) {
  const steps = [
    { done: true, title: 'Payment received', text: `We have your payment of ${inr(b.paid || b.total)}.` },
    { done: true, title: 'Booking confirmed', text: 'Your room is reserved for these dates. There is nothing more to do now.' },
    {
      title: 'At check-in',
      text: 'Bring a photo ID for every adult. The front desk gives you your room number when you arrive.',
    },
  ];
  return (
    <div className="card border-green-700/30 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-green-700 text-white" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink-900">Booking confirmed — thank you</h1>
          <p className="mt-1 text-ink-500">Your booking reference. Keep it: with your mobile number, it is how you look this booking up.</p>
          <p className="mt-3 flex flex-wrap items-center gap-3">
            <span className="font-mono text-3xl font-semibold tracking-wide text-ink-900">{b.reference}</span>
            <CopyButton text={b.reference} />
          </p>
        </div>
      </div>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-ink-400">What happens next</h2>
      <ol className="mt-3 space-y-4">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <span
              className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-sm font-semibold ${step.done ? 'bg-green-700 text-white' : 'border border-sand-400 text-ink-700'}`}
              aria-hidden="true"
            >
              {step.done ? '✓' : i + 1}
            </span>
            <span>
              <span className="block font-medium text-ink-900">{step.title}</span>
              <span className="text-sm text-ink-500">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
