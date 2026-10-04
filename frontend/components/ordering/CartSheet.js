'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { inr } from '@/lib/bookingUi';
import PhoneInput from '../site/PhoneInput';

/**
 * The order so far, the guest's details and the Place order button.
 * `order`: from usePlaceOrder — { form, setField, status, error, submit }.
 */
export default function CartSheet({ cart, isTable, order, onClear, onClose }) {
  // "N orders ahead of you" instead of a guessed wait time.
  const [queue, setQueue] = useState(null);
  useEffect(() => {
    api.get('/food-orders/queue').then((r) => setQueue(r.data.active)).catch(() => setQueue(null));
  }, []);

  const { form, setField } = order;

  return (
    <form onSubmit={order.submit} className="flex min-h-full flex-col">
      <div className="flex items-center justify-between border-b border-navy-700 px-6 py-5">
        <h2 className="font-serif text-2xl font-semibold text-navy-50">Your order</h2>
        <div className="flex items-center gap-2">
          {cart.items.length > 0 && (
            <button type="button" onClick={onClear} className="rounded px-2 py-1 text-xs text-navy-300 underline hover:text-navy-50">
              Clear
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-navy-300 hover:bg-navy-800">✕</button>
        </div>
      </div>

      <div className="flex-1 space-y-4 px-6 py-5">
        {cart.items.length === 0 && <p className="text-navy-400">Your order is empty.</p>}
        {cart.items.map((i) => (
          <div key={i.lineId} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-navy-50">{i.name}</p>
              <p className="text-xs text-navy-400">
                {inr(i.price)} each
                {i.spiceLevel && ` · ${i.spiceLevel}`}
              </p>
              {i.notes && <p className="mt-0.5 text-xs italic text-navy-300">“{i.notes}”</p>}
            </div>
            <div className="flex flex-none items-center gap-3">
              <div className="flex items-center rounded-full border border-navy-700">
                <button type="button" onClick={() => cart.updateQty(i.lineId, i.quantity - 1)} className="h-8 w-8 text-navy-100" aria-label={`One less ${i.name}`}>−</button>
                <span className="w-6 text-center text-sm font-semibold text-navy-50">{i.quantity}</span>
                <button type="button" onClick={() => cart.updateQty(i.lineId, i.quantity + 1)} className="h-8 w-8 text-navy-100" aria-label={`One more ${i.name}`}>+</button>
              </div>
              <span className="w-16 text-right text-sm font-semibold text-navy-50">{inr(i.price * i.quantity)}</span>
            </div>
          </div>
        ))}

        {cart.items.length > 0 && (
          <>
            <div className="flex items-center justify-between border-t border-navy-700 pt-4">
              <span className="text-navy-200">Total</span>
              <span className="price text-xl">{inr(cart.total)}</span>
            </div>
            {queue !== null && (
              <p className="rounded-lg bg-navy-900 px-3 py-2 text-sm text-navy-300">
                {queue === 0 ? 'The kitchen has no other orders right now.' : `${queue} order${queue > 1 ? 's' : ''} ahead of yours in the kitchen.`}
              </p>
            )}

            <div className="space-y-3 pt-2">
              <div>
                <label className="label" htmlFor="customerName">Name {!isTable && <span className="text-gold-600">*</span>}</label>
                <input id="customerName" className="input-field" value={form.customerName} required={!isTable} onChange={(e) => setField('customerName', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="customerPhone">Phone (optional)</label>
                <PhoneInput id="customerPhone" value={form.customerPhone} onChange={(customerPhone) => setField('customerPhone', customerPhone)} />
              </div>
              <div>
                {/* Its own field so the kitchen sees it as a warning, not as an ordinary note. */}
                <label className="label" htmlFor="orderAllergy">Allergies (optional)</label>
                <input id="orderAllergy" className="input-field" maxLength={200} value={form.allergy} onChange={(e) => setField('allergy', e.target.value)} placeholder="e.g. peanuts, shellfish" />
                <p className="mt-1 text-xs text-navy-400">Not every ingredient is listed on the menu. Tell us about any allergy here — the kitchen sees it at the top of your order.</p>
              </div>
              <div>
                <label className="label" htmlFor="orderNotes">Note for the kitchen (optional)</label>
                <textarea id="orderNotes" rows={2} maxLength={700} className="input-field" value={form.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="When to serve, anything else…" />
              </div>
            </div>
          </>
        )}
      </div>

      {cart.items.length > 0 && (
        <div className="sticky bottom-0 border-t border-navy-700 bg-navy-950 px-6 py-4">
          {order.error && <p role="alert" className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700">{order.error}</p>}
          <button type="submit" disabled={order.status === 'placing'} className="btn-gold w-full disabled:opacity-60">
            {order.status === 'placing' ? 'Placing order…' : `Place order · ${inr(cart.total)}`}
          </button>
          <p className="mt-2 text-center text-xs text-navy-400">Pay at {isTable ? 'your table' : 'the counter'} — no online payment needed.</p>
        </div>
      )}
    </form>
  );
}
