import HousekeepingManager from '@/components/admin/HousekeepingManager';
import PageHeader from '@/components/ui/PageHeader';

export const metadata = { title: 'Housekeeping' };

export default function AdminHousekeepingPage() {
  return (
    <div>
      <PageHeader size="section" eyebrow="Operations" title="Housekeeping" className="mb-8" />
      <HousekeepingManager />
    </div>
  );
}
