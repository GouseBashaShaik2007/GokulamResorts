import OffersManager from '@/components/admin/OffersManager';
import PageHeader from '@/components/ui/PageHeader';

export const metadata = { title: 'Offers' };

export default function AdminOffersPage() {
  return (
    <div>
      <PageHeader size="section" eyebrow="Pricing" title="Offers" className="mb-8" />
      <OffersManager />
    </div>
  );
}
