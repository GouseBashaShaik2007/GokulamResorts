import RoomCard from '../../components/RoomCard';
import Reveal from '../../components/motion/Reveal';
import { RevealStagger, RevealStaggerItem } from '../../components/motion/RevealStagger';

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

export const metadata = { title: 'Rooms & Suites — Gokulam Resorts' };

export default async function RoomsPage() {
  const rooms = await getRooms();

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <Reveal className="mb-12 max-w-2xl">
        <p className="eyebrow">Chirala Beach</p>
        <h1 className="display-heading mt-2 text-4xl md:text-5xl">Rooms &amp; Suites</h1>
        <p className="mt-4 text-navy-300">
          Every room at Gokulam Resorts is designed to bring the ocean closer — pick your favourite and
          reserve your dates.
        </p>
      </Reveal>

      {rooms.length > 0 ? (
        <RevealStagger className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <RevealStaggerItem key={room.id}>
              <RoomCard room={room} />
            </RevealStaggerItem>
          ))}
        </RevealStagger>
      ) : (
        <div className="card p-8 text-center text-navy-300">
          No rooms available right now. Please check back shortly, or if you are the resort admin, make
          sure the backend API is running and rooms have been added.
        </div>
      )}
    </div>
  );
}
