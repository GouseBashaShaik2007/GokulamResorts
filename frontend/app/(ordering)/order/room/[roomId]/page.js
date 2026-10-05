import { notFound } from 'next/navigation';
import OrderingPage from '@/components/ordering/OrderingPage';
import { roomNumber } from '@/lib/foodOrders';

export function generateMetadata({ params }) {
  const room = roomNumber(params.roomId);
  return { title: room ? `Room ${room} — Order` : 'Order' };
}

// Opened by the QR code in a hotel room: the food is brought to that room.
export default function RoomOrderPage({ params, searchParams }) {
  const room = roomNumber(params.roomId);
  if (!room) notFound();
  return <OrderingPage room={room} searchParams={searchParams} />;
}
