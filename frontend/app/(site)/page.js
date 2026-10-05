import Link from 'next/link';
import Hero from '@/components/Hero';
import Reveal from '@/components/motion/Reveal';
import RoomSlider from '@/components/site/RoomSlider';
import RecentlyViewed from '@/components/site/RecentlyViewed';
import SectionHead from '@/components/home/SectionHead';
import OffersSection from '@/components/home/OffersSection';
import Experiences from '@/components/home/Experiences';
import ReviewsSection from '@/components/home/ReviewsSection';
import GettingHere from '@/components/home/GettingHere';
import PackagesSection from '@/components/home/PackagesSection';
import { getContact, getOffers, getRooms } from '@/lib/server-api';
import { hotelJsonLd, jsonLd } from '@/lib/jsonLd';

export default async function HomePage() {
  const [rooms, offers, contact] = await Promise.all([getRooms(), getOffers(), getContact()]);
  const fromPrice = rooms.length ? Math.min(...rooms.map((room) => Number(room.price_per_night))) : null;

  return (
    <div>
      <Hero fromPrice={fromPrice} />

      {/* About, in one line */}
      <section className="mx-auto max-w-3xl px-4 pb-10 pt-16 text-center sm:px-6">
        <Reveal>
          <p className="font-serif text-2xl font-medium leading-snug text-ink-800 sm:text-3xl">
            A small beachfront resort on the Chirala coast — sea-facing rooms, unhurried days and warm Andhra
            hospitality.
          </p>
        </Reveal>
        <RecentlyViewed className="mt-8 justify-center" />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHead eyebrow="Stay" title="Rooms & Suites" action={<Link href="/rooms" className="btn-outline">All rooms</Link>} />
        {rooms.length > 0 ? (
          <RoomSlider rooms={rooms} offers={offers} />
        ) : (
          <p className="card p-8 text-center text-ink-500">
            Rooms are not available to view right now. Please try again shortly, or{' '}
            <Link href="/contact" className="font-semibold text-ocean-600 underline">contact us</Link>.
          </p>
        )}
      </section>

      <OffersSection offers={offers} />
      <Experiences />
      <ReviewsSection />
      <GettingHere contact={contact} />
      <PackagesSection />

      {/* The resort in the format search engines read. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(hotelJsonLd(contact)) }} />
    </div>
  );
}
