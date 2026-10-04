import StaffManager from '@/components/admin/StaffManager';

export default function AdminStaffPage() {
  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">Operations</p>
        <h1 className="section-heading mt-1">Staff</h1>
        <p className="mt-2 max-w-2xl text-sm text-navy-400">
          Front desk and housekeeping logins. Kitchen staff sign in with a PIN instead — those are in Settings.
        </p>
      </div>
      <StaffManager />
    </div>
  );
}
