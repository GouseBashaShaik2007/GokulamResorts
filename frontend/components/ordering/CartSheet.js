'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { inr } from '@/lib/bookingUi';
import PhoneInput from '../site/PhoneInput';

// What the main button says, and the line under it, for each kind of order.
// A table and a hotel room pay now, by UPI or card on the guest's phone; the
// counter's order is placed first and paid at the counter.
function wording({ type, room, order, total }) {
  if (order.paysOnline) {
    const busy = { opening: 'Opening the payment…', waiting: 'Waiting for your payment…', confirming: 'Checking your payment…' }[order.stage];
    return {
      button: busy || `Pay ${inr(total)} and order`,
      note: `You pay now by UPI or card, and we bring it to ${type === 'room' ? `Room ${room}` : 'your table'}.`,
    };
  }
  return {
    button: order.status === 'placing' ? 'Placing order…' : `Place order · ${inr(total)}`,
    note: 'Pay at the counter — no online payment needed.',
  };
}

/**
 * The order so far, the guest's details and the button that pays for it (a
 * table, a hotel room) or places it (the counter).
 * `orderContext`: which QR code opened the page (lib/foodOrders.js).
 * `order`: from usePlaceOrder.
 */
export default function CartSheet({ cart, orderContext, order, onClear, onClose }) {
  const { type } = orderContext;
  const nameRequired = type === 'counter'; // a counter order is called out by name
  // "N orders ahead of you" instead of a guessed wait time.
  const [queue, setQueue] = useState(null);
  useEffect(() => {
    api.get('/food-orders/queue').then((r) => setQueue(r.data.active)).catch(() => setQueue(null));
  }, []);

  const { form, setField } = order;
  const busy = order.status === 'placing' || order.status === 'paying';
  const text = wording({ type, room: orderContext.roomId, order, total: cart.total });

  return (
    <form onSubmit={order.submit} className="flex min-h-full flex-col">
      <div className="flex items-center justify-between border-b border-sand-300 px-6 py-5">
        <h2 className="font-serif text-2xl font-semibold text-ink-900">Your order</h2>
        <div className="flex items-center gap-2">
          {cart.items.length > 0 && (
            <button type="button" onClick={onClear} className="rounded px-2 py-1 text-xs text-ink-500 underline hover:text-ink-900">
              Clear
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-500 hover:bg-sand-200">✕</button>
        </div>
      </div>

      <div className="flex-1 space-y-4 px-6 py-5">
        {cart.items.length === 0 && <p className="text-ink-400">Your order is empty.</p>}
        {cart.items.map((i) => (
          <div key={i.lineId} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-ink-900">{i.name}</p>
              <p className="text-xs text-ink-400">
                {inr(i.price)} each
                {i.spiceLevel && ` · ${i.spiceLevel}`}
              </p>
              {i.notes && <p className="mt-0.5 text-xs italic text-ink-500">“{i.notes}”</p>}
            </div>
            <div className="flex flex-none items-center gap-3">
              <div className="flex items-center rounded-full border border-sand-300">
                <button type="button" onClick={() => cart.updateQty(i.lineId, i.quantity - 1)} className="h-8 w-8 text-ink-800" aria-label={`One less ${i.name}`}>−</button>
                <span className="w-6 text-center text-sm font-semibold text-ink-900">{i.quantity}</span>
                <button type="button" onClick={() => cart.updateQty(i.lineId, i.quantity + 1)} className="h-8 w-8 text-ink-800" aria-label={`One more ${i.name}`}>+</button>
              </div>
              <span className="w-16 text-right text-sm font-semibold text-ink-900">{inr(i.price * i.quantity)}</span>
            </div>
          </div>
        ))}

        {cart.items.length > 0 && (
          <>
            <div className="flex items-center justify-between border-t border-sand-300 pt-4">
              <span className="text-ink-700">Total</span>
              <span className="price text-xl">{inr(cart.total)}</span>
            </div>
            {queue !== null && (
              <p className="rounded-lg bg-sand-100 px-3 py-2 text-sm text-ink-500">
                {queue === 0 ? 'The kitchen has no other orders right now.' : `${queue} order${queue > 1 ? 's' : ''} ahead of yours in the kitchen.`}
              </p>
            )}

            <div className="space-y-3 pt-2">
              <div>
                <label className="label" htmlFor="customerName">Name {nameRequired ? <span className="text-gold-600">*</span> : '(optional)'}</label>
                <input id="customerName" className="input-field" value={form.customerName} required={nameRequired} onChange={(e) => setField('customerName', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="customerPhone">Phone (optional)</label>
                <PhoneInput id="customerPhone" value={form.customerPhone} onChange={(customerPhone) => setField('customerPhone', customerPhone)} describedBy="customerPhoneHint" />
                <p id="customerPhoneHint" className="mt-1 text-xs text-ink-400">To get your order number and updates by SMS.</p>
              </div>
              <div>
                {/* Its own field so the kitchen sees it as a warning, not as an ordinary note. */}
                <label className="label" htmlFor="orderAllergy">Allergies (optional)</label>
                <input id="orderAllergy" className="input-field" maxLength={200} value={form.allergy} onChange={(e) => setField('allergy', e.target.value)} placeholder="e.g. peanuts, shellfish" />
                <p className="mt-1 text-xs text-ink-400">Not every ingredient is listed on the menu. Tell us about any allergy here — the kitchen sees it at the top of your order.</p>
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
        <div className="sticky bottom-0 border-t border-sand-300 bg-sand-50 px-6 py-4">
          {order.error && <p role="alert" className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700">{order.error}</p>}
          {order.testPayment ? (
            // The API has no payment gateway keys: a stand-in for the payment window.
            <div className="rounded-xl border border-amber-700/30 bg-amber-100 p-4 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-950">Test mode</p>
              <p className="mt-1 text-sm text-amber-950">No payment gateway is connected, so no money is taken. A guest would pay {inr(order.testPayment.total)} here by UPI or card.</p>
              <div className="mt-3 flex flex-col gap-2">
                <button type="button" onClick={order.testPayment.pay} className="btn-primary w-full">Pretend the guest has paid</button>
                <button type="button" onClick={order.testPayment.cancel} className="text-sm font-semibold text-amber-950 underline underline-offset-2">Cancel the payment</button>
              </div>
            </div>
          ) : (
            <>
              <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">{text.button}</button>
              <p className="mt-2 text-center text-xs text-ink-400">{text.note}</p>
            </>
          )}
        </div>
      )}
    </form>
  );
}
