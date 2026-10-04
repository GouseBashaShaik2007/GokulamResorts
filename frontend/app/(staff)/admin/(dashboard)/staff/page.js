import StaffManager from '@/components/admin/StaffManager';
import PageHeader from '@/components/ui/PageHeader';

export const metadata = { title: 'Staff' };

export default function AdminStaffPage() {
  return (
    <div>
      <PageHeader size="section" eyebrow="Operations" title="Staff" className="mb-8">
        <p className="mt-2 max-w-2xl text-sm text-navy-400">
          Everyone who signs in to a staff screen: the front desk and housekeeping with a phone number and password, the kitchen with a PIN each.
        </p>
      </PageHeader>
      <StaffManager />
    </div>
  );
}
