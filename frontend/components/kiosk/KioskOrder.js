'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { inr } from '@/lib/bookingUi';
import { dishesFor } from '@/lib/kiosk';
import useModal from '@/lib/useModal';
import Photo from '../ui/Photo';
import VegMark from '../ui/VegMark';
import { DishInfo } from '../MenuItemCard';
import KioskDish from './KioskDish';

// A filter pill sized for a finger on a wall-mounted screen.
function Filter({ pressed, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex h-12 items-center gap-2 rounded-full border-2 px-5 text-lg font-medium ${pressed ? 'border-green-700 bg-green-700 text-white' : 'border-sand-300 bg-white text-ink-700'}`}
    >
      {children}
    </button>
  );
}

function DishCard({ item, inOrder, onOpen }) {
  const soldOut = item.is_available === false;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={soldOut}
      className={`card flex w-full flex-col overflow-hidden text-left active:scale-[0.99] ${soldOut ? 'opacity-60' : ''}`}
    >
      <div className="relative h-36 w-full flex-none">
        {item.image ? (
          <Photo src={item.image} alt="" sizes="(min-width: 1536px) 22vw, 30vw" />
        ) : (
          <div className="photo-coming-soon" aria-hidden="true" />
        )}
        <VegMark veg={item.is_veg} className="absolute left-3 top-3" />
        {inOrder > 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-ocean-500 px-3 py-1 text-sm font-semibold text-white">{inOrder} in your order</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-serif text-xl font-semibold leading-snug text-ink-900">{item.name}</h3>
        {item.description && <p className="mt-1 line-clamp-2 text-sm text-ink-500">{item.description}</p>}
        <DishInfo item={item} className="mt-2" />
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="price text-xl">{inr(item.price)}</span>
          {soldOut ? (
            <span className="rounded-full bg-sand-200 px-4 py-2 text-base font-semibold text-ink-700">Sold out today</span>
          ) : (
            <span className="rounded-full bg-ocean-500 px-6 py-2 text-lg font-semibold text-white">Add</span>
          )}
        </div>
      </div>
    </button>
  );
}

// One dish in the order: name and price above, how it was asked for and the − / + below.
function OrderLine({ line, cart }) {
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-medium leading-snug text-ink-900">{line.name}</p>
        <p className="flex-none text-lg font-semibold text-ink-900 [font-variant-numeric:tabular-nums]">{inr(line.price * line.quantity)}</p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="min-w-0 text-sm text-ink-500">
          {inr(line.price)} each
          {line.spiceLevel && ` · ${line.spiceLevel}`}
          {line.notes && <span className="block truncate italic">“{line.notes}”</span>}
        </p>
        <div className="flex flex-none items-center rounded-full border-2 border-sand-300 bg-white">
          <button type="button" onClick={() => cart.adjustQty(line.lineId, -1)} className="h-12 w-12 text-2xl text-ink-800" aria-label={line.quantity === 1 ? `Remove ${line.name}` : `One less ${line.name}`}>−</button>
          <span className="w-8 text-center text-lg font-semibold text-ink-900">{line.quantity}</span>
          <button type="button" onClick={() => cart.adjustQty(line.lineId, 1)} disabled={line.quantity >= 20} className="h-12 w-12 text-2xl text-ink-800 disabled:opacity-30" aria-label={`One more ${line.name}`}>+</button>
        </div>
      </div>
    </li>
  );
}

function StartOverDialog({ onKeep, onStartOver }) {
  const ref = useModal(true, onKeep);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-night/70 p-8">
      <div ref={ref} role="alertdialog" aria-modal="true" aria-labelledby="start-over-title" tabIndex={-1} className="w-full max-w-lg rounded-3xl bg-sand-50 p-10 text-center shadow-2xl focus:outline-none">
        <h2 id="start-over-title" className="font-serif text-4xl font-semibold text-ink-900">Start over?</h2>
        <p className="mt-3 text-xl text-ink-500">Everything in your order will be cleared.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <button type="button" onClick={onStartOver} className="btn-outline h-16 min-w-[12rem] text-xl">Yes, start over</button>
          <button type="button" data-autofocus onClick={onKeep} className="btn-primary h-16 min-w-[12rem] text-xl">Keep my order</button>
        </div>
      </div>
    </div>
  );
}

/**
 * The kiosk's ordering screen, laid out for a tablet on its side: categories
 * down the left, the dishes of one category in the middle, and the order with
 * its Continue button always in view on the right.
 *
 * `menu`: { categories, items }. `cart`: from useCart. `allergy` / `onAllergy`:
 * the note the kitchen sees as a warning. `notice`: a message about the order
 * (a dish sold out, a payment not completed). `onContinue()` moves on to "how
 * would you like your order?" and the payment (KioskService.js). `onStartOver()`.
 */
export default function KioskOrder({ menu, cart, allergy, onAllergy, notice, onDismissNotice, onContinue, paying, onStartOver }) {
  const [vegOnly, setVegOnly] = useState(false);
  const [jainOnly, setJainOnly] = useState(false);
  const [chosen, setChosen] = useState(null); // category id; null = the first one
  const [dish, setDish] = useState(null); // the dish whose panel is open
  const [askAllergy, setAskAllergy] = useState(Boolean(allergy));
  const [confirmingStartOver, setConfirmingStartOver] = useState(false);
  const dishesRef = useRef(null);
  // The Jain filter is only offered once the kitchen has marked some dishes.
  const hasJain = menu.items.some((i) => i.is_jain);

  const sections = useMemo(
    () =>
      menu.categories
        .map((c) => ({ ...c, dishes: dishesFor(menu.items, c.id, { vegOnly, jainOnly }) }))
        .filter((c) => c.dishes.length > 0),
    [menu, vegOnly, jainOnly]
  );
  const active = sections.find((c) => c.id === chosen) || sections[0] || null;

  // A new category starts at its top.
  useEffect(() => {
    dishesRef.current?.scrollTo({ top: 0 });
  }, [active?.id]);

  // A dish that sells out while its panel is open closes the panel.
  useEffect(() => {
    if (dish && !menu.items.some((i) => i.id === dish.id && i.is_available !== false)) setDish(null);
  }, [menu, dish]);

  const startOver = () => (cart.items.length > 0 ? setConfirmingStartOver(true) : onStartOver());

  return (
    <div className="grid h-full grid-cols-[12rem_minmax(0,1fr)_21rem] grid-rows-[auto_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_24rem]">
      <header className="col-span-3 flex h-20 items-center justify-between gap-4 border-b border-sand-300 bg-sand-50 px-6">
        <p className="flex items-baseline gap-3">
          <span className="font-serif text-3xl font-semibold tracking-wide text-gold-600">Gokulam</span>
          <span className="text-sm font-medium uppercase tracking-[0.25em] text-ink-700">Restaurant</span>
        </p>
        <div className="flex items-center gap-3">
          <Filter pressed={vegOnly} onClick={() => setVegOnly((v) => !v)}>
            <VegMark veg />
            Veg only
          </Filter>
          {hasJain && <Filter pressed={jainOnly} onClick={() => setJainOnly((v) => !v)}>Jain only</Filter>}
          <button type="button" onClick={startOver} className="ml-3 h-12 rounded-full border-2 border-sand-400 px-6 text-lg font-medium text-ink-700 active:bg-sand-200">
            Start over
          </button>
        </div>
      </header>

      <nav aria-label="Menu categories" className="overflow-y-auto border-r border-sand-300 bg-sand-100 p-3">
        <ul className="space-y-2">
          {sections.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                aria-current={active?.id === c.id ? 'true' : undefined}
                onClick={() => setChosen(c.id)}
                className={`flex min-h-[4rem] w-full items-center rounded-2xl px-4 py-3 text-left text-lg font-medium leading-snug ${active?.id === c.id ? 'bg-ocean-500 text-white' : 'bg-sand-50 text-ink-800 active:bg-sand-200'}`}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main ref={dishesRef} className="overflow-y-auto overscroll-contain p-5">
        {notice && (
          <div role="status" className="mb-4 flex items-start justify-between gap-4 rounded-2xl border border-amber-700/30 bg-amber-100 px-5 py-4 text-lg text-amber-950">
            <p>{notice}</p>
            <button type="button" onClick={onDismissNotice} aria-label="Close this message" className="-mr-2 -mt-1 flex h-10 w-10 flex-none items-center justify-center rounded-full text-xl active:bg-amber-200">✕</button>
          </div>
        )}
        {active ? (
          <>
            <h2 className="mb-4 font-serif text-4xl font-semibold text-ink-900">{active.name}</h2>
            <div className="grid grid-cols-2 gap-5 2xl:grid-cols-3">
              {active.dishes.map((item) => (
                <DishCard key={item.id} item={item} inOrder={cart.quantityOf(item.id)} onOpen={() => setDish(item)} />
              ))}
            </div>
          </>
        ) : (
          <div className="card p-10 text-center text-xl text-ink-500">
            No dishes match.{' '}
            <button type="button" onClick={() => { setVegOnly(false); setJainOnly(false); }} className="font-semibold text-ocean-600 underline underline-offset-4">
              Show the whole menu
            </button>
          </div>
        )}
      </main>

      <aside aria-label="Your order" className="flex min-h-0 flex-col border-l border-sand-300 bg-sand-100">
        <h2 className="flex items-baseline justify-between border-b border-sand-300 px-5 py-4 font-serif text-3xl font-semibold text-ink-900">
          Your order
          {cart.itemCount > 0 && <span className="font-sans text-base font-medium text-ink-500">{cart.itemCount} item{cart.itemCount === 1 ? '' : 's'}</span>}
        </h2>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
          {cart.items.length === 0 ? (
            <p className="py-10 text-center text-lg text-ink-400">Nothing yet. Tap a dish to add it.</p>
          ) : (
            <ul className="divide-y divide-sand-300">
              {cart.items.map((line) => <OrderLine key={line.lineId} line={line} cart={cart} />)}
            </ul>
          )}
        </div>

        <div className="border-t border-sand-300 px-5 py-4">
          {cart.items.length > 0 && (
            <div className="mb-3">
              {askAllergy ? (
                <>
                  <label className="text-sm font-medium text-ink-500" htmlFor="kiosk-allergy">Allergies (the kitchen sees this first)</label>
                  <input id="kiosk-allergy" maxLength={200} className="input-field mt-1 h-14 select-text text-lg" value={allergy} onChange={(e) => onAllergy(e.target.value)} placeholder="e.g. peanuts, shellfish" />
                </>
              ) : (
                <button type="button" onClick={() => setAskAllergy(true)} className="text-base font-semibold text-ocean-600 underline underline-offset-4">
                  Any allergies? Tell the kitchen
                </button>
              )}
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <span className="text-xl text-ink-700">Total</span>
            <span data-order-total className="price text-3xl">{inr(cart.total)}</span>
          </div>
          <button type="button" data-order-continue onClick={onContinue} disabled={cart.items.length === 0 || paying} className="btn-primary mt-3 h-[4.5rem] w-full text-2xl disabled:opacity-40">
            Continue
          </button>
          <p className="mt-2 text-center text-sm text-ink-500">Next: dine-in, pickup or to your room. Then pay on this screen by UPI or card.</p>
        </div>
      </aside>

      {dish && (
        <KioskDish
          key={dish.id}
          item={dish}
          onClose={() => setDish(null)}
          onAdd={(choice) => {
            cart.addItem(dish, choice);
            setDish(null);
          }}
        />
      )}
      {confirmingStartOver && (
        <StartOverDialog
          onKeep={() => setConfirmingStartOver(false)}
          onStartOver={() => {
            setConfirmingStartOver(false);
            onStartOver();
          }}
        />
      )}
    </div>
  );
}
