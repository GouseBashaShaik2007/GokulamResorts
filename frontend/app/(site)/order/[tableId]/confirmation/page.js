import OrderConfirmation from '@/components/OrderConfirmation';

export const metadata = { title: 'Your order', robots: { index: false, follow: false } };

export default function TableOrderConfirmationPage({ params, searchParams }) {
  // The key from the table's QR code travels along, so "Order more" still works.
  const accessKey = typeof searchParams.k === 'string' ? searchParams.k : '';
  const menuHref = `/order/${params.tableId}${accessKey ? `?k=${encodeURIComponent(accessKey)}` : ''}`;
  return <OrderConfirmation browseHref={menuHref} table={params.tableId} accessKey={accessKey} />;
}
