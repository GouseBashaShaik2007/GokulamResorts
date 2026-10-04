import OrderConfirmation from '@/components/OrderConfirmation';

export const metadata = { title: 'Your order', robots: { index: false, follow: false } };

export default function DineConfirmationPage() {
  return <OrderConfirmation browseHref="/dine" />;
}
