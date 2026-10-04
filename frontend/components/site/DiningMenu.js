'use client';

import { useMemo, useState } from 'react';
import { DishInfo } from '@/components/MenuItemCard';
import Chip from '@/components/ui/Chip';
import VegMark from '@/components/ui/VegMark';
import { inr } from '@/lib/bookingUi';

/**
 * The printed-menu style list on the Dining page, with search and the
 * vegetarian / Jain filters diners reach for first. Read-only: ordering
 * happens from the QR codes at the restaurant. `menu`: categories, each with
 * its `items`.
 */
export default function DiningMenu({ menu }) {
  const [vegOnly, setVegOnly] = useState(false);
  const [jainOnly, setJainOnly] = useState(false);
  const [search, setSearch] = useState('');
  // The Jain filter is only offered once the kitchen has marked some dishes.
  const hasJain = menu.some((cat) => cat.items.some((item) => item.is_jain));

  const shown = useMemo(() => {
    const words = search.trim().toLowerCase();
    return menu
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            (!vegOnly || item.is_veg) &&
            (!jainOnly || item.is_jain) &&
            (!words || `${item.name} ${item.description || ''}`.toLowerCase().includes(words))
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [menu, vegOnly, jainOnly, search]);

  const count = shown.reduce((n, cat) => n + cat.items.length, 0);
  const filtered = vegOnly || jainOnly || search.trim();

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="min-w-[12rem] flex-1 sm:max-w-sm">
          <span className="sr-only">Search the menu</span>
          <input type="search" className="input-field py-2.5" placeholder="Search dishes" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <Chip tone="green" pressed={vegOnly} onClick={() => setVegOnly((v) => !v)}>
          <VegMark veg />
          Veg only
        </Chip>
        {hasJain && <Chip tone="green" pressed={jainOnly} onClick={() => setJainOnly((v) => !v)}>Jain only</Chip>}
      </div>
      <p className="sr-only" role="status">{filtered ? `${count} dish${count === 1 ? '' : 'es'} shown` : ''}</p>

      {shown.length === 0 && (
        <p className="mt-8 text-navy-300">
          No dishes match.{' '}
          <button type="button" onClick={() => { setSearch(''); setVegOnly(false); setJainOnly(false); }} className="font-semibold text-ocean-600 underline">
            Show the whole menu
          </button>
        </p>
      )}

      <div className="mt-8 gap-12 md:columns-2">
        {shown.map((cat) => (
          <section key={cat.id} aria-labelledby={`menu-cat-${cat.id}`} className="mb-12 break-inside-avoid">
            <h3 id={`menu-cat-${cat.id}`} className="border-b border-navy-700 pb-2 font-serif text-2xl font-semibold text-navy-50">{cat.name}</h3>
            <ul className="mt-4 space-y-4">
              {cat.items.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <VegMark veg={item.is_veg} className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-navy-50">{item.name}</span>
                      <span className="min-w-[1.5rem] flex-1 border-b border-dotted border-navy-600" aria-hidden="true" />
                      <span className="price whitespace-nowrap">{inr(item.price)}</span>
                    </div>
                    {item.description && <p className="text-sm text-navy-300">{item.description}</p>}
                    <DishInfo item={item} className="mt-1" />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
