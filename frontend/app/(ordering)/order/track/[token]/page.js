import { notFound } from 'next/navigation';
import { OrderTracking } from '@/components/OrderConfirmation';

export const metadata = { title: 'Your order' };

// Opened from the link in an order's SMS ("Follow it here: …/order/track/…").
// `token` is the order's private token, the same one the page after ordering
// uses. Anything that cannot be one is not a page at all.
export default function TrackOrderPage({ params }) {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(params.token)) notFound();
  return <OrderTracking token={params.token} />;
}
