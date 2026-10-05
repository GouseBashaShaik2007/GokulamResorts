import RoomsAdmin from '@/components/admin/RoomsAdmin';
import PageHeader from '@/components/ui/PageHeader';

export const metadata = { title: 'Rooms' };

export default function AdminRoomsPage() {
  return (
    <div>
      <PageHeader size="section" eyebrow="Resort Admin" title="Rooms" className="mb-8" />
      <RoomsAdmin />
    </div>
  );
}
