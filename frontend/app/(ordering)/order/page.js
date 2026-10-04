import OrderingPage from '@/components/ordering/OrderingPage';

export const metadata = { title: 'Order at the counter' };

// Opened by the QR code at the restaurant counter.
export default function CounterOrderPage({ searchParams }) {
  return <OrderingPage searchParams={searchParams} />;
}
