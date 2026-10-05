'use client';

import { inr } from '@/lib/bookingUi';
import { SERVICE_CHOICES, serviceChosen, serviceSummary } from '@/lib/kiosk';
import useModal from '@/lib/useModal';

// Line drawings for the three choices (plain SVG: symbol characters turn into
// coloured emoji on some tablets).
const DRAWING = {
  // a fork and a knife
  dine_in: 'M7 3v18M4.5 3v4.5a2.5 2.5 0 0 0 5 0V3M17 21v-8M17 13h-2.5V8.5C14.5 5.5 15.5 3.8 17 3v10',
  // a carrier bag
  pickup: 'M6 8h12l1.2 12H4.8L6 8ZM9 8V6.5a3 3 0 0 1 6 0V8',
  // a bed
  room: 'M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 14h18M3 18v2M21 18v2M6 10V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3M13 10V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3',
};

// One of the three large tiles. `compact`: a table or a room is being chosen
// underneath, so the three shrink to a row of names and leave it the room.
function ChoiceTile({ choice, chosen, compact, onChoose }) {
  return (
    <button
      type="button"
      aria-pressed={chosen}
      onClick={onChoose}
      className={`flex flex-1 items-center justify-center rounded-3xl border-4 text-center active:scale-[0.99] ${compact ? 'min-h-[6rem] gap-4 px-4 py-3' : 'min-h-[11rem] flex-col px-5 py-6'} ${chosen ? 'border-ocean-500 bg-ocean-500 text-white' : 'border-sand-300 bg-white text-ink-900'}`}
    >
      <svg viewBox="0 0 24 24" className={`flex-none ${compact ? 'h-10 w-10' : 'h-14 w-14'}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={DRAWING[choice.mode]} />
      </svg>
      <span className={`font-serif font-semibold leading-none ${compact ? 'text-3xl' : 'mt-3 text-4xl'}`}>{choice.title}</span>
      {!compact && <span className={`mt-3 text-lg leading-snug ${chosen ? 'text-white' : 'text-ink-500'}`}>{choice.hint}</span>}
    </button>
  );
}

// The tables, or the rooms, as tiles: nobody can pick one we do not have.
// A long list gets smaller tiles, so more of it is on the screen at once.
function NumberTiles({ label, values, value, onPick, name }) {
  const many = values.length > 24;
  return (
    <div role="group" aria-label={label} className={`mt-4 grid gap-3 ${many ? 'grid-cols-[repeat(auto-fill,minmax(6rem,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))]'}`}>
      {values.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={String(value) === String(v)}
          aria-label={`${name} ${v}`}
          onClick={() => onPick(v)}
          className={`rounded-2xl border-2 font-sans font-semibold [font-variant-numeric:lining-nums] active:scale-[0.98] ${many ? 'h-16 text-2xl' : 'h-[4.5rem] text-3xl'} ${String(value) === String(v) ? 'border-ocean-500 bg-ocean-500 text-white' : 'border-sand-300 bg-white text-ink-900'}`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

/**
 * The kiosk's step between the order and the payment: "How would you like
 * your order?" Three large tiles — dine-in, pickup, room drop — and then,
 * for the first and the last, the table or the room to bring it to (the
 * three tiles shrink to make room for that second question).
 *
 * `places`: { tables: how many tables there are, rooms: the hotel's room
 * numbers }, from the server; a choice with nowhere to go is not offered.
 * `service` / `onChange`: the choice ({ mode, table, room }, see lib/kiosk.js).
 * `total`: what will be charged. `onPay()` opens the payment; `onBack()`
 * returns to the order.
 */
export default function KioskService({ places, service, onChange, total, onPay, paying, onBack }) {
  const ref = useModal(true, onBack);
  const tables = Array.from({ length: places.tables || 0 }, (_, i) => i + 1);
  const rooms = places.rooms || [];
  const offered = SERVICE_CHOICES.filter((c) => c.mode === 'pickup' || (c.mode === 'dine_in' ? tables.length > 0 : rooms.length > 0));
  const ready = serviceChosen(service);
  // Dine-in and room drop have a second question under the three tiles.
  const asksWhere = service.mode === 'dine_in' || service.mode === 'room';

  return (
    <div
      ref={ref}
      data-kiosk-service={service.mode || 'none'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kiosk-service-title"
      tabIndex={-1}
      className="fixed inset-0 z-[65] flex flex-col bg-sand-50 focus:outline-none"
    >
      <header className="flex h-20 flex-none items-center justify-between gap-4 border-b border-sand-300 px-6">
        <button type="button" onClick={onBack} className="flex h-12 items-center gap-2 rounded-full border-2 border-sand-400 px-6 text-lg font-medium text-ink-700 active:bg-sand-200">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Back to my order
        </button>
        <p className="flex items-baseline gap-3">
          <span className="font-serif text-3xl font-semibold tracking-wide text-gold-600">Gokulam</span>
          <span className="text-sm font-medium uppercase tracking-[0.25em] text-ink-700">Restaurant</span>
        </p>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-8 pt-5">
        <div className="mx-auto max-w-6xl">
          <h1 id="kiosk-service-title" className="text-center font-serif text-5xl font-semibold text-ink-900">How would you like your order?</h1>
          <div role="group" aria-label="How would you like your order?" className="mt-5 flex gap-5">
            {offered.map((choice) => (
              <ChoiceTile
                key={choice.mode}
                choice={choice}
                chosen={service.mode === choice.mode}
                compact={asksWhere}
                // The table or room already picked is kept if the same tile is tapped again.
                onChoose={() => service.mode !== choice.mode && onChange({ mode: choice.mode, table: null, room: null })}
              />
            ))}
          </div>

          {service.mode === 'dine_in' && (
            <section className="mt-6" aria-labelledby="kiosk-table-title">
              <h2 id="kiosk-table-title" className="font-serif text-3xl font-semibold text-ink-900">Which table are you at?</h2>
              <p className="mt-1 text-lg text-ink-500">The number is on the card on your table.</p>
              <NumberTiles label="Your table" name="Table" values={tables} value={service.table} onPick={(table) => onChange({ mode: 'dine_in', table, room: null })} />
            </section>
          )}
          {service.mode === 'room' && (
            <section className="mt-6" aria-labelledby="kiosk-room-title">
              <h2 id="kiosk-room-title" className="font-serif text-3xl font-semibold text-ink-900">Which room shall we bring it to?</h2>
              <p className="mt-1 text-lg text-ink-500">For guests staying with us.</p>
              <NumberTiles label="Your room" name="Room" values={rooms} value={service.room} onPick={(room) => onChange({ mode: 'room', table: null, room })} />
            </section>
          )}
          {service.mode === 'pickup' && (
            <p className="mt-8 text-center text-2xl leading-snug text-ink-700">
              After you pay, this screen shows your order number. We call it out at the counter when your food is ready.
            </p>
          )}
        </div>
        {/* When there are more tables or rooms than fit, the list fades out at the bottom edge: a sign that it scrolls. */}
        <div aria-hidden="true" className="pointer-events-none sticky bottom-0 h-6 bg-gradient-to-t from-sand-50" />
      </main>

      <footer className="flex flex-none items-center justify-between gap-6 border-t border-sand-300 bg-sand-100 px-8 py-4">
        <p data-service-summary aria-live="polite" className={`text-2xl ${ready ? 'font-semibold text-ink-900' : 'text-ink-500'}`}>{serviceSummary(service)}</p>
        <div className="flex flex-none items-center gap-6">
          <p className="flex items-baseline gap-3">
            <span className="text-xl text-ink-700">Total</span>
            <span className="price text-3xl">{inr(total)}</span>
          </p>
          <button type="button" onClick={onPay} disabled={!ready || paying} className="btn-primary h-[4.5rem] min-w-[18rem] text-2xl disabled:opacity-40">
            Pay {inr(total)}
          </button>
        </div>
      </footer>
    </div>
  );
}
