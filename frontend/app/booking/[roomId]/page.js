import { notFound } from 'next/navigation';
import Link from 'next/link';
import Parallax from '../../../components/motion/Parallax';
import Reveal from '../../../components/motion/Reveal';
import OpenBookingButton from '../../../components/booking/OpenBookingButton';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

async function getRoom(roomId) {
  try {
    const res = await fetch(`${API_URL}/rooms/${roomId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.room;
  } catch (err) {
    return null;
  }
}

export default async function RoomInfoPage({ params }) {
  const room = await getRoom(params.roomId);

  if (!room) {
    notFound();
  }

  const image = room.images?.[0];
  const price = Number(room.price_per_night).toLocaleString('en-IN');

  return (
    <div>
      {image && (
        <Parallax className="h-[45vh] w-full lg:h-[55vh]" range={10}>
          <img src={image} alt={room.name} className="h-full w-full object-cover" />
        </Parallax>
      )}

      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[3fr_2fr]">
          <Reveal as="div">
            <p className="eyebrow">Chirala Beach</p>
            <h1 className="display-heading mt-2 text-4xl md:text-5xl">{room.name}</h1>
            <p className="mt-6 text-navy-300">{room.description}</p>

            <dl className="mt-8 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-navy-400">Price per night</dt>
                <dd className="price text-lg">₹{price}</dd>
              </div>
              <div>
                <dt className="text-navy-400">Capacity</dt>
                <dd className="text-navy-100">{room.capacity} guests</dd>
              </div>
              <div>
                <dt className="text-navy-400">Rooms of this type</dt>
                <dd className="text-navy-100">{room.units_count} — choose yours by number</dd>
              </div>
              {room.size_sqft && (
                <div>
                  <dt className="text-navy-400">Room size</dt>
                  <dd className="text-navy-100">{room.size_sqft} sq.ft.</dd>
                </div>
              )}
              {room.bed_type && (
                <div>
                  <dt className="text-navy-400">Bed type</dt>
                  <dd className="text-navy-100">{room.bed_type}</dd>
                </div>
              )}
            </dl>

            {room.amenities?.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {room.amenities.map((a) => (
                  <span key={a} className="rounded-full border border-navy-700 bg-navy-800 px-3 py-1 text-xs text-navy-200">
                    {a}
                  </span>
                ))}
              </div>
            )}
          </Reveal>

          <div>
            <Reveal as="div" delay={0.1} className="card sticky top-24 space-y-4 p-6 text-center">
              <div>
                <span className="price text-3xl">₹{price}</span>
                <span className="text-sm text-navy-400"> / night</span>
              </div>
              <OpenBookingButton roomTypeId={room.id} className="btn-gold w-full">
                Book This Room
              </OpenBookingButton>
              <Link href="/rooms" className="block text-xs text-navy-400 hover:text-gold-400">
                See all rooms
              </Link>
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  );
}
