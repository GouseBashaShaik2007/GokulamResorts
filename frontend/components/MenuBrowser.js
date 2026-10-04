'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../lib/api';
import { useCart } from '../lib/cart';
import { errMsg } from '../lib/bookingUi';
import useModal from '../lib/useModal';
import { composeOrderNotes } from '../lib/foodOrders';
import MenuItemCard, { DishInfo, VegMark } from './MenuItemCard';
import Photo from './ui/Photo';
import { useToast } from './ui/Toast';
import PhoneInput from './site/PhoneInput';

const SPICE = [
  { value: 'mild', label: 'Mild' },
  { value: 'medium', label: 'Medium' },
  { value: 'hot', label: 'Hot' },
];
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// Bottom sheet on phones, slides in from the right on larger screens.
function Panel({ open, onClose, label, children }) {
  const ref = useModal(open, onClose); // focus trap, Escape, scroll lock, focus return

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[65] bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            className="fixed inset-x-0 bottom-0 z-[70] max-h-[88vh] overflow-y-auto rounded-t-3xl bg-navy-950 shadow-2xl focus:outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:max-w-md sm:rounded-none"
            initial={{ y: '100%', x: 0 }}
            animate={{ y: 0, x: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-navy-700 sm:hidden" aria-hidden="true" />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ItemDetails({ item, onAdd, onClose }) {
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
            <h2 className="font-serif text-2xl font-semibold text-navy-50">{item.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-navy-300 hover:bg-navy-800">✕</button>
        </div>
        {item.description && <p className="text-navy-300">{item.description}</p>}
        <DishInfo item={item} className="text-sm" />
        <p className="price text-xl">{inr(item.price)}</p>

        {item.spice_adjustable && (
          <fieldset>
            <legend className="label">Spice level</legend>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {SPICE.map((s) => (
                <label key={s.value} className={`cursor-pointer rounded-xl border py-2 text-center text-sm ${spice === s.value ? 'border-ocean-500 bg-ocean-500 text-white' : 'border-navy-700 text-navy-200'}`}>
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
          <div className="flex items-center rounded-full border border-navy-700">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-11 w-11 text-xl text-navy-100" aria-label="One less">−</button>
            <span className="w-8 text-center font-semibold text-navy-50" aria-live="polite">{qty}</span>
            <button type="button" onClick={() => setQty((q) => Math.min(20, q + 1))} className="h-11 w-11 text-xl text-navy-100" aria-label="One more">+</button>
          </div>
          <button
            type="button"
            onClick={() => onAdd({ quantity: qty, spiceLevel: item.spice_adjustable ? spice : null, notes })}
            className="btn-gold flex-1"
          >
            Add {qty} · {inr(item.price * qty)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MenuBrowser({ categories, items, orderContext }) {
  const router = useRouter();
  const isTable = orderContext.type === 'table';
  const cart = useCart(isTable ? `table-${orderContext.tableId}` : 'kiosk');
  const toast = useToast();

  const [vegOnly, setVegOnly] = useState(false);
  const [jainOnly, setJainOnly] = useState(false);
  const [search, setSearch] = useState('');
  // The Jain filter is only offered once the kitchen has marked some dishes.
  const hasJain = items.some((i) => i.is_jain);

  const sections = useMemo(() => {
    const words = search.trim().toLowerCase();
    const shown = items.filter(
      (i) =>
        (!vegOnly || i.is_veg) &&
        (!jainOnly || i.is_jain) &&
        (!words || `${i.name} ${i.description || ''}`.toLowerCase().includes(words))
    );
    return categories
      .map((c) => ({ ...c, items: shown.filter((i) => String(i.category_id) === String(c.id)) }))
      .filter((c) => c.items.length > 0);
  }, [categories, items, vegOnly, jainOnly, search]);

  const [active, setActive] = useState(sections[0]?.id);
  const [detail, setDetail] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [queue, setQueue] = useState(null);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', allergy: '', notes: '' });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const sectionRefs = useRef({});
  const tabsRef = useRef(null);

  // Highlight the tab for the section currently under the sticky bars.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(Number(visible[0].target.dataset.cat));
      },
      { rootMargin: '-140px 0px -60% 0px' }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  // Keep the active tab scrolled into view on narrow screens.
  useEffect(() => {
    tabsRef.current?.querySelector(`[data-tab="${active}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [active]);

  // "N orders ahead of you" instead of a guessed wait time.
  useEffect(() => {
    if (!cartOpen) return;
    api.get('/food-orders/queue').then((r) => setQueue(r.data.active)).catch(() => setQueue(null));
  }, [cartOpen]);

  const jumpTo = (id) => {
    const el = sectionRefs.current[id];
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 140, behavior: 'smooth' });
  };

  const placeOrder = async (e) => {
    e.preventDefault();
    setError('');
    if (!isTable && !form.customerName.trim()) {
      setError('Please enter a name so we can call out your order.');
      return;
    }
    try {
      setStatus('placing');
      const res = await api.post('/food-orders', {
        orderType: orderContext.type,
        accessKey: orderContext.accessKey, // from the QR code that opened this page
        ...(isTable ? { tableNumber: String(orderContext.tableId) } : {}),
        customerName: form.customerName || undefined,
        // The phone field always carries a country code; only send a real number.
        customerPhone: /\d{6,}/.test(form.customerPhone) ? form.customerPhone : undefined,
        notes: composeOrderNotes(form) || undefined,
        items: cart.items.map((i) => ({ menuItemId: i.id, quantity: i.quantity, spiceLevel: i.spiceLevel || undefined, notes: i.notes || undefined })),
      });
      cart.clear();
      // The order's private token, plus the QR key so "Order more" works from there.
      const query = new URLSearchParams({ order: res.data.token, k: orderContext.accessKey || '' });
      router.push(`${isTable ? `/order/${orderContext.tableId}` : '/dine'}/confirmation?${query}`);
    } catch (err) {
      setStatus('error');
      setError(errMsg(err, 'Could not place your order. Please try again.'));
    }
  };

  const clearOrder = () => {
    const lines = cart.items;
    cart.clear();
    toast('Order cleared', { tone: 'info', action: { label: 'Undo', onClick: () => cart.restore(lines) } });
  };

  return (
    <div className="pb-28">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="min-w-[12rem] flex-1">
          <span className="sr-only">Search the menu</span>
          <input
            type="search"
            className="input-field py-2.5"
            placeholder="Search dishes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button
          type="button"
          aria-pressed={vegOnly}
          onClick={() => setVegOnly((v) => !v)}
          className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            vegOnly ? 'border-green-700 bg-green-700 text-white' : 'border-navy-700 text-navy-200 hover:border-green-700'
          }`}
        >
          <VegMark veg />
          Veg only
        </button>
        {hasJain && (
          <button
            type="button"
            aria-pressed={jainOnly}
            onClick={() => setJainOnly((v) => !v)}
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              jainOnly ? 'border-green-700 bg-green-700 text-white' : 'border-navy-700 text-navy-200 hover:border-green-700'
            }`}
          >
            Jain only
          </button>
        )}
      </div>

      {sections.length === 0 && (
        <div className="card p-8 text-center text-navy-300">
          No dishes match.{' '}
          <button type="button" onClick={() => { setSearch(''); setVegOnly(false); setJainOnly(false); }} className="font-semibold text-ocean-600 underline">
            Show the whole menu
          </button>
        </div>
      )}

      {/* Category tabs stay under the navbar while scrolling. */}
      <div className="sticky top-[var(--nav-h)] z-30 -mx-4 border-b border-navy-700 bg-navy-950/95 px-4 backdrop-blur sm:mx-0">
        <div ref={tabsRef} className="flex gap-2 overflow-x-auto py-3 [scrollbar-width:none]" role="navigation" aria-label="Menu categories">
          {sections.map((c) => (
            <button
              key={c.id}
              type="button"
              data-tab={c.id}
              aria-current={active === c.id ? 'true' : undefined}
              onClick={() => jumpTo(c.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${active === c.id ? 'bg-ocean-500 text-white' : 'bg-navy-800 text-navy-200 hover:bg-navy-700'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {sections.map((c) => (
        <section key={c.id} data-cat={c.id} ref={(el) => { sectionRefs.current[c.id] = el; }} className="pt-10">
          <h2 className="mb-5 font-serif text-3xl font-semibold text-navy-50">{c.name}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {c.items.map((item) => (
              <MenuItemCard key={item.id} item={item} inCart={cart.quantityOf(item.id)} onOpen={() => setDetail(item)} />
            ))}
          </div>
        </section>
      ))}

      {/* Order button */}
      {cart.itemCount > 0 && !cartOpen && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full bg-ocean-500 px-6 py-3.5 font-semibold text-white shadow-xl sm:left-auto sm:right-6 sm:translate-x-0"
        >
          <span className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-white/20 px-2 text-sm">{cart.itemCount}</span>
          View order · {inr(cart.total)}
        </button>
      )}

      <Panel open={!!detail} onClose={() => setDetail(null)} label={detail?.name || 'Dish'}>
        {detail && (
          <ItemDetails
            key={detail.id}
            item={detail}
            onClose={() => setDetail(null)}
            onAdd={(opts) => {
              const lineId = cart.addItem(detail, opts);
              setDetail(null);
              toast(`${opts.quantity} × ${detail.name} added to your order`, {
                action: { label: 'Undo', onClick: () => cart.adjustQty(lineId, -opts.quantity) },
              });
            }}
          />
        )}
      </Panel>

      <Panel open={cartOpen} onClose={() => setCartOpen(false)} label="Your order">
        <form onSubmit={placeOrder} className="flex min-h-full flex-col">
          <div className="flex items-center justify-between border-b border-navy-700 px-6 py-5">
            <h2 className="font-serif text-2xl font-semibold text-navy-50">Your order</h2>
            <div className="flex items-center gap-2">
              {cart.items.length > 0 && (
                <button type="button" onClick={clearOrder} className="rounded px-2 py-1 text-xs text-navy-300 underline hover:text-navy-50">
                  Clear
                </button>
              )}
              <button type="button" onClick={() => setCartOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-navy-300 hover:bg-navy-800">✕</button>
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
                    <input id="customerName" className="input-field" value={form.customerName} required={!isTable} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label" htmlFor="customerPhone">Phone (optional)</label>
                    <PhoneInput id="customerPhone" value={form.customerPhone} onChange={(customerPhone) => setForm((f) => ({ ...f, customerPhone }))} />
                  </div>
                  <div>
                    {/* Its own field so the kitchen sees it as a warning, not as an ordinary note. */}
                    <label className="label" htmlFor="orderAllergy">Allergies (optional)</label>
                    <input id="orderAllergy" className="input-field" maxLength={200} value={form.allergy} onChange={(e) => setForm((f) => ({ ...f, allergy: e.target.value }))} placeholder="e.g. peanuts, shellfish" />
                    <p className="mt-1 text-xs text-navy-400">Not every ingredient is listed on the menu. Tell us about any allergy here — the kitchen sees it at the top of your order.</p>
                  </div>
                  <div>
                    <label className="label" htmlFor="orderNotes">Note for the kitchen (optional)</label>
                    <textarea id="orderNotes" rows={2} maxLength={700} className="input-field" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="When to serve, anything else…" />
                  </div>
                </div>
              </>
            )}
          </div>

          {cart.items.length > 0 && (
            <div className="sticky bottom-0 border-t border-navy-700 bg-navy-950 px-6 py-4">
              {error && <p role="alert" className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700">{error}</p>}
              <button type="submit" disabled={status === 'placing'} className="btn-gold w-full disabled:opacity-60">
                {status === 'placing' ? 'Placing order…' : `Place order · ${inr(cart.total)}`}
              </button>
              <p className="mt-2 text-center text-xs text-navy-400">Pay at {isTable ? 'your table' : 'the counter'} — no online payment needed.</p>
            </div>
          )}
        </form>
      </Panel>
    </div>
  );
}
