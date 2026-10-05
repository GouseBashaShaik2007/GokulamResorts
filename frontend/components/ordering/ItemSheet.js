'use client';

import { useState } from 'react';
import { inr } from '@/lib/bookingUi';
import Photo from '../ui/Photo';
import VegMark from '../ui/VegMark';
import { DishInfo } from '../MenuItemCard';

const SPICE = [
  { value: 'mild', label: 'Mild' },
  { value: 'medium', label: 'Medium' },
  { value: 'hot', label: 'Hot' },
];

/**
 * One dish, opened from the menu: choose how many, the spice level (where the
 * kitchen offers it) and any request. `onAdd({ quantity, spiceLevel, notes })`.
 */
export default function ItemSheet({ item, onAdd, onClose }) {
  const [qty, setQty] = useState(1);
  const [spice, setSpice] = useState('medium');
  const [notes, setNotes] = useState('');

  return (
    <div>
      {item.image && (
        <div className="relative h-56 w-full sm:h-64">
          <Photo src={item.image} alt="" sizes="(min-width: 640px) 28rem, 100vw" />
        </div>
      )}
      <div className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <VegMark veg={item.is_veg} className="mt-1.5" />
            <h2 className="font-serif text-2xl font-semibold text-ink-900">{item.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-ink-500 hover:bg-sand-200">✕</button>
        </div>
        {item.description && <p className="text-ink-500">{item.description}</p>}
        <DishInfo item={item} className="text-sm" />
        <p className="price text-xl">{inr(item.price)}</p>

        {item.spice_adjustable && (
          <fieldset>
            <legend className="label">Spice level</legend>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {SPICE.map((s) => (
                <label key={s.value} className={`cursor-pointer rounded-xl border py-2 text-center text-sm ${spice === s.value ? 'border-ocean-500 bg-ocean-500 text-white' : 'border-sand-300 text-ink-700'}`}>
                  <input type="radio" name="spice" value={s.value} checked={spice === s.value} onChange={() => setSpice(s.value)} className="sr-only" />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div>
          <label className="label" htmlFor="item-notes">Special requests (optional)</label>
          <textarea id="item-notes" rows={2} maxLength={300} className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="No onions, extra lemon…" />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-full border border-sand-300">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-11 w-11 text-xl text-ink-800" aria-label="One less">−</button>
            <span className="w-8 text-center font-semibold text-ink-900" aria-live="polite">{qty}</span>
            <button type="button" onClick={() => setQty((q) => Math.min(20, q + 1))} className="h-11 w-11 text-xl text-ink-800" aria-label="One more">+</button>
          </div>
          <button
            type="button"
            onClick={() => onAdd({ quantity: qty, spiceLevel: item.spice_adjustable ? spice : null, notes })}
            className="btn-primary flex-1"
          >
            Add {qty} · {inr(item.price * qty)}
          </button>
        </div>
      </div>
    </div>
  );
}
