'use client';

import TaskBoard from '@/components/housekeeping/TaskBoard';
import StaffSkeleton from '../_components/StaffSkeleton';
import useStaffSession from '../_lib/useStaffSession';

export default function StaffPage() {
  // The front desk has its own screen; everyone else here cleans or inspects.
  const { ready, profile, signOut } = useStaffSession('staff', { redirectFor: (p) => p?.role === 'FrontDesk' && '/frontdesk' });

  if (!ready || !profile) return <StaffSkeleton />;
  return <TaskBoard staff={profile} onLogout={signOut} />;
}
