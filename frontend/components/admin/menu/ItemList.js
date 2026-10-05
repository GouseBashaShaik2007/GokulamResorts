'use client';

import { useMemo, useState } from 'react';
import { inr } from '@/lib/bookingUi';
import { SPICE_RATING_LABEL, allergenText } from '@/lib/foodOrders';

// "₹250 · Veg · Jain · Spice: Hot · Contains nuts"
function facts(item) {
  const allergens = allergenText(item);
  return [
    inr(item.price),
    item.is_veg ? 'Veg' : 'Non-Veg',
    item.is_jain && 'Jain',
    SPICE_RATING_LABEL[item.spice_rating] && `Spice: ${SPICE_RATING_LABEL[item.spice_rating]}`,
    item.spice_adjustable && 'Guest picks spice level',
    allergens && `Contains ${allergens.toLowerCase()}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function ItemRow({ item, onEdit, onSoldOut, onRestore }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sand-300 bg-sand-200 p-4">
      <div className="flex min-w-0 items-center gap-3">
        {item.image ? (
          <img src={item.image} alt="" className="h-12 w-12 flex-none rounded-lg object-cover" />
        ) : (
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-lg border border-dashed border-sand-400 text-[10px] text-ink-400">
            No photo
          </div>
        )}
        <div className="min-w-0">
          <p className="font-medium text-ink-900">
            {item.name} {!item.is_available && <span className="ml-2 text-xs text-red-700">(sold out)</span>}
          </p>
          <p className="text-sm text-ink-400">{facts(item)}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onEdit(item)} className="rounded-lg border border-gold-500/50 px-3 py-1.5 text-xs text-gold-600 hover:bg-gold-500/10">
          Edit<span className="sr-only"> {item.name}</span>
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
  );
}

/**
 * Every dish, sold-out ones included, grouped by category in menu order.
 * Search, a "sold out only" filter, and categories that fold away.
 */
export default function ItemList({ items, categories, onEdit, onSoldOut, onRestore }) {
  const [search, setSearch] = useState('');
  const [soldOutOnly, setSoldOutOnly] = useState(false);
  const [folded, setFolded] = useState({}); // category id -> true

  const groups = useMemo(() => {
    const words = search.trim().toLowerCase();
    const match = (i) => (!soldOutOnly || !i.is_available) && `${i.name} ${i.category_name || ''}`.toLowerCase().includes(words);
    const byName = (a, b) => a.name.localeCompare(b.name);
    return categories
      .map((c) => ({ ...c, items: items.filter((i) => i.category_id === c.id && match(i)).sort(byName) }))
      .filter((c) => c.items.length > 0);
  }, [items, categories, search, soldOutOnly]);

  const shownCount = groups.reduce((n, g) => n + g.items.length, 0);
  const soldOutCount = items.filter((i) => !i.is_available).length;
  const filtering = search.trim() || soldOutOnly;

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-bold text-ink-900">All Menu Items</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={soldOutOnly}
            onClick={() => setSoldOutOnly((v) => !v)}
            className={`rounded-full border px-3 py-1.5 text-sm ${soldOutOnly ? 'border-red-700 bg-red-700 text-white' : 'border-sand-400 text-ink-700'}`}
          >
            Sold out ({soldOutCount})
          </button>
          <input
            type="search"
            aria-label="Search menu items"
            className="input-field w-full py-2 sm:w-64"
            placeholder="Search by dish or category"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <p className="sr-only" role="status">{filtering ? `${shownCount} dish${shownCount === 1 ? '' : 'es'} shown` : ''}</p>

      <div className="mt-4 space-y-5">
        {groups.map((group) => {
          // While searching or filtering, everything that matches is shown open.
          const open = filtering || !folded[group.id];
          return (
            <section key={group.id}>
              <h3>
                <button
                  type="button"
                  aria-expanded={!!open}
                  onClick={() => setFolded((f) => ({ ...f, [group.id]: !f[group.id] }))}
                  className="flex w-full items-center justify-between gap-3 border-b border-sand-300 pb-1.5 text-left text-sm font-semibold uppercase tracking-wider text-ink-500"
                >
                  <span>
                    {group.name} <span className="font-normal text-ink-400">({group.items.length})</span>
                    {!group.is_active && <span className="ml-2 text-xs normal-case tracking-normal text-red-700">hidden category</span>}
                  </span>
                  <span aria-hidden="true" className={`text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
                </button>
              </h3>
              {open && (
                <div className="mt-3 space-y-3">
                  {group.items.map((item) => <ItemRow key={item.id} item={item} onEdit={onEdit} onSoldOut={onSoldOut} onRestore={onRestore} />)}
                </div>
              )}
            </section>
          );
        })}
        {items.length === 0 && <p className="text-ink-400">No menu items yet.</p>}
        {items.length > 0 && groups.length === 0 && <p className="text-ink-400">No dishes match{search.trim() ? ` “${search}”` : ''}.</p>}
      </div>
    </div>
  );
}
