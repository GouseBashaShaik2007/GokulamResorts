import OrderConfirmation from '@/components/OrderConfirmation';

export const metadata = { title: 'Your order' };

export default function CounterOrderConfirmationPage({ searchParams }) {
  // The key from the counter's QR code travels along, so "Order more" still works.
  const accessKey = typeof searchParams.k === 'string' ? searchParams.k : '';
  return <OrderConfirmation orderContext={{ type: 'counter', accessKey }} />;
}
