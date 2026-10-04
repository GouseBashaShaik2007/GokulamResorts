'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { inr } from '@/lib/bookingUi';
import { GUEST_ORDER_STATUS } from '@/lib/foodOrders';
import { recentOrderTokens } from '@/lib/myOrders';

const REFRESH_MS = 30000;

/**
 * "Your orders from this phone": what has been ordered so far in this sitting,
 * each with its status, and the running total. Nothing is shown before the
 * first order. `confirmationHref(token)` builds the link to one order's page.
 * `minOrders`: show it only once there are this many (an order's own page
 * passes 2 — one order would only repeat what is already on screen).
 */
export default function YourOrders({ cartKey, confirmationHref, minOrders = 1, className = 'mb-6' }) {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const tokens = recentOrderTokens(cartKey);
      if (tokens.length === 0) return;
      const found = await Promise.all(
        tokens.map((token) => api.get(`/food-orders/${token}`).then((r) => ({ ...r.data.order, token })).catch(() => null))
      );
      if (!cancelled) setOrders(found.filter(Boolean));
    };
    load();
    const id = setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [cartKey]);

  if (orders.length < minOrders) return null;
  const total = orders.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.total_amount), 0);

  return (
    <section aria-label="Your orders from this phone" className={`rounded-2xl border border-navy-700 bg-navy-900 px-5 py-4 text-left ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-navy-50">Ordered from this phone</h2>
        <p className="text-sm text-navy-300">So far: <span className="price">{inr(total)}</span></p>
      </div>
      <ul className="mt-2 flex flex-wrap gap-2">
        {orders.map((o) => (
          <li key={o.token}>
            <Link
              href={confirmationHref(o.token)}
              className="flex items-center gap-2 rounded-full border border-navy-700 bg-navy-950 px-3 py-1.5 text-sm text-navy-100 hover:border-ocean-400"
            >
              <span className="font-medium">#{o.id}</span>
              <span className="text-navy-300">{o.items.reduce((n, i) => n + i.quantity, 0)} item{o.items.reduce((n, i) => n + i.quantity, 0) === 1 ? '' : 's'}</span>
              <span className={o.status === 'cancelled' ? 'text-red-700' : o.status === 'ready' ? 'font-semibold text-green-700' : 'text-ocean-600'}>
                {GUEST_ORDER_STATUS[o.status] || o.status}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
