import { notFound } from 'next/navigation';
import OrderConfirmation from '@/components/OrderConfirmation';
import { tableNumber } from '@/lib/foodOrders';

export const metadata = { title: 'Your order' };

export default function TableOrderConfirmationPage({ params, searchParams }) {
  const table = tableNumber(params.tableId);
  if (!table) notFound();
  // The key from the table's QR code travels along, so "Order more" still works.
  const accessKey = typeof searchParams.k === 'string' ? searchParams.k : '';
  return <OrderConfirmation orderContext={{ type: 'table', tableId: table, accessKey }} />;
}
