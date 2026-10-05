'use client';

import { useState } from 'react';
import { inr } from '@/lib/bookingUi';
import useModal from '@/lib/useModal';
import Photo from '../ui/Photo';
import VegMark from '../ui/VegMark';
import { DishInfo } from '../MenuItemCard';

const SPICE = [
  { value: 'mild', label: 'Mild' },
  { value: 'medium', label: 'Medium' },
  { value: 'hot', label: 'Hot' },
];

/**
 * One dish, opened from the kiosk menu: how many, how spicy (where the
 * kitchen offers a choice) and any request. `onAdd({ quantity, spiceLevel, notes })`.
 * Give it a `key` per dish so each one opens fresh.
 */
export default function KioskDish({ item, onAdd, onClose }) {
  const ref = useModal(true, onClose);
  const [qty, setQty] = useState(1);
  const [spice, setSpice] = useState('medium');
  const [notes, setNotes] = useState('');
  const [asking, setAsking] = useState(false); // the request box is opened on demand: it brings up the keyboard

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-night/70 p-6" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-4xl overflow-hidden rounded-3xl bg-sand-50 shadow-2xl focus:outline-none"
      >
        {item.image && (
          <div className="relative hidden w-2/5 flex-none md:block">
            <Photo src={item.image} alt="" sizes="30rem" priority />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <VegMark veg={item.is_veg} className="mt-2" />
              <h2 className="font-serif text-4xl font-semibold leading-tight text-ink-900">{item.name}</h2>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-sand-200 text-2xl text-ink-700 active:bg-sand-300">✕</button>
          </div>
          {item.description && <p className="mt-3 text-lg text-ink-500">{item.description}</p>}
          <DishInfo item={item} className="mt-3 !text-base" />
          <p className="price mt-4 text-3xl">{inr(item.price)}</p>

          {item.spice_adjustable && (
            <fieldset className="mt-6">
              <legend className="text-base font-medium text-ink-500">How spicy?</legend>
              <div className="mt-2 grid grid-cols-3 gap-3">
                {SPICE.map((s) => (
                  <label key={s.value} className={`cursor-pointer rounded-2xl border-2 py-4 text-center text-xl font-medium ${spice === s.value ? 'border-ocean-500 bg-ocean-500 text-white' : 'border-sand-300 bg-white text-ink-700'}`}>
                    <input type="radio" name="spice" value={s.value} checked={spice === s.value} onChange={() => setSpice(s.value)} className="sr-only" />
                    {s.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mt-6">
            {asking ? (
              <>
                <label className="text-base font-medium text-ink-500" htmlFor="kiosk-dish-notes">Your request for this dish</label>
                {/* Focused at once: the customer has just asked to type here. */}
                <input id="kiosk-dish-notes" autoFocus maxLength={300} className="input-field mt-2 h-16 select-text text-lg" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="No onions, extra lemon…" />
              </>
            ) : (
              <button type="button" onClick={() => setAsking(true)} className="text-lg font-semibold text-ocean-600 underline underline-offset-4">
                Add a request (no onions, less oil…)
              </button>
            )}
          </div>

          <div className="mt-auto flex items-center gap-4 pt-8">
            <div className="flex flex-none items-center rounded-full border-2 border-sand-300 bg-white">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} className="h-16 w-16 text-3xl text-ink-800 disabled:opacity-30" aria-label="One less">−</button>
              <span className="w-10 text-center text-2xl font-semibold text-ink-900" aria-live="polite">{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(20, q + 1))} disabled={qty >= 20} className="h-16 w-16 text-3xl text-ink-800 disabled:opacity-30" aria-label="One more">+</button>
            </div>
            <button
              type="button"
              data-autofocus
              onClick={() => onAdd({ quantity: qty, spiceLevel: item.spice_adjustable ? spice : null, notes })}
              className="btn-primary h-16 flex-1 text-2xl"
            >
              Add to order · {inr(item.price * qty)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
