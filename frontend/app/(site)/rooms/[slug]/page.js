import { notFound } from 'next/navigation';
import Link from 'next/link';
import Reveal from '@/components/motion/Reveal';
import RoomGallery from '@/components/site/RoomGallery';
import RoomBookingBox from '@/components/site/RoomBookingBox';
import RecentlyViewed, { TrackRoomView } from '@/components/site/RecentlyViewed';
import { jsonLd } from '@/lib/jsonLd';
import { realPhotos, roomPath, sqftToM2 } from '@/lib/rooms';
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

const Icon = {
  size: 'M4 4h6M4 4v6M20 20h-6M20 20v-6M4 4l6 6M20 20l-6-6',
  bed: 'M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 14h18M3 18v2M21 18v2M6 10V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3M13 10V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3',
  view: 'M2 17c2.5 0 2.5-1.5 5-1.5S9.5 17 12 17s2.5-1.5 5-1.5 2.5 1.5 5 1.5M2 21c2.5 0 2.5-1.5 5-1.5S9.5 21 12 21s2.5-1.5 5-1.5 2.5 1.5 5 1.5M12 3v2M5.6 5.6l1.4 1.4M18.4 5.6 17 7M8 12a4 4 0 0 1 8 0',
  guests: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.87M16 4.13a3 3 0 0 1 0 5.74',
};

function Feature({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-navy-700 px-4 py-3">
      <svg viewBox="0 0 24 24" className="h-6 w-6 flex-none text-ocean-500" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={Icon[icon]} />
      </svg>
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
          <p className="eyebrow">Chirala Beach</p>
          <h1 className="display-heading mt-2 text-4xl md:text-5xl">{room.name}</h1>
          <p className="mt-6 max-w-2xl leading-relaxed text-navy-300">{room.description}</p>
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

          {room.amenities?.length > 0 && (
            <>
              <h2 className="mt-10 font-serif text-2xl font-semibold text-navy-50">In the room</h2>
              <ul className="mt-4 grid gap-2 text-sm text-navy-200 sm:grid-cols-2">
                {room.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2">
                    <span className="text-ocean-500" aria-hidden="true">✓</span>
                    {a}
                  </li>
                ))}
              </ul>
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
