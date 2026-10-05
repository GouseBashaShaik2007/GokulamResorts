'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { clearSignedIn } from './session';

// Who is signed in to each staff tool, as the page knows it: a name, a role,
// an email — never the sign-in itself, which is a cookie scripts cannot read.
export const PROFILE_KEYS = { admin: 'gokulam_admin_profile', kitchen: 'gokulam_kitchen_staff', staff: 'gokulam_staff_profile' };
const LOGIN_PATHS = { admin: '/admin/login', kitchen: '/kitchen/login', staff: '/staff/login' };
// Where sign-in tokens used to be kept, before they moved into cookies.
const OLD_TOKEN_KEYS = { admin: 'gokulam_admin_token', kitchen: 'gokulam_kitchen_token', staff: 'gokulam_staff_token' };

/**
 * The page's half of a staff screen's sign-in check. middleware.js has already
 * sent anyone without the "signed in" marker to the login page; this covers
 * what it can't see — a sign-in that has expired, an account switched off
 * mid-shift, or the wrong role for this screen.
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
    // Ask the API to drop its cookie; whatever it answers, this browser forgets the person.
    api.post(`/${section}/logout`).catch(() => {});
    window.localStorage.removeItem(PROFILE_KEYS[section]);
    window.localStorage.removeItem(OLD_TOKEN_KEYS[section]);
    clearSignedIn(section);
    router.replace(LOGIN_PATHS[section]);
  }, [router, section]);

  useEffect(() => {
    let found = null;
    try {
      found = JSON.parse(window.localStorage.getItem(PROFILE_KEYS[section]) || 'null');
    } catch {
      // unreadable — treated as not signed in
    }
    if (!found) {
      signOut();
      return undefined;
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
