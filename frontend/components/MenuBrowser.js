'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../lib/api';
import { useCart } from '../lib/cart';
import MenuItemCard from './MenuItemCard';

export default function MenuBrowser({ categories, items, orderContext }) {
  const router = useRouter();
  const cartKey = orderContext.type === 'table' ? `table-${orderContext.tableId}` : 'kiosk';
  const cart = useCart(cartKey);

  const [activeCategory, setActiveCategory] = useState('all');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', notes: '' });
  const [status, setStatus] = useState('idle'); // idle | placing | error
  const [error, setError] = useState('');

  const visibleItems =
    activeCategory === 'all' ? items : items.filter((i) => String(i.category_id) === String(activeCategory));

  const quantityFor = (itemId) => cart.items.find((i) => i.id === itemId)?.quantity || 0;

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setError('');

    if (cart.items.length === 0) {
      setError('Your cart is empty.');
      return;
    }
    if (orderContext.type === 'kiosk' && !form.customerName.trim()) {
      setError('Please enter a name so we can call out your order.');
      return;
    }

    try {
      setStatus('placing');
      const payload = {
        orderType: orderContext.type,
        ...(orderContext.type === 'table' ? { tableNumber: String(orderContext.tableId) } : {}),
        customerName: form.customerName || undefined,
        customerPhone: form.customerPhone || undefined,
        notes: form.notes || undefined,
        items: cart.items.map((i) => ({ menuItemId: i.id, quantity: i.quantity })),
      };
      const res = await api.post('/food-orders', payload);
      const { orderId } = res.data;

      cart.clear();

      const confirmationPath =
        orderContext.type === 'table'
          ? `/order/${orderContext.tableId}/confirmation?orderId=${orderId}`
          : `/kiosk/confirmation?orderId=${orderId}`;
      router.push(confirmationPath);
    } catch (err) {
      setStatus('error');
      setError(err?.response?.data?.message || 'Could not place your order. Please try again.');
    }
  };

  return (
    <div className="pb-28">
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            activeCategory === 'all' ? 'bg-gold-500 text-navy-950' : 'bg-navy-800 text-navy-200'
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCategory(c.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              String(activeCategory) === String(c.id) ? 'bg-gold-500 text-navy-950' : 'bg-navy-800 text-navy-200'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {visibleItems.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              quantityInCart={quantityFor(item.id)}
              onAdd={() => cart.addItem(item)}
              onRemove={() => cart.updateQty(item.id, quantityFor(item.id) - 1)}
            />
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center text-navy-300">No items in this category yet.</div>
      )}

      {cart.itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-navy-700 bg-navy-900/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="text-sm text-navy-200">
              <span className="font-semibold text-navy-50">{cart.itemCount} item{cart.itemCount > 1 ? 's' : ''}</span>
              <span className="mx-2 text-navy-500">·</span>
              <span className="font-serif text-lg font-bold text-gold-400">
                ₹{cart.total.toLocaleString('en-IN')}
              </span>
            </div>
            <button type="button" onClick={() => setCheckoutOpen(true)} className="btn-gold px-6 py-2 text-sm">
              View Cart & Order
            </button>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 sm:items-center">
          <div className="card max-h-[85vh] w-full max-w-lg overflow-y-auto p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-xl font-bold text-navy-50">Your Order</h2>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                className="text-navy-400 hover:text-navy-100"
                aria-label="Close cart"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {cart.items.map((i) => (
                <div key={i.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-navy-50">{i.name}</p>
                    <p className="text-navy-400">
                      ₹{i.price.toLocaleString('en-IN')} × {i.quantity}
                    </p>
                  </div>
                  <p className="font-semibold text-gold-400">₹{(i.price * i.quantity).toLocaleString('en-IN')}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-navy-700 pt-4">
              <span className="text-navy-200">Total</span>
              <span className="font-serif text-xl font-bold text-gold-400">₹{cart.total.toLocaleString('en-IN')}</span>
            </div>

            <form onSubmit={handlePlaceOrder} className="mt-6 space-y-4">
              <div>
                <label className="label" htmlFor="customerName">
                  Name {orderContext.type === 'kiosk' && <span className="text-gold-400">*</span>}
                </label>
                <input
                  id="customerName" name="customerName" className="input-field"
                  value={form.customerName} onChange={handleChange}
                  placeholder="Priya Sharma"
                  required={orderContext.type === 'kiosk'}
                />
              </div>
              <div>
                <label className="label" htmlFor="customerPhone">Phone (optional)</label>
                <input
                  id="customerPhone" name="customerPhone" className="input-field"
                  value={form.customerPhone} onChange={handleChange}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="label" htmlFor="notes">Notes (optional)</label>
                <textarea
                  id="notes" name="notes" rows={2} className="input-field"
                  value={form.notes} onChange={handleChange}
                  placeholder="Less spicy, no onions..."
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <button type="submit" disabled={status === 'placing'} className="btn-gold w-full disabled:opacity-60">
                {status === 'placing' ? 'Placing order...' : `Place Order · ₹${cart.total.toLocaleString('en-IN')}`}
              </button>
              <p className="text-center text-xs text-navy-400">
                Pay at {orderContext.type === 'table' ? 'your table' : 'the counter'} — no online payment needed.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
