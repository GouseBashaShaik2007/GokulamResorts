import Photo from './ui/Photo';
import VegMark from './ui/VegMark';
import { inr } from '../lib/bookingUi';
import { SPICE_RATING_LABEL, allergenText } from '../lib/foodOrders';

/** Jain / heat / allergens for a dish. Nothing is shown for what the kitchen hasn't filled in. */
export function DishInfo({ item, className = '' }) {
  const allergens = allergenText(item);
  const heat = SPICE_RATING_LABEL[item.spice_rating] || '';
  if (!item.is_jain && !heat && !allergens) return null;
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-navy-300 ${className}`}>
      {item.is_jain && <span className="rounded-full border border-green-700/50 px-2 py-0.5 font-semibold text-green-800">Jain</span>}
      {heat && <span className="rounded-full border border-red-700/40 px-2 py-0.5 font-semibold text-red-800">Spice: {heat}</span>}
      {allergens && <span>Contains {allergens.toLowerCase()}</span>}
    </p>
  );
}

// A dish without a photo gets a plain frame — never a stock picture of some
// other plate, which made every unphotographed dish look the same (and wrong).
function NoDishPhoto() {
  return (
    <div className="photo-coming-soon" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-8 w-8 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.5" />
      </svg>
    </div>
  );
}

/**
 * Menu dish. Tapping anywhere opens the item details; `inCart` shows a count
 * badge. A dish the kitchen has marked sold out stays on the menu, greyed and
 * not orderable, so regulars can see it hasn't been taken off.
 */
export default function MenuItemCard({ item, inCart, onOpen }) {
  const soldOut = item.is_available === false;

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={soldOut}
      className={`card group flex w-full flex-col overflow-hidden text-left transition-shadow ${soldOut ? 'cursor-not-allowed opacity-60' : 'hover:shadow-xl'}`}
    >
      <div className="media-zoom relative h-40 w-full overflow-hidden">
        {item.image ? (
          <Photo src={item.image} alt="" sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
        ) : (
          <NoDishPhoto />
        )}
        <VegMark veg={item.is_veg} className="absolute left-3 top-3" />
        {inCart > 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-ocean-500 px-2.5 py-0.5 text-xs font-semibold text-white">{inCart} in order</span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-serif text-lg font-semibold text-navy-50">{item.name}</h3>
        {item.description && <p className="mt-1 line-clamp-2 text-sm text-navy-300">{item.description}</p>}
        <DishInfo item={item} className="mt-2" />
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="price text-lg">{inr(item.price)}</span>
          {soldOut ? (
            <span className="rounded-full bg-navy-800 px-3 py-1.5 text-sm font-semibold text-navy-200">Sold out today</span>
          ) : (
            <span className="rounded-full border border-ocean-500/60 px-4 py-1.5 text-sm font-semibold text-ocean-600 group-hover:bg-ocean-50">Add</span>
          )}
        </div>
      </div>
    </button>
  );
}
