import Hero from '../components/Hero';
import RoomCard from '../components/RoomCard';
import EditorialSplit from '../components/editorial/EditorialSplit';
import Reveal from '../components/motion/Reveal';
import { RevealStagger, RevealStaggerItem } from '../components/motion/RevealStagger';
import OpenBookingButton from '../components/booking/OpenBookingButton';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const AMENITIES_IMAGE =
  'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80';
const CTA_IMAGE =
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80';

async function getFeaturedRooms() {
  try {
    const res = await fetch(`${API_URL}/rooms`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.rooms || []).slice(0, 3);
  } catch (err) {
    // Backend may not be running yet during local development — fail soft.
    return [];
  }
}

const HIGHLIGHTS = [
  { title: 'Private Beach Access', desc: 'Step straight from your room onto the golden sands of Chirala Beach.' },
  { title: 'Candlelit Seafood Dining', desc: 'Fresh Bay of Bengal catch, plated at our open-air oceanfront restaurant.' },
  { title: 'Sunset Ayurvedic Spa', desc: 'Traditional therapies with the sea breeze and the sunset as your backdrop.' },
];

export default async function HomePage() {
  const rooms = await getFeaturedRooms();
  const [feature, ...rest] = rooms;

  return (
    <div>
      <Hero />

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <EditorialSplit image={AMENITIES_IMAGE} imageAlt="Resort amenities at Gokulam Resorts">
          <p className="eyebrow">The Gokulam Experience</p>
          <h2 className="section-heading mt-2">Resort Amenities</h2>
          <ul className="mt-8 space-y-6">
            {HIGHLIGHTS.map((h, i) => (
              <li key={h.title} className="flex gap-4">
                <span className="font-serif text-2xl italic text-gold-400">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="font-serif text-lg font-semibold text-navy-50">{h.title}</h3>
                  <p className="mt-1 text-sm text-navy-300">{h.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </EditorialSplit>
      </section>

      <section className="bg-navy-900 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Featured Stays</p>
              <h2 className="section-heading">Rooms &amp; Suites</h2>
            </div>
            <Link href="/rooms" className="btn-outline">View All Rooms</Link>
          </Reveal>

          {rooms.length >= 3 ? (
            <RevealStagger className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <RevealStaggerItem>
                <RoomCard room={feature} variant="feature" />
              </RevealStaggerItem>
              <div className="grid gap-6">
                {rest.map((room) => (
                  <RevealStaggerItem key={room.id}>
                    <RoomCard room={room} />
                  </RevealStaggerItem>
                ))}
              </div>
            </RevealStagger>
          ) : rooms.length > 0 ? (
            <RevealStagger className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <RevealStaggerItem key={room.id}>
                  <RoomCard room={room} />
                </RevealStaggerItem>
              ))}
            </RevealStagger>
          ) : (
            <div className="card p-8 text-center text-navy-300">
              Rooms will appear here once the API server is running and seeded.
              <br />
              <span className="text-sm text-navy-400">
                (Start the backend and run <code className="text-gold-400">npm run db:seed</code>.)
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <EditorialSplit image={CTA_IMAGE} imageAlt="Sunset dining at Gokulam Resorts" imageSide="right">
          <p className="eyebrow">Chirala Beach, Andhra Pradesh</p>
          <h2 className="section-heading mt-2">Your Escape Awaits</h2>
          <p className="mt-4 text-navy-300">
            From sunrise yoga on the sand to private candlelit dinners by the waves, Gokulam Resorts is
            built for slow mornings and unforgettable evenings.
          </p>
          <OpenBookingButton className="btn-gold mt-8 inline-flex">Check Availability</OpenBookingButton>
        </EditorialSplit>
      </section>
    </div>
  );
}
