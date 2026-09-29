import Reveal from '@/components/motion/Reveal';
import RoomsExplorer from '@/components/site/RoomsExplorer';
import RecentlyViewed from '@/components/site/RecentlyViewed';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

async function getRooms() {
  try {
    const res = await fetch(`${API_URL}/rooms`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.rooms || [];
  } catch (err) {
    return [];
  }
}

export const metadata = { title: 'Rooms & Suites — Gokulum Resorts' };

export default async function RoomsPage() {
  const rooms = await getRooms();

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <Reveal className="mb-10 max-w-2xl">
        <p className="eyebrow">Chirala Beach</p>
        <h1 className="display-heading mt-2 text-4xl md:text-5xl">Rooms &amp; Suites</h1>
        <p className="mt-4 text-navy-300">
          Every room at Gokulum Resorts is designed to bring the ocean closer. Choose a room type, then pick
          your exact room by number when you book.
        </p>
      </Reveal>
      <RecentlyViewed className="-mt-4 mb-8" />

      {rooms.length > 0 ? (
        <RoomsExplorer rooms={rooms} />
      ) : (
        <div className="card p-8 text-center text-navy-300">
          Rooms are not available to view right now. Please try again shortly.
        </div>
      )}
    </div>
  );
}
