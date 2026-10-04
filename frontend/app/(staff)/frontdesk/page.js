'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api, { TOKEN_KEYS } from '@/lib/api';
import DeskBoard from '@/components/bookings/DeskBoard';
import StaffSkeleton from '../_components/StaffSkeleton';
import { clearSignedIn } from '../_lib/session';

const TOKEN_KEY = TOKEN_KEYS.staff;
const STAFF_KEY = 'gokulam_staff_profile';

export default function FrontDeskPage() {
  const router = useRouter();
  const [staff, setStaff] = useState(null);

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(STAFF_KEY);
    clearSignedIn('staff');
    router.replace('/staff/login');
  }, [router]);

  useEffect(() => {
    // middleware.js already redirected here if the shared staff session
    // cookie was missing. This covers an expired token, or a non-FrontDesk
    // staff member landing here directly (they sign in at /staff instead).
    try {
      const profile = JSON.parse(window.localStorage.getItem(STAFF_KEY) || 'null');
      if (!window.localStorage.getItem(TOKEN_KEY)) {
        logout();
        return;
      }
      if (profile?.role !== 'FrontDesk') {
        router.replace('/staff');
        return;
      }
      setStaff(profile);
    } catch {
      logout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A deactivated account or expired token bounces back to the login.
  useEffect(() => {
    if (!staff) return;
    const id = api.interceptors.response.use(undefined, (err) => {
      if (err?.response?.status === 401) logout();
      return Promise.reject(err);
    });
    return () => api.interceptors.response.eject(id);
  }, [staff, logout]);

  if (!staff) return <StaffSkeleton />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Front Desk</p>
          <h1 className="section-heading mt-1">Hi, {staff.name.split(' ')[0]}</h1>
        </div>
        <button onClick={logout} className="btn-outline px-4 py-2 text-sm">Log Out</button>
      </div>
      <DeskBoard mode="desk" />
    </div>
  );
}
