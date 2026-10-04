'use client';

import { useParams } from 'next/navigation';
import { tableNumber } from '@/lib/foodOrders';

/**
 * The bar across the top of the ordering screens. It stays in view while the
 * menu scrolls, with the table number large on the right — the one fact that
 * catches a code scanned at the wrong table.
 */
export default function OrderingHeader() {
  const table = tableNumber(useParams().tableId);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-navy-700 bg-navy-950 px-4 sm:px-6">
      <p className="flex items-baseline gap-2">
        <span className="font-serif text-xl font-semibold tracking-wide text-gold-600">Gokulam</span>
        <span className="text-xs font-medium uppercase tracking-[0.25em] text-navy-200">Restaurant</span>
      </p>
      {table && <p className="rounded-full bg-ocean-500 px-4 py-1.5 text-base font-bold text-white">Table {table}</p>}
    </header>
  );
}
