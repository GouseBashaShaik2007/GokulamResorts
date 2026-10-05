'use client';

import { useCallback, useEffect, useState } from 'react';

function storageKey(cartKey) {
  return `gokulam_cart_${cartKey}`;
}

// A cart line is one dish with one set of choices; the same dish with a
// different spice level or request is a separate line.
const lineIdFor = (id, spiceLevel, notes) => `${id}|${spiceLevel || ''}|${(notes || '').trim().toLowerCase()}`;

// A cart left behind is dropped after this long, so last week's half-chosen
// dinner doesn't reappear the next time the same phone scans the table.
const CART_KEEP_MS = 4 * 60 * 60 * 1000;

function readCart(cartKey) {
  if (typeof window === 'undefined' || !cartKey) return [];
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey(cartKey)) || 'null');
    // Saved as { savedAt, items }; carts from before that were a bare list with no age.
    const items = Array.isArray(saved) ? saved : saved?.items || [];
    if (!Array.isArray(saved) && saved?.savedAt && Date.now() - saved.savedAt > CART_KEEP_MS) return [];
    // Carts saved before per-line choices existed have no lineId.
    return items.map((i) => ({ ...i, lineId: i.lineId || lineIdFor(i.id, i.spiceLevel, i.notes) }));
  } catch {
    return [];
  }
}

// Client-side cart, persisted per ordering context (table vs counter) so a
// table's cart and the counter's don't collide in the same browser.
// `cartKey` null keeps the cart in memory only: the kiosk, where the next
// customer must never find the last one's order.
export function useCart(cartKey) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    setItems(readCart(cartKey));
  }, [cartKey]);

  const persist = useCallback(
    (next) => {
      if (!cartKey) return next;
      try {
        window.localStorage.setItem(storageKey(cartKey), JSON.stringify({ savedAt: Date.now(), items: next }));
      } catch {
        // ignore storage failures (private mode, quota, etc.)
      }
      return next;
    },
    [cartKey]
  );

  /** Add `quantity` of a dish with optional { spiceLevel, notes }. Returns the line's id (for undo). */
  const addItem = useCallback(
    (menuItem, { quantity = 1, spiceLevel = null, notes = '' } = {}) => {
      const lineId = lineIdFor(menuItem.id, spiceLevel, notes);
      setItems((prev) => {
        const existing = prev.find((i) => i.lineId === lineId);
        const next = existing
          ? prev.map((i) => (i.lineId === lineId ? { ...i, quantity: Math.min(20, i.quantity + quantity) } : i))
          : [
              ...prev,
              { lineId, id: menuItem.id, name: menuItem.name, price: Number(menuItem.price), quantity, spiceLevel, notes: notes.trim() },
            ];
        return persist(next);
      });
      return lineId;
    },
    [persist]
  );

  /** Change a line's quantity by `delta`; the line goes when it reaches 0. */
  const adjustQty = useCallback(
    (lineId, delta) => {
      setItems((prev) =>
        persist(
          prev
            .map((i) => (i.lineId === lineId ? { ...i, quantity: Math.min(20, i.quantity + delta) } : i))
            .filter((i) => i.quantity > 0)
        )
      );
    },
    [persist]
  );

  const updateQty = useCallback(
    (lineId, quantity) => {
      setItems((prev) =>
        persist(
          quantity <= 0
            ? prev.filter((i) => i.lineId !== lineId)
            : prev.map((i) => (i.lineId === lineId ? { ...i, quantity: Math.min(20, quantity) } : i))
        )
      );
    },
    [persist]
  );

  const removeItem = useCallback((lineId) => updateQty(lineId, 0), [updateQty]);
  const clear = useCallback(() => setItems(persist([])), [persist]);
  /** Put a set of lines back (undo for "clear"). */
  const restore = useCallback((lines) => setItems(persist(lines)), [persist]);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const quantityOf = (id) => items.filter((i) => i.id === id).reduce((s, i) => s + i.quantity, 0);

  return { items, addItem, adjustQty, removeItem, updateQty, clear, restore, total, itemCount, quantityOf };
}
