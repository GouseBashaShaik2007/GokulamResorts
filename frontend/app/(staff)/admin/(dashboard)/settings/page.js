import SettingsManager from '@/components/admin/SettingsManager';
import PageHeader from '@/components/ui/PageHeader';

export const metadata = { title: 'Settings' };

export default function AdminSettingsPage() {
  return (
    <div>
      <PageHeader size="section" eyebrow="Resort Admin" title="Settings" className="mb-8" />
      <SettingsManager />
    </div>
  );
}
