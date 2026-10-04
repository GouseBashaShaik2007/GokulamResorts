import Link from 'next/link';
import RoomPhoto from './site/RoomPhoto';
import { Price } from './site/Currency';
import { realPhotos, roomPath } from '@/lib/rooms';

/**
 * Room-type card. `size`: 'large' (rooms page, 2-up), 'wide' (full-width
 * feature card) or 'slide' (home page slider). `heading`: the tag for the
 * room name, so it fits the page's outline (h2 on the rooms page).
 * `stay`: what this room type costs for the guest's chosen dates —
 * { quote, free } when available, { soldOut: true } or { tooSmall: true }
 * when not. Without it the card shows the nightly "from" rate.
 */
export default function RoomCard({ room, size = 'large', heading: Heading = 'h3', stay }) {
  const photo = realPhotos(room)[0];
  const wide = size === 'wide';
  const imageHeight = { large: 'h-64 sm:h-72', wide: 'h-64 lg:h-full lg:min-h-[22rem]', slide: 'h-56' }[size];

  const facts = [
    `Up to ${room.capacity} guests`,
    room.bed_type,
    room.size_sqft ? `${room.size_sqft} sq ft` : null,
    room.views?.length ? room.views[0] + (room.views.length > 1 ? ' +' : '') : null,
  ].filter(Boolean);

  return (
    <Link
      href={roomPath(room)}
      className={`card group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-xl ${wide ? 'lg:grid lg:grid-cols-[3fr_2fr]' : ''}`}
    >
      <div className={`media-zoom relative w-full overflow-hidden ${imageHeight}`}>
        <RoomPhoto src={photo} alt={room.name} />
        {room.bed_type && photo && <span className="photo-badge absolute left-4 top-4">{room.bed_type}</span>}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <Heading className={`font-serif font-semibold text-navy-50 ${wide ? 'text-3xl' : 'text-2xl'}`}>{room.name}</Heading>
        <p className={`mt-2 text-sm leading-relaxed text-navy-300 ${wide ? 'line-clamp-4' : 'line-clamp-2'}`}>{room.description}</p>

        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy-300">
          {facts.map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-gold-400" aria-hidden="true" />
              {f}
            </li>
          ))}
        </ul>

        <div className="min-h-6 flex-1" aria-hidden="true" />
        <div className="flex items-end justify-between gap-3 border-t border-navy-700 pt-5">
          {stay?.quote ? (
            <div>
              <span className="block text-xs text-navy-400">
                {stay.quote.nights} night{stay.quote.nights === 1 ? '' : 's'}, including GST
              </span>
              <Price inr={stay.quote.total} className="text-xl" />
              {stay.free <= 2 && (
                <span className="mt-0.5 block text-xs font-medium text-orange-700">Only {stay.free} left for your dates</span>
              )}
            </div>
          ) : stay?.soldOut ? (
            <p className="text-sm font-medium text-navy-300">Fully booked for your dates</p>
          ) : stay?.tooSmall ? (
            <p className="text-sm font-medium text-navy-300">Fits up to {room.capacity} guests</p>
          ) : (
            <div>
              <span className="block text-xs text-navy-400">from</span>
              <Price inr={room.price_per_night} suffix="+ GST / night" className="text-xl" />
            </div>
          )}
          <span className="whitespace-nowrap text-sm font-semibold text-ocean-500 transition-transform group-hover:translate-x-1">
            View room →
          </span>
        </div>
      </div>
    </Link>
  );
}
