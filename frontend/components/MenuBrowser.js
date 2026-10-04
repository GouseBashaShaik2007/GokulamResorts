'use client';

import { useMemo, useState } from 'react';
import { useCart } from '../lib/cart';
import { inr } from '../lib/bookingUi';
import { orderHref, orderingKey } from '../lib/foodOrders';
import Chip from './ui/Chip';
import Sheet from './ui/Sheet';
import VegMark from './ui/VegMark';
import { useToast } from './ui/Toast';
import CartSheet from './ordering/CartSheet';
import ItemSheet from './ordering/ItemSheet';
import MenuSections from './ordering/MenuSections';
import YourOrders from './ordering/YourOrders';
import usePlaceOrder from './ordering/usePlaceOrder';

/**
 * The ordering screen: search and filters, the menu, a dish sheet, and the
 * order (cart) sheet. `orderContext` says where the order is for — a table or
 * the counter — and carries the key from the QR code that opened the page
 * (see lib/foodOrders.js).
 */
export default function MenuBrowser({ categories, items, orderContext }) {
  const isTable = orderContext.type === 'table';
  const cartKey = orderingKey(orderContext);
  const cart = useCart(cartKey);
  const toast = useToast();
  const order = usePlaceOrder({ orderContext, cart, cartKey });

  const [vegOnly, setVegOnly] = useState(false);
  const [jainOnly, setJainOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null); // the dish whose sheet is open
  const [cartOpen, setCartOpen] = useState(false);
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

  const clearOrder = () => {
    const lines = cart.items;
    cart.clear();
    toast('Order cleared', { tone: 'info', action: { label: 'Undo', onClick: () => cart.restore(lines) } });
  };

  return (
    <div className="pb-28">
      <YourOrders cartKey={cartKey} confirmationHref={(token) => orderHref(orderContext, token)} />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="min-w-[12rem] flex-1">
          <span className="sr-only">Search the menu</span>
          <input type="search" className="input-field py-2.5" placeholder="Search dishes" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <Chip tone="green" pressed={vegOnly} onClick={() => setVegOnly((v) => !v)}>
          <VegMark veg />
          Veg only
        </Chip>
        {hasJain && <Chip tone="green" pressed={jainOnly} onClick={() => setJainOnly((v) => !v)}>Jain only</Chip>}
      </div>

      {sections.length === 0 && (
        <div className="card p-8 text-center text-navy-300">
          No dishes match.{' '}
          <button type="button" onClick={() => { setSearch(''); setVegOnly(false); setJainOnly(false); }} className="font-semibold text-ocean-600 underline">
            Show the whole menu
          </button>
        </div>
      )}

      <MenuSections sections={sections} quantityOf={cart.quantityOf} onOpen={setDetail} />

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

      <Sheet open={!!detail} onClose={() => setDetail(null)} label={detail?.name || 'Dish'}>
        {detail && (
          <ItemSheet
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
      </Sheet>

      <Sheet open={cartOpen} onClose={() => setCartOpen(false)} label="Your order">
        <CartSheet cart={cart} isTable={isTable} order={order} onClear={clearOrder} onClose={() => setCartOpen(false)} />
      </Sheet>
    </div>
  );
}
