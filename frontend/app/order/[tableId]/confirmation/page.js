'use client';

import OrderConfirmation from '../../../../components/OrderConfirmation';
import { useParams } from 'next/navigation';

export default function TableOrderConfirmationPage() {
  const params = useParams();
  return <OrderConfirmation browseHref={`/order/${params.tableId}`} />;
}
