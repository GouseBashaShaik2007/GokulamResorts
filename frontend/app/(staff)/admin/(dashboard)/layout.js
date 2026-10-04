'use client';

import AdminSidebar from '../../_components/AdminSidebar';
import StaffSkeleton from '../../_components/StaffSkeleton';
import useStaffSession from '../../_lib/useStaffSession';

export default function AdminDashboardLayout({ children }) {
  const { ready, profile, signOut } = useStaffSession('admin');

  if (!ready) return <StaffSkeleton />;

  return (
    <div className="admin-shell min-h-screen bg-navy-950 lg:flex">
      {/* Admin-only overrides: real white inputs on the sand card background
          (the shared .input-field is tuned for the guest site's cards), and a
          stable scrollbar gutter so switching sections doesn't shift the page
          sideways when a section's content does/doesn't need a scrollbar. */}
      <style jsx global>{`
        html {
          scrollbar-gutter: stable;
        }
        .admin-shell .input-field {
          background: #ffffff;
          border-color: #e4d6bf;
        }
        .admin-shell .input-field:focus {
          border-color: #0e4f5c;
          box-shadow: 0 0 0 1px #0e4f5c;
        }
      `}</style>

      <AdminSidebar email={profile?.email || ''} onSignOut={signOut} />

      <div className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">{children}</div>
    </div>
  );
}
