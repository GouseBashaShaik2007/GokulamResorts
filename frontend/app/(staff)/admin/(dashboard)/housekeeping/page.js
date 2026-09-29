import HousekeepingManager from '@/components/admin/HousekeepingManager';

export default function AdminHousekeepingPage() {
  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">Operations</p>
        <h1 className="section-heading mt-1">Housekeeping</h1>
      </div>
      <HousekeepingManager />
    </div>
  );
}
