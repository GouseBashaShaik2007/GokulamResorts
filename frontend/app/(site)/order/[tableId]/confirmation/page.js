import OrderConfirmation from '@/components/OrderConfirmation';

export const metadata = { title: 'Your order', robots: { index: false, follow: false } };

export default function TableOrderConfirmationPage({ params }) {
  return <OrderConfirmation browseHref={`/order/${params.tableId}`} />;
}
