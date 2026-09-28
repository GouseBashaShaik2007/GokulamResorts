const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';

export default function MenuItemCard({ item, quantityInCart, onAdd, onRemove }) {
  const image = item.image || FALLBACK_IMAGE;
  const price = Number(item.price).toLocaleString('en-IN');

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="relative h-40 w-full overflow-hidden">
        <img src={image} alt={item.name} className="h-full w-full object-cover" />
        <div
          className={`absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded border-2 ${
            item.is_veg ? 'border-green-500' : 'border-red-500'
          } bg-navy-950/80`}
        >
          <span className={`h-2 w-2 rounded-full ${item.is_veg ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-serif text-lg font-bold text-navy-50">{item.name}</h3>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm text-navy-300">{item.description}</p>
        )}

        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="font-serif text-lg font-bold text-gold-400">₹{price}</span>

          {quantityInCart > 0 ? (
            <div className="flex items-center gap-3 rounded-full border border-gold-500/50 px-2 py-1">
              <button
                type="button"
                onClick={onRemove}
                className="flex h-6 w-6 items-center justify-center rounded-full text-gold-400 hover:bg-gold-500/10"
                aria-label={`Remove one ${item.name}`}
              >
                −
              </button>
              <span className="w-4 text-center text-sm text-navy-50">{quantityInCart}</span>
              <button
                type="button"
                onClick={onAdd}
                className="flex h-6 w-6 items-center justify-center rounded-full text-gold-400 hover:bg-gold-500/10"
                aria-label={`Add one more ${item.name}`}
              >
                +
              </button>
            </div>
          ) : (
            <button type="button" onClick={onAdd} className="btn-gold px-4 py-2 text-sm">
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
