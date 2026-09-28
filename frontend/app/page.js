import Hero from '../components/Hero';
import RoomCard from '../components/RoomCard';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

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

  return (
    <div>
      <Hero />

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-3">
          {HIGHLIGHTS.map((h) => (
            <div key={h.title} className="card p-6">
              <div className="mb-4 h-1 w-10 rounded-full bg-gold-500" />
              <h3 className="font-serif text-xl font-bold text-navy-50">{h.title}</h3>
              <p className="mt-2 text-sm text-navy-300">{h.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-navy-900 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Featured Stays</p>
              <h2 className="section-heading">Rooms &amp; Suites</h2>
            </div>
            <Link href="/rooms" className="btn-outline">View All Rooms</Link>
          </div>

          {rooms.length > 0 ? (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
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

      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <p className="eyebrow">Chirala Beach, Andhra Pradesh</p>
        <h2 className="section-heading mt-2">Your Escape Awaits</h2>
        <p className="mx-auto mt-4 max-w-2xl text-navy-300">
          From sunrise yoga on the sand to private candlelit dinners by the waves, Gokulam Resorts is
          built for slow mornings and unforgettable evenings.
        </p>
        <Link href="/rooms" className="btn-gold mt-8 inline-flex">Check Availability</Link>
      </section>
    </div>
  );
}
