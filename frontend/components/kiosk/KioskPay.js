'use client';

import { inr } from '@/lib/bookingUi';
import { Spinner } from './KioskScreens';

/**
 * What the kiosk shows while a payment is in progress (see lib/useOrderCheckout.js
 * for the stages). The gateway's own payment window opens on top of this.
 */
export default function KioskPay({ pay, onMockPay, onMockCancel, onDismiss }) {
  if (pay.stage === 'idle') return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-night/85 p-8" role="dialog" aria-modal="true" aria-label="Payment">
      <div className="w-full max-w-xl rounded-3xl bg-sand-50 p-10 text-center shadow-2xl" aria-live="polite">
        {pay.stage === 'opening' && (
          <>
            <Spinner className="text-ocean-500" />
            <h2 className="mt-6 font-serif text-4xl font-semibold text-ink-900">Getting your payment ready…</h2>
          </>
        )}

        {pay.stage === 'waiting' && (
          <>
            <h2 className="font-serif text-4xl font-semibold text-ink-900">Pay {inr(pay.total)}</h2>
            <p className="mt-4 text-xl text-ink-500">
              Use the payment window on this screen. Scan the QR code with any UPI app on your phone, or choose another
              way to pay.
            </p>
          </>
        )}

        {pay.stage === 'mock' && (
          <>
            <p className="mx-auto inline-block rounded-full bg-amber-200 px-4 py-1.5 text-sm font-bold uppercase tracking-wider text-amber-950">Test mode</p>
            <h2 className="mt-4 font-serif text-4xl font-semibold text-ink-900">Pay {inr(pay.total)}</h2>
            <p className="mt-4 text-lg text-ink-500">
              No payment gateway is connected, so no money is taken. A customer would pay here by UPI or card; this
              button stands in for that.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <button type="button" onClick={onMockPay} className="btn-primary h-16 text-xl">Pretend the customer has paid</button>
              <button type="button" onClick={onMockCancel} className="btn-outline h-14 text-lg">Cancel the payment</button>
            </div>
          </>
        )}

        {pay.stage === 'confirming' && (
          <>
            <Spinner className="text-ocean-500" />
            <h2 className="mt-6 font-serif text-4xl font-semibold text-ink-900">Checking your payment…</h2>
            <p className="mt-4 text-xl text-ink-500">Please wait. Do not pay again.</p>
          </>
        )}

        {pay.stage === 'failed' && (
          <div role="alert">
            <h2 className="font-serif text-4xl font-semibold text-ink-900">That did not work</h2>
            <p className="mt-4 text-xl text-ink-700">{pay.message}</p>
            <button type="button" onClick={onDismiss} className="btn-primary mt-8 h-16 min-w-[16rem] text-xl">Back to my order</button>
          </div>
        )}

        {pay.stage === 'unconfirmed' && (
          <div role="alert">
            <h2 className="font-serif text-4xl font-semibold text-ink-900">Please see our staff</h2>
            <p className="mt-4 text-xl text-ink-700">
              This screen could not confirm your order. If your payment of {inr(pay.total)} went through and the order
              was not placed, the money is returned to you automatically.
            </p>
            <button type="button" onClick={onDismiss} className="btn-primary mt-8 h-16 min-w-[12rem] text-xl">OK</button>
          </div>
        )}
      </div>
    </div>
  );
}
