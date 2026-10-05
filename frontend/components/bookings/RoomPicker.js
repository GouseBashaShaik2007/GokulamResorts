'use client';

import { inr } from '../../lib/bookingUi';

/**
 * Real room numbers free for the chosen dates, grouped by room type, with the
 * price for the stay. `types` is the /availability response.
 */
export default function RoomPicker({ types, selectedId, onSelect, showType = true, renderTypeHeader }) {
  if (!types) return null;
  if (types.length === 0) {
    return <p className="rounded-lg bg-sand-200 p-4 text-sm text-ink-500">No rooms are free for these dates. Try different dates.</p>;
  }

  return (
    <div className="space-y-5">
      {types.map(({ roomType, quote, units }) => (
        <div key={roomType.id}>
          {renderTypeHeader?.(roomType)}
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            {showType && <p className="font-medium text-ink-900">{roomType.name}</p>}
            <p className="text-sm text-ink-500">
              {quote.promo > 0 && <span className="mr-2 text-ink-300 line-through">{inr(quote.base)}</span>}
              <span className="price">{inr(quote.total)}</span> for {quote.nights} night{quote.nights > 1 ? 's' : ''}
              {quote.promo > 0 && <span className="ml-2 rounded bg-green-500/15 px-1.5 py-0.5 text-xs text-green-700">{quote.promoDetails[0].name}</span>}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {units.map((u) => {
              const selected = u.id === selectedId;
              return (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => onSelect(u, roomType, quote)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${
                    selected ? 'border-gold-400 bg-gold-500/10 ring-1 ring-gold-400' : 'border-sand-300 bg-sand-200 hover:border-ink-300'
                  }`}
                  aria-pressed={selected}
                >
                  <span className="block font-serif text-lg font-bold text-ink-900">{u.unitNumber}</span>
                  <span className="block text-xs text-ink-500">
                    {u.view || roomType.name}
                    {u.floor ? ` · Floor ${u.floor}` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
