'use client';

import AdminSidebar from '../../_components/AdminSidebar';
import StaffSkeleton from '../../_components/StaffSkeleton';
import useStaffSession from '../../_lib/useStaffSession';

export default function AdminDashboardLayout({ children }) {
  const { ready, profile, signOut } = useStaffSession('admin');

  if (!ready) return <StaffSkeleton />;

  return (
    // .admin-shell: white inputs and a steady scrollbar gutter — see globals.css.
    <div className="admin-shell min-h-screen bg-navy-950 lg:flex">
      <AdminSidebar email={profile?.email || ''} onSignOut={signOut} />

      <div className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">{children}</div>
    </div>
  );
}
