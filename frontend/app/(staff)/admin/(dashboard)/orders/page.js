import FoodOrdersManager from '@/components/admin/FoodOrdersManager';
import PageHeader from '@/components/ui/PageHeader';

export const metadata = { title: 'Food Orders' };

export default function AdminOrdersPage() {
  return (
    <div>
      <PageHeader size="section" eyebrow="Food &amp; Beverage" title="Food Orders" className="mb-8" />
      <FoodOrdersManager />
    </div>
  );
}
