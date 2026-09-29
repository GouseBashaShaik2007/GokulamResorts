'use client';

import { useEffect, useState } from 'react';
import { useBooking } from '../BookingContext';
import { inr } from '../../../lib/bookingUi';

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
  const { hold, pick, status, error, resumePayment, confirmMock, reset, goTo } = useBooking();
  const remainingMs = useCountdown(hold?.holdExpiresAt);
  const expired = remainingMs !== null && remainingMs <= 0;

  if (!hold) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-navy-400">No booking in progress.</p>
        <button type="button" onClick={() => goTo('stay')} className="btn-outline">Start a booking</button>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="space-y-4 text-center">
        <p className="eyebrow">Hold Expired</p>
        <h2 className="font-serif text-2xl font-semibold text-navy-50">Your room hold has expired</h2>
        <p className="text-sm text-navy-400">Please choose your dates and room again.</p>
        <button type="button" onClick={reset} className="btn-gold">Start Over</button>
      </div>
    );
  }

  const minutes = remainingMs !== null ? Math.floor(remainingMs / 60000) : null;
  const seconds = remainingMs !== null ? Math.floor((remainingMs % 60000) / 1000) : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Step 4 of 4</p>
        <h2 className="mt-1 font-serif text-2xl font-semibold text-navy-50">Payment</h2>
        {minutes !== null && (
          <p className="mt-1 text-sm text-navy-400">
            Room held for {minutes}:{String(seconds).padStart(2, '0')}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-navy-700 bg-navy-800 p-5">
        {pick && <p className="text-sm text-navy-300">Room {pick.unit.unitNumber}</p>}
        <p className="price mt-1 text-3xl">{inr(hold.amount / 100)}</p>
      </div>

      {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

      {hold.mock ? (
        <div className="space-y-2">
          <p className="text-center text-xs text-navy-400">
            No live payment gateway is connected yet — simulate a successful payment to send this booking to the
            resort for confirmation.
          </p>
          <button
            type="button" onClick={confirmMock} disabled={status === 'paying'}
            className="btn-gold w-full disabled:opacity-60"
          >
            {status === 'paying' ? 'Confirming...' : 'Simulate Successful Payment'}
          </button>
        </div>
      ) : (
        <button
          type="button" onClick={resumePayment} disabled={status === 'paying'}
          className="btn-gold w-full disabled:opacity-60"
        >
          {status === 'paying' ? 'Waiting for payment...' : `Pay ${inr(hold.amount / 100)}`}
        </button>
      )}

      <button type="button" onClick={reset} className="w-full text-center text-xs text-navy-400 hover:underline">
        Start over
      </button>
    </div>
  );
}
