'use client';

import { useCallback, useEffect, useState } from 'react';

function storageKey(cartKey) {
  return `gokulam_cart_${cartKey}`;
}

// A cart line is one dish with one set of choices; the same dish with a
// different spice level or request is a separate line.
const lineIdFor = (id, spiceLevel, notes) => `${id}|${spiceLevel || ''}|${(notes || '').trim().toLowerCase()}`;

function readCart(cartKey) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(cartKey));
    const items = raw ? JSON.parse(raw) : [];
    // Carts saved before per-line choices existed have no lineId.
    return items.map((i) => ({ ...i, lineId: i.lineId || lineIdFor(i.id, i.spiceLevel, i.notes) }));
  } catch {
    return [];
  }
}

// Client-side cart, persisted per ordering context (table vs walk-in) so a
// QR-menu cart and the walk-in cart don't collide in the same browser.
export function useCart(cartKey) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    setItems(readCart(cartKey));
  }, [cartKey]);

  const persist = useCallback(
    (next) => {
      try {
        window.localStorage.setItem(storageKey(cartKey), JSON.stringify(next));
      } catch {
        // ignore storage failures (private mode, quota, etc.)
      }
      return next;
    },
    [cartKey]
  );

  /** Add `quantity` of a dish with optional { spiceLevel, notes }. */
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

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const quantityOf = (id) => items.filter((i) => i.id === id).reduce((s, i) => s + i.quantity, 0);

  return { items, addItem, removeItem, updateQty, clear, total, itemCount, quantityOf };
}
