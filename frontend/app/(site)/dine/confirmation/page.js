import OrderConfirmation from '@/components/OrderConfirmation';

export const metadata = { title: 'Your order', robots: { index: false, follow: false } };

export default function DineConfirmationPage({ searchParams }) {
  // The key from the counter's QR code travels along, so "Order more" still works.
  const accessKey = typeof searchParams.k === 'string' ? searchParams.k : '';
  return <OrderConfirmation browseHref={`/dine${accessKey ? `?k=${encodeURIComponent(accessKey)}` : ''}`} />;
}
