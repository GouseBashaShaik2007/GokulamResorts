'use client';

import DeskBoard from '@/components/bookings/DeskBoard';
import PageHeader from '@/components/ui/PageHeader';
import StaffSkeleton from '../_components/StaffSkeleton';
import useStaffSession from '../_lib/useStaffSession';

export default function FrontDeskPage() {
  // Housekeeping staff who land here belong on their own task screen.
  const { ready, profile, signOut } = useStaffSession('staff', { redirectFor: (p) => p?.role !== 'FrontDesk' && '/staff' });

  if (!ready) return <StaffSkeleton />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <PageHeader size="section" eyebrow="Gokulam Resorts" title="Front Desk" />
        <div className="flex items-center gap-3">
          {profile?.name && <span className="text-sm text-navy-300">{profile.name}</span>}
          <button onClick={signOut} className="btn-outline px-4 py-2 text-sm">Log Out</button>
        </div>
      </div>
      <DeskBoard mode="desk" />
    </div>
  );
}
