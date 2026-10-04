import { notFound } from 'next/navigation';
import Link from 'next/link';
import Reveal from '@/components/motion/Reveal';
import RoomGallery from '@/components/site/RoomGallery';
import RoomBookingBox from '@/components/site/RoomBookingBox';
import RecentlyViewed, { TrackRoomView } from '@/components/site/RecentlyViewed';
import ShareRoom from '@/components/site/ShareRoom';
import Icon from '@/components/ui/Icon';
import PageHeader from '@/components/ui/PageHeader';
import { jsonLd } from '@/lib/jsonLd';
import { groupAmenities, includesBreakfast, realPhotos, roomPath, sqftToM2 } from '@/lib/rooms';
import { getContact, getOffers, getRoomBySlug, getRooms } from '@/lib/server-api';
import { offersForRoom } from '@/lib/offers';
import { SITE_URL } from '@/lib/site';

export async function generateMetadata({ params }) {
  const room = await getRoomBySlug(params.slug);
  if (!room) return { title: 'Room' };

  const text = String(room.description || '').trim();
  const description = text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
  const photo = realPhotos(room)[0];
  return {
    title: room.name,
    ...(description ? { description } : {}),
    alternates: { canonical: roomPath(room) },
    openGraph: { title: room.name, ...(description ? { description } : {}), ...(photo ? { images: [photo] } : {}) },
  };
}

function Feature({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-navy-700 px-4 py-3">
      <Icon name={icon} className="h-6 w-6 text-ocean-500" />
      <div>
        <p className="text-xs text-navy-400">{label}</p>
        <p className="text-sm font-medium text-navy-50">{value}</p>
      </div>
    </div>
  );
}

// The room in the format search engines read: what it is, and its nightly rate.
function structuredData(room, photos) {
  const offer = {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    price: Number(room.price_per_night),
    priceCurrency: 'INR',
    description: 'Per night, before GST',
    itemOffered: {
      '@type': 'HotelRoom',
      name: room.name,
      ...(room.description ? { description: room.description } : {}),
      occupancy: { '@type': 'QuantitativeValue', maxValue: room.capacity },
      ...(room.bed_type ? { bed: room.bed_type } : {}),
      ...(room.size_sqft ? { floorSize: { '@type': 'QuantitativeValue', value: room.size_sqft, unitCode: 'FTK' } } : {}),
      ...(room.amenities?.length
        ? { amenityFeature: room.amenities.map((name) => ({ '@type': 'LocationFeatureSpecification', name, value: true })) }
        : {}),
      ...(photos.length ? { image: photos } : {}),
    },
  };
  // Breadcrumb links must be absolute, so they need the public site address.
  const breadcrumb = SITE_URL && {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Rooms & Suites', item: `${SITE_URL}/rooms` },
      { '@type': 'ListItem', position: 2, name: room.name, item: `${SITE_URL}${roomPath(room)}` },
    ],
  };
  return [offer, breadcrumb].filter(Boolean);
}

export default async function RoomPage({ params }) {
  const room = await getRoomBySlug(params.slug);
  if (!room) notFound();
  const [offers, contact, rooms] = await Promise.all([getOffers(), getContact(), getRooms()]);
  const otherRooms = rooms.filter((r) => r.id !== room.id).map((r) => ({ id: r.id, name: r.name, slug: r.slug }));

  const m2 = sqftToM2(room.size_sqft);
  const photos = realPhotos(room);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <TrackRoomView room={room} />
      <nav className="mb-4 text-sm text-navy-400" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/rooms" className="hover:text-ocean-500">Rooms &amp; Suites</Link></li>
          <li aria-hidden="true">/</li>
          <li className="text-navy-200" aria-current="page">{room.name}</li>
        </ol>
      </nav>

      <RoomGallery name={room.name} photos={photos} />

      {/* On a phone: name, then price and dates, then the details. On large
          screens the booking box sits beside both and follows the scroll. */}
      <div className="mt-10 grid gap-x-10 gap-y-8 lg:grid-cols-[1fr_24rem]">
        <Reveal as="div" className="lg:col-start-1">
          <PageHeader eyebrow="Chirala Beach" title={room.name}>
            <p className="mt-6 max-w-2xl leading-relaxed text-navy-300">{room.description}</p>
            <ShareRoom name={room.name} path={roomPath(room)} className="mt-5" />
          </PageHeader>
        </Reveal>

        <aside className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <RoomBookingBox room={room} offers={offersForRoom(offers, room)} otherRooms={otherRooms} />
        </aside>

        <div className="lg:col-start-1">
          <div className="grid gap-3 sm:grid-cols-2">
            {m2 && <Feature icon="size" label="Room size" value={`${room.size_sqft} sq ft (${m2} m²)`} />}
            {room.bed_type && <Feature icon="bed" label="Bed" value={room.bed_type} />}
            {room.views?.length > 0 && <Feature icon="view" label="View" value={room.views.join(' · ')} />}
            <Feature icon="guests" label="Max guests" value={`Up to ${room.capacity}`} />
          </div>

          {/* The question most guests ask first, answered in a sentence of its own. */}
          <p className="mt-8 rounded-xl bg-navy-900 px-4 py-3 text-sm text-navy-100">
            {includesBreakfast(room) ? (
              <><strong className="font-semibold">Breakfast is included</strong> in the room price.</>
            ) : (
              <>
                <strong className="font-semibold">Breakfast is not included</strong> in the room price. Our restaurant serves it —{' '}
                <Link href="/dining#menu" className="font-semibold text-ocean-600 underline">see the menu</Link>.
              </>
            )}
          </p>

          {room.amenities?.length > 0 && (
            <>
              <h2 className="mt-10 font-serif text-2xl font-semibold text-navy-50">What you get</h2>
              <div className="mt-4 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                {groupAmenities(room).map((group) => (
                  <div key={group.title}>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-navy-400">{group.title}</h3>
                    <ul className="mt-2 space-y-1.5 text-sm text-navy-200">
                      {group.items.map((a) => (
                        <li key={a} className="flex items-center gap-2">
                          <span className="text-ocean-500" aria-hidden="true">✓</span>
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}

          <h2 className="mt-10 font-serif text-2xl font-semibold text-navy-50">Good to know</h2>
          <ul className="mt-4 space-y-2 text-sm text-navy-200">
            {(contact.checkInTime || contact.checkOutTime) && (
              <li>
                {[contact.checkInTime && `Check-in from ${contact.checkInTime}`, contact.checkOutTime && `check-out by ${contact.checkOutTime}`].filter(Boolean).join(', ')}.
              </li>
            )}
            <li>
              {room.units_count} room{room.units_count === 1 ? '' : 's'} of this type — you choose the exact room by
              number when you book. Each is listed with its floor and view, so you can take the one you prefer, or
              rooms next to each other when you travel as a group.
            </li>
            <li>Bring a photo ID (Aadhaar, passport or driving licence) for every adult; the front desk checks it at check-in.</li>
            <li>You pay in full online. The resort confirms within 24 hours — if it can&apos;t, you are refunded in full automatically.</li>
            <li>Bookings cancelled before check-in are refunded. If you don&apos;t arrive, the payment is not refunded.</li>
          </ul>
          <p className="mt-3 text-sm">
            <Link href="/faq" className="font-semibold text-ocean-600 underline">All questions and policies</Link>
          </p>

          <RecentlyViewed excludeId={room.id} className="mt-8" />
        </div>
      </div>

      {structuredData(room, photos).map((data) => (
        <script key={data['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
      ))}
    </div>
  );
}
