// Stock image for dishes without a photo yet (data-placeholder="true").
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';

export function VegMark({ veg, className = '' }) {
  return (
    <span
      className={`inline-flex h-5 w-5 flex-none items-center justify-center rounded-sm border-2 bg-white ${veg ? 'border-green-600' : 'border-red-600'} ${className}`}
      title={veg ? 'Vegetarian' : 'Non-vegetarian'}
      role="img"
      aria-label={veg ? 'Vegetarian' : 'Non-vegetarian'}
    >
      <span className={`h-2 w-2 rounded-full ${veg ? 'bg-green-600' : 'bg-red-600'}`} />
    </span>
  );
}

/** Menu dish. Tapping anywhere opens the item details; `inCart` shows a count badge. */
export default function MenuItemCard({ item, inCart, onOpen }) {
  const image = item.image || FALLBACK_IMAGE;
  const price = Number(item.price).toLocaleString('en-IN');

  return (
    <button type="button" onClick={onOpen} className="card group flex w-full flex-col overflow-hidden text-left transition-shadow hover:shadow-xl">
      <div className="media-zoom relative h-40 w-full overflow-hidden">
        <img src={image} alt={item.name} className="h-full w-full object-cover" {...(item.image ? {} : { 'data-placeholder': 'true' })} />
        <VegMark veg={item.is_veg} className="absolute left-3 top-3" />
        {inCart > 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-ocean-500 px-2.5 py-0.5 text-xs font-semibold text-white">{inCart} in order</span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-serif text-lg font-semibold text-navy-50">{item.name}</h3>
        {item.description && <p className="mt-1 line-clamp-2 text-sm text-navy-300">{item.description}</p>}
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="price text-lg">₹{price}</span>
          <span className="rounded-full border border-ocean-500/60 px-4 py-1.5 text-sm font-semibold text-ocean-600 group-hover:bg-ocean-50">Add</span>
        </div>
      </div>
    </button>
  );
}
