import Link from 'next/link';
import OpenBookingButton from './booking/OpenBookingButton';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';

export default function RoomCard({ room, variant = 'default' }) {
  const image = room.images?.[0] || FALLBACK_IMAGE;
  const price = Number(room.price_per_night).toLocaleString('en-IN');
  const isFeature = variant === 'feature';

  return (
    <div className="card group overflow-hidden">
      <div className={`media-zoom relative w-full overflow-hidden ${isFeature ? 'h-64 lg:h-[26rem]' : 'h-56'}`}>
        {/* Using a plain <img> keeps this component free of remote-domain image config */}
        <img src={image} alt={room.name} className="h-full w-full object-cover" />
        <div className="glass absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold-400">
          {room.bed_type || 'Luxury Room'}
        </div>
      </div>

      <div className={`relative px-5 pb-5 ${isFeature ? 'pt-8' : 'pt-6'}`}>
        {/* Price badge overlaps the image/body seam */}
        <div className="glass absolute -top-6 right-5 rounded-2xl px-4 py-2 text-right">
          <span className="price text-xl">₹{price}</span>
          <span className="block text-[0.65rem] text-navy-300">/ night</span>
        </div>

        <h3 className={`font-serif font-semibold text-navy-50 ${isFeature ? 'text-2xl' : 'text-xl'}`}>
          {room.name}
        </h3>
        <p className={`mt-2 text-sm text-navy-300 ${isFeature ? 'line-clamp-3' : 'line-clamp-2'}`}>
          {room.description}
        </p>

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

        <div className="mt-5 flex items-center justify-end gap-3 border-t border-navy-800 pt-4">
          <Link href={`/booking/${room.id}`} className="text-sm text-navy-300 hover:text-gold-400">
            Details
          </Link>
          <OpenBookingButton roomTypeId={room.id} className="btn-gold px-5 py-2 text-sm">
            Book
          </OpenBookingButton>
        </div>
      </div>
    </div>
  );
}
