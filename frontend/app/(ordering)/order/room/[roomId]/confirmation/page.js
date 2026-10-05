import { notFound } from 'next/navigation';
import OrderConfirmation from '@/components/OrderConfirmation';
import { roomNumber } from '@/lib/foodOrders';

export const metadata = { title: 'Your order' };

export default function RoomOrderConfirmationPage({ params, searchParams }) {
  const room = roomNumber(params.roomId);
  if (!room) notFound();
  // The key from the room's QR code travels along, so "Order more" still works.
  const accessKey = typeof searchParams.k === 'string' ? searchParams.k : '';
  return <OrderConfirmation orderContext={{ type: 'room', roomId: room, accessKey }} />;
}
