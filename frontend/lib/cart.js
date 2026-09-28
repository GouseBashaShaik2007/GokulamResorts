'use client';

import { useCallback, useEffect, useState } from 'react';

function storageKey(cartKey) {
  return `gokulam_cart_${cartKey}`;
}

function readCart(cartKey) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(cartKey));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Client-side cart, persisted per browser tab context (table vs kiosk) so a
// QR-menu cart and the kiosk cart don't collide if opened in the same browser.
export function useCart(cartKey) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    setItems(readCart(cartKey));
  }, [cartKey]);

  const persist = useCallback(
    (next) => {
      setItems(next);
      try {
        window.localStorage.setItem(storageKey(cartKey), JSON.stringify(next));
      } catch {
        // ignore storage failures (private mode, quota, etc.)
      }
    },
    [cartKey]
  );

  const addItem = useCallback(
    (menuItem) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.id === menuItem.id);
        const next = existing
          ? prev.map((i) => (i.id === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i))
          : [...prev, { id: menuItem.id, name: menuItem.name, price: Number(menuItem.price), quantity: 1 }];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const updateQty = useCallback(
    (id, quantity) => {
      setItems((prev) => {
        const next =
          quantity <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, quantity } : i));
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const removeItem = useCallback((id) => updateQty(id, 0), [updateQty]);

  const clear = useCallback(() => persist([]), [persist]);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return { items, addItem, removeItem, updateQty, clear, total, itemCount };
}
