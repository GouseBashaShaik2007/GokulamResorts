import { notFound } from 'next/navigation';
import BookingForm from '../../../components/BookingForm';

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

export default async function BookingPage({ params }) {
  const room = await getRoom(params.roomId);

  if (!room) {
    notFound();
  }

  const image = room.images?.[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <p className="eyebrow">Book Your Stay</p>
          <h1 className="section-heading mt-2">{room.name}</h1>
          {image && (
            <img
              src={image}
              alt={room.name}
              className="mt-6 h-72 w-full rounded-2xl object-cover"
            />
          )}
          <p className="mt-6 text-navy-300">{room.description}</p>

          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-navy-400">Price per night</dt>
              <dd className="font-serif text-lg font-bold text-gold-400">
                ₹{Number(room.price_per_night).toLocaleString('en-IN')}
              </dd>
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
            <div className="mt-6 flex flex-wrap gap-2">
              {room.amenities.map((a) => (
                <span key={a} className="rounded-full border border-navy-700 bg-navy-800 px-3 py-1 text-xs text-navy-200">
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <BookingForm room={room} />
        </div>
      </div>
    </div>
  );
}
