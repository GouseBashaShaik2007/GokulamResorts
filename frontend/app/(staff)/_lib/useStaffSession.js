'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api, { TOKEN_KEYS } from '@/lib/api';
import { clearSignedIn } from './session';

// Where each staff tool keeps the signed-in person's name and role (the admin
// has none: the manager's email is read from the token itself).
export const PROFILE_KEYS = { kitchen: 'gokulam_kitchen_staff', staff: 'gokulam_staff_profile' };
const LOGIN_PATHS = { admin: '/admin/login', kitchen: '/kitchen/login', staff: '/staff/login' };

function readProfile(section, token) {
  if (section === 'admin') {
    // Cosmetic only — a malformed token still fails on the first API call.
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { email: payload.email || '' };
  }
  return JSON.parse(window.localStorage.getItem(PROFILE_KEYS[section]) || 'null');
}

/**
 * The client-side half of a staff page's sign-in check. middleware.js has
 * already sent anyone without the session cookie to the login page; this
 * covers what it can't see — a token that is missing or has expired, an
 * account switched off mid-shift, or the wrong role for this screen.
 *
 *   const { ready, profile, signOut } = useStaffSession('staff', { redirectFor: (p) => p?.role === 'FrontDesk' && '/frontdesk' });
 *
 * `section`: 'admin' | 'kitchen' | 'staff'. `redirectFor(profile)` may return
 * a path this person should be on instead. `ready` turns true once the page
 * may render; any 401 from the API after that signs the person out.
 */
export default function useStaffSession(section, { redirectFor } = {}) {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);

  const signOut = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEYS[section]);
    if (PROFILE_KEYS[section]) window.localStorage.removeItem(PROFILE_KEYS[section]);
    clearSignedIn(section);
    router.replace(LOGIN_PATHS[section]);
  }, [router, section]);

  useEffect(() => {
    const token = window.localStorage.getItem(TOKEN_KEYS[section]);
    if (!token) {
      signOut();
      return undefined;
    }
    let found = null;
    try {
      found = readProfile(section, token);
    } catch {
      // unreadable profile — cosmetic for admin and kitchen, a sign-out for staff (the role is needed)
      if (section === 'staff') {
        signOut();
        return undefined;
      }
    }
    const elsewhere = redirectFor?.(found);
    if (elsewhere) {
      router.replace(elsewhere);
      return undefined;
    }
    setProfile(found);
    setReady(true);

    const id = api.interceptors.response.use(undefined, (err) => {
      if (err?.response?.status === 401) signOut();
      return Promise.reject(err);
    });
    return () => api.interceptors.response.eject(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ready, profile, signOut };
}
