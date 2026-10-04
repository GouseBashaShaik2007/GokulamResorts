'use client';

import { useState } from 'react';
import { SPICE_RATING_LABEL, allergenText } from '@/lib/foodOrders';

// "Starters · ₹250 · Veg · Jain · Spice: Hot · Contains nuts"
function facts(item) {
  const allergens = allergenText(item);
  return [
    item.category_name,
    `₹${Number(item.price).toLocaleString('en-IN')}`,
    item.is_veg ? 'Veg' : 'Non-Veg',
    item.is_jain && 'Jain',
    SPICE_RATING_LABEL[item.spice_rating] && `Spice: ${SPICE_RATING_LABEL[item.spice_rating]}`,
    item.spice_adjustable && 'Guest picks spice level',
    allergens && `Contains ${allergens.toLowerCase()}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Every dish, sold-out ones included, with search. */
export default function ItemList({ items, onEdit, onSoldOut, onRestore }) {
  const [search, setSearch] = useState('');
  const words = search.trim().toLowerCase();
  const visible = items.filter((i) => `${i.name} ${i.category_name || ''}`.toLowerCase().includes(words));

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-bold text-navy-50">All Menu Items</h2>
        <input
          type="search"
          aria-label="Search menu items"
          className="input-field w-full py-2 sm:w-64"
          placeholder="Search by dish or category"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="mt-4 space-y-3">
        {visible.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-navy-700 bg-navy-800 p-4">
            <div className="flex min-w-0 items-center gap-3">
              {item.image ? (
                <img src={item.image} alt="" className="h-12 w-12 flex-none rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-lg border border-dashed border-navy-600 text-[10px] text-navy-400">
                  No photo
                </div>
              )}
              <div className="min-w-0">
                <p className="font-medium text-navy-50">
                  {item.name} {!item.is_available && <span className="ml-2 text-xs text-red-700">(sold out)</span>}
                </p>
                <p className="text-sm text-navy-400">{facts(item)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onEdit(item)} className="rounded-lg border border-gold-500/50 px-3 py-1.5 text-xs text-gold-600 hover:bg-gold-500/10">
                Edit
              </button>
              {item.is_available ? (
                <button onClick={() => onSoldOut(item)} className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-500/10">
                  Mark sold out
                </button>
              ) : (
                <button onClick={() => onRestore(item)} className="rounded-lg border border-green-500/50 px-3 py-1.5 text-xs text-green-700 hover:bg-green-500/10">
                  Back on menu
                </button>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-navy-400">No menu items yet.</p>}
        {items.length > 0 && visible.length === 0 && <p className="text-navy-400">No dishes match “{search}”.</p>}
      </div>
    </div>
  );
}
