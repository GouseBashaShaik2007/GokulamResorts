'use client';

import { useEffect, useState } from 'react';
import { useBooking } from '../BookingContext';
import { inr } from '../../../lib/bookingUi';
import StaySummary from '../StaySummary';

function useCountdown(target) {
  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    if (!target) return undefined;
    const tick = () => setRemaining(Math.max(0, new Date(target).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return remaining;
}

export default function PayStep() {
  const { hold, pick, status, error, resumePayment, confirmMock, reset, releaseHold, goTo } = useBooking();
  const remainingMs = useCountdown(hold?.holdExpiresAt);
  const expired = remainingMs !== null && remainingMs <= 0;

  if (!hold) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-400">No booking in progress.</p>
        <button type="button" onClick={() => goTo('stay')} className="btn-outline">Start a booking</button>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="space-y-4 text-center">
        <p className="eyebrow">Hold Expired</p>
        <h2 className="font-serif text-2xl font-semibold text-ink-900">Your room hold has expired</h2>
        <p className="text-sm text-ink-400">
          Nothing was charged. Your dates and details are still here — just pick a room again.
        </p>
        <button type="button" onClick={releaseHold} className="btn-primary">Choose a room again</button>
      </div>
    );
  }

  const minutes = remainingMs !== null ? Math.floor(remainingMs / 60000) : null;
  const seconds = remainingMs !== null ? Math.floor((remainingMs % 60000) / 1000) : null;
  const amount = hold.amount / 100;
  // Simulated payments exist for development only; the API refuses them in production.
  const canSimulate = hold.mock && process.env.NODE_ENV !== 'production';

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Step 4 of 4</p>
        <h2 className="mt-1 font-serif text-2xl font-semibold text-ink-900">Payment</h2>
        {minutes !== null && (
          <p className="mt-1 text-sm text-ink-400">
            Room held for <span className="font-semibold text-ink-900 [font-variant-numeric:tabular-nums]">{minutes}:{String(seconds).padStart(2, '0')}</span>
          </p>
        )}
      </div>

      {pick ? (
        <StaySummary total={amount} />
      ) : (
        <div className="rounded-xl border border-sand-300 bg-sand-100 p-5">
          <p className="text-sm text-ink-500">Total to pay</p>
          <p className="price mt-1 text-3xl">{inr(amount)}</p>
        </div>
      )}

      {error && <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</div>}

      {canSimulate && (
        <div className="space-y-2">
          <p className="text-center text-xs text-ink-400">
            No live payment gateway is connected yet — simulate a successful payment to send this booking to the
            resort for confirmation.
          </p>
          <button
            type="button" onClick={confirmMock} disabled={status === 'paying'}
            className="btn-primary w-full disabled:opacity-60"
          >
            {status === 'paying' ? 'Confirming...' : 'Simulate Successful Payment'}
          </button>
        </div>
      )}
      {hold.mock && !canSimulate && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          Online payment isn&apos;t available right now. Please contact the resort to complete this booking.
        </p>
      )}
      {!hold.mock && (
        <button
          type="button" onClick={resumePayment} disabled={status === 'paying'}
          className="btn-primary w-full disabled:opacity-60"
        >
          {status === 'paying' ? 'Waiting for payment...' : `Pay ${inr(amount)}`}
        </button>
      )}

      <p className="text-center text-xs text-ink-400">
        The resort confirms within 24 hours. If it can&apos;t, you are refunded in full automatically.
      </p>

      <button type="button" onClick={reset} className="w-full text-center text-xs text-ink-400 hover:underline">
        Start over
      </button>
    </div>
  );
}
