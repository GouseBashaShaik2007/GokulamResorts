import Link from 'next/link';
import RoomPhoto from './site/RoomPhoto';
import { Price } from './site/Currency';
import OpenBookingButton from './booking/OpenBookingButton';
import { realPhotos, roomPath, topAmenities } from '@/lib/rooms';
import { offerDates, offerSaving } from '@/lib/offers';

/**
 * Room-type card. `size`: 'large' (rooms page, 2-up), 'wide' (full-width
 * feature card) or 'slide' (home page slider). `heading`: the tag for the
 * room name, so it fits the page's outline (h2 on the rooms page).
 * `stay`: what this room type costs for the guest's chosen dates —
 * { quote, free } when available, { soldOut: true } or { tooSmall: true }
 * when not. Without it the card shows the nightly "from" rate.
 * `offer`: the best live offer covering this room type (see lib/offers.js).
 *
 * The whole card opens the room's page (the room name is a link stretched
 * over it); "Book" sits above that and opens the booking panel on this type.
 */
export default function RoomCard({ room, size = 'large', heading: Heading = 'h3', stay, offer }) {
  const photo = realPhotos(room)[0];
  const wide = size === 'wide';
  const imageHeight = { large: 'h-64 sm:h-72', wide: 'h-64 lg:h-full lg:min-h-[22rem]', slide: 'h-56' }[size];
  const bookable = !stay?.soldOut && !stay?.tooSmall;

  const facts = [
    `Up to ${room.capacity} guests`,
    room.bed_type,
    room.size_sqft ? `${room.size_sqft} sq ft` : null,
    room.views?.length ? room.views[0] + (room.views.length > 1 ? ' +' : '') : null,
    room.extra_bed_available === true ? 'Extra bed available' : null,
  ].filter(Boolean);
  const amenities = topAmenities(room, 3);

  return (
    <div className={`card media-zoom group relative flex h-full flex-col overflow-hidden transition-shadow hover:shadow-xl ${wide ? 'lg:grid lg:grid-cols-[3fr_2fr]' : ''}`}>
      <div className={`relative w-full overflow-hidden ${imageHeight}`}>
        <RoomPhoto src={photo} alt={room.name} />
        {room.bed_type && photo && <span className="photo-badge absolute left-4 top-4">{room.bed_type}</span>}
        {offer && <span className="absolute right-4 top-4 rounded-full bg-green-700 px-3 py-1 text-xs font-semibold text-white shadow">{offerSaving(offer)}</span>}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <Heading className={`font-serif font-semibold text-ink-900 ${wide ? 'text-3xl' : 'text-2xl'}`}>
          <Link href={roomPath(room)} className="rounded after:absolute after:inset-0 after:content-[''] focus:outline-none focus-visible:after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ocean-400">
            {room.name}
          </Link>
        </Heading>
        <p className={`mt-2 text-sm leading-relaxed text-ink-500 ${wide ? 'line-clamp-4' : 'line-clamp-2'}`}>{room.description}</p>

        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
          {facts.map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-gold-400" aria-hidden="true" />
              {f}
            </li>
          ))}
        </ul>
        {amenities.length > 0 && <p className="mt-2 text-xs text-ink-500">In the room: {amenities.join(' · ')}</p>}

        {offer && (
          <p className="mt-4 text-sm font-medium text-green-800">
            {offer.name}: {offerSaving(offer)} per night for stays {offerDates(offer)}
          </p>
        )}

        <div className="min-h-6 flex-1" aria-hidden="true" />
        <div className="flex items-end justify-between gap-3 border-t border-sand-300 pt-5">
          {stay?.quote ? (
            <div>
              <span className="block text-xs text-ink-400">
                {stay.quote.nights} night{stay.quote.nights === 1 ? '' : 's'}, including GST
              </span>
              <Price inr={stay.quote.total} className="text-xl" />
              {stay.free <= 2 && (
                <span className="mt-0.5 block text-xs font-medium text-orange-700">Only {stay.free} left for your dates</span>
              )}
            </div>
          ) : stay?.soldOut ? (
            <p className="text-sm font-medium text-ink-500">Fully booked for your dates</p>
          ) : stay?.tooSmall ? (
            <p className="text-sm font-medium text-ink-500">Fits up to {room.capacity} guests</p>
          ) : (
            <div>
              <span className="block text-xs text-ink-400">from</span>
              <Price inr={room.price_per_night} suffix="+ GST / night" className="text-xl" />
            </div>
          )}
          <div className="flex flex-none flex-col items-end gap-1.5">
            {bookable && (
              <OpenBookingButton
                roomTypeId={room.id}
                className="relative z-10 rounded-full bg-ocean-500 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-ocean-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300 focus-visible:ring-offset-2 focus-visible:ring-offset-sand-100"
              >
                Book<span className="sr-only"> {room.name}</span>
              </OpenBookingButton>
            )}
            <span className="whitespace-nowrap text-sm font-semibold text-ocean-500 transition-transform group-hover:translate-x-1" aria-hidden="true">
              View room →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
