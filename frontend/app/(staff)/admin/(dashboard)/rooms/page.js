import RoomsAdmin from '@/components/admin/RoomsAdmin';

export default function AdminRoomsPage() {
  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">Resort Admin</p>
        <h1 className="section-heading mt-1">Rooms</h1>
      </div>
      <RoomsAdmin />
    </div>
  );
}
