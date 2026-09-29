import SettingsManager from '@/components/admin/SettingsManager';

export default function AdminSettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">Resort Admin</p>
        <h1 className="section-heading mt-1">Settings</h1>
      </div>
      <SettingsManager />
    </div>
  );
}
