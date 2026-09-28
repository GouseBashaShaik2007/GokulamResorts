import Link from 'next/link';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';

export default function RoomCard({ room }) {
  const image = room.images?.[0] || FALLBACK_IMAGE;
  const price = Number(room.price_per_night).toLocaleString('en-IN');

  return (
    <div className="card group overflow-hidden transition-transform duration-200 hover:-translate-y-1">
      <div className="relative h-56 w-full overflow-hidden">
        {/* Using a plain <img> keeps this component free of remote-domain image config */}
        <img
          src={image}
          alt={room.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 rounded-full bg-navy-950/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold-400">
          {room.bed_type || 'Luxury Room'}
        </div>
      </div>

      <div className="p-5">
        <h3 className="font-serif text-xl font-bold text-navy-50">{room.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-navy-300">{room.description}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(room.amenities || []).slice(0, 3).map((a) => (
            <span
              key={a}
              className="rounded-full border border-navy-700 bg-navy-800 px-2.5 py-1 text-xs text-navy-200"
            >
              {a}
            </span>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-navy-800 pt-4">
          <div>
            <span className="font-serif text-2xl font-bold text-gold-400">₹{price}</span>
            <span className="text-sm text-navy-400"> / night</span>
          </div>
          <Link href={`/booking/${room.id}`} className="btn-gold px-5 py-2 text-sm">
            View &amp; Book
          </Link>
        </div>
      </div>
    </div>
  );
}
