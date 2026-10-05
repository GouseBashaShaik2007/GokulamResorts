import { notFound } from 'next/navigation';
import OrderingPage from '@/components/ordering/OrderingPage';
import { tableNumber } from '@/lib/foodOrders';

export function generateMetadata({ params }) {
  const table = tableNumber(params.tableId);
  return { title: table ? `Table ${table} — Order` : 'Order' };
}

// Opened by the QR code on a table. /order/hello is not a table at all.
export default function TableOrderPage({ params, searchParams }) {
  const table = tableNumber(params.tableId);
  if (!table) notFound();
  return <OrderingPage table={table} searchParams={searchParams} />;
}
