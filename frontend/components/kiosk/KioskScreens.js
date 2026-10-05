'use client';

import Link from 'next/link';
import { inr } from '@/lib/bookingUi';
import { serviceNextStep } from '@/lib/kiosk';

const STEPS = ['Choose your dishes', 'Dine-in, pickup or to your room', 'Pay on this screen'];

function Spinner({ className = '' }) {
  return <span className={`inline-block h-12 w-12 animate-spin rounded-full border-4 border-current border-r-transparent ${className}`} aria-hidden="true" />;
}

/**
 * What the kiosk shows between customers. The whole screen starts an order.
 * `ready`: the menu is loaded and has something to order. `closed`: it was
 * loaded and there is nothing to order (or it could not be loaded at all).
 */
export function KioskStart({ ready, closed, onStart }) {
  return (
    // The tap can land anywhere on the screen; the button inside is what a
    // keyboard reaches (its click bubbles up to here).
    <div
      onClick={ready ? onStart : undefined}
      className={`flex h-full w-full flex-col items-center justify-center bg-night px-10 text-center text-white ${ready ? 'cursor-pointer' : ''}`}
    >
      <p className="text-lg font-medium uppercase tracking-[0.35em] text-gold-300">Gokulam Restaurant</p>
      <h1 className="mt-6 font-serif text-[clamp(4rem,11vw,8.5rem)] font-semibold leading-none">Order here</h1>
      {ready ? (
        <>
          <button type="button" className="mt-12 rounded-full bg-white px-14 py-6 text-3xl font-semibold text-night shadow-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-gold-300">
            Tap to start
          </button>
          <ol className="mt-14 flex flex-wrap justify-center gap-x-10 gap-y-3 text-xl text-white/80">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white/15 text-base font-semibold" aria-hidden="true">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </>
      ) : closed ? (
        <p role="status" className="mt-12 max-w-2xl text-2xl leading-relaxed text-white/85">
          Ordering on this screen is closed right now. Please order with our staff.
        </p>
      ) : (
        <p role="status" className="mt-12 flex items-center gap-4 text-2xl text-white/80">
          <Spinner className="h-8 w-8" /> Getting the menu…
        </p>
      )}
    </div>
  );
}

const LOCKED_REASON = {
  link: 'That set-up link is not valid any more.',
  expired: 'This tablet’s set-up is no longer valid, so it has to be set up again.',
};

/** Shown to anyone who opens the kiosk address on a device that is not the kiosk. */
export function KioskLocked({ reason }) {
  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-8 py-10 text-center">
      <p className="eyebrow">Gokulam Restaurant</p>
      <h1 className="section-heading mt-3">This is our restaurant’s ordering screen</h1>
      <p className="mt-4 max-w-xl text-lg text-ink-500">
        {LOCKED_REASON[reason] || 'It takes orders on the tablet in our restaurant, and it has not been set up on this device.'}
      </p>
      <p className="mt-3 max-w-xl text-ink-400">Staff: open Admin → QR Codes and use “Set up the kiosk” on this tablet.</p>
      <Link href="/dining#menu" className="btn-primary mt-8">See the menu</Link>
    </div>
  );
}

/** The kiosk cannot reach the restaurant's system (it keeps trying by itself). */
export function KioskConnecting({ checking }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-night px-10 text-center text-white" role="status">
      <Spinner className="text-gold-300" />
      <h1 className="mt-8 font-serif text-5xl font-semibold">{checking ? 'One moment…' : 'Connecting…'}</h1>
      {!checking && (
        <p className="mt-5 max-w-xl text-xl leading-relaxed text-white/80">
          This screen cannot reach the restaurant right now. Please order with our staff. It will be back as soon as the
          connection is.
        </p>
      )}
    </div>
  );
}

/**
 * The order is paid and with the kitchen: its number, as large as the screen
 * allows, and what happens next — it is brought to the table or the room the
 * customer chose, or the number is called at the counter.
 * `order`: { orderNumber, total, service } (`service`: see lib/kiosk.js).
 */
export function KioskDone({ order, seconds, onDone }) {
  // Someone waiting at the counter has to remember the number; at a table or in a room it is only for reference.
  const waitsAtCounter = !order.service || order.service.mode === 'pickup';
  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto bg-sand-50 px-10 py-8 text-center">
      <div role="status">
        <p className="text-xl font-semibold uppercase tracking-[0.3em] text-green-800">Paid · {inr(order.total)}</p>
        <h1 className="mt-5 font-serif text-5xl font-semibold text-ink-900">Your order number</h1>
        <p data-order-number className="mt-2 font-sans text-[clamp(7rem,24vh,15rem)] font-bold leading-none text-ocean-500 [font-variant-numeric:lining-nums]">
          {order.orderNumber}
        </p>
        <p data-next-step className="mx-auto mt-4 max-w-2xl font-serif text-4xl font-semibold leading-snug text-ink-900">{serviceNextStep(order.service)}</p>
        <p className="mx-auto mt-2 max-w-2xl text-xl leading-snug text-ink-500">
          {waitsAtCounter ? 'Please remember your number and wait nearby.' : 'Please keep your number in case we ask for it.'}
        </p>
      </div>
      <button type="button" onClick={onDone} className="btn-primary mt-8 h-20 min-w-[16rem] text-3xl">Done</button>
      <p className="mt-4 text-lg text-ink-400">This screen clears itself in {seconds} seconds.</p>
    </div>
  );
}

/** "Are you still there?" — shown before an order nobody is touching is cleared. */
export function IdleWarning({ seconds, onStay, onStartOver }) {
  return (
    <div data-idle-warning className="fixed inset-0 z-[85] flex items-center justify-center bg-night/85 p-8" role="alertdialog" aria-modal="true" aria-labelledby="idle-title">
      <div className="w-full max-w-xl rounded-3xl bg-sand-50 p-10 text-center shadow-2xl">
        <h2 id="idle-title" className="font-serif text-4xl font-semibold text-ink-900">Are you still there?</h2>
        <p className="mt-4 text-xl text-ink-500">
          This order will be cleared in <span className="font-bold text-ink-900">{seconds}</span> second{seconds === 1 ? '' : 's'}.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <button type="button" onClick={onStartOver} className="btn-outline h-16 min-w-[12rem] text-xl">Start over</button>
          <button type="button" onClick={onStay} className="btn-primary h-16 min-w-[12rem] text-xl">I’m still here</button>
        </div>
      </div>
    </div>
  );
}

/**
 * The kiosk is laid out for a screen on its side. Stood upright, it asks to be
 * turned instead of showing a squeezed menu (the tablet's stand decides this
 * once; a customer never sees it).
 */
export function TurnSideways() {
  return (
    <div className="fixed inset-0 z-[90] hidden flex-col items-center justify-center bg-night px-8 text-center text-white portrait:flex" role="status">
      <svg viewBox="0 0 24 24" className="h-16 w-16 text-gold-300" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="7" y="2.5" width="10" height="19" rx="2" />
        <path d="M2.5 9a9 9 0 0 1 3-4.5M2.5 9V5.5M2.5 9H6" />
      </svg>
      <p className="mt-6 font-serif text-4xl font-semibold">Please turn this screen sideways</p>
      <p className="mt-3 max-w-md text-lg text-white/75">The ordering screen is made for a tablet on its side.</p>
    </div>
  );
}

export { Spinner };
