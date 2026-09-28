import RoomCard from '../../components/RoomCard';

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
      <div className="mb-12 text-center">
        <p className="eyebrow">Chirala Beach</p>
        <h1 className="section-heading mt-2">Rooms &amp; Suites</h1>
        <p className="mx-auto mt-4 max-w-2xl text-navy-300">
          Every room at Gokulam Resorts is designed to bring the ocean closer — pick your favourite and
          reserve your dates.
        </p>
      </div>

      {rooms.length > 0 ? (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center text-navy-300">
          No rooms available right now. Please check back shortly, or if you are the resort admin, make
          sure the backend API is running and rooms have been added.
        </div>
      )}
    </div>
  );
}
