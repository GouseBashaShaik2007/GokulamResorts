import RoomsManager from '@/components/admin/RoomsManager';

export default function AdminRoomsPage() {
  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">Resort Admin</p>
        <h1 className="section-heading mt-1">Rooms</h1>
      </div>
      <RoomsManager />
    </div>
  );
}
