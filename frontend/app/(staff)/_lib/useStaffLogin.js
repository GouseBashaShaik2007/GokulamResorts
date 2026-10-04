'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import api, { TOKEN_KEYS } from '@/lib/api';
import { errMsg } from '@/lib/bookingUi';
import { markSignedIn } from './session';
import { PROFILE_KEYS } from './useStaffSession';

const ENDPOINTS = { admin: '/admin/login', kitchen: '/kitchen/login', staff: '/staff/login' };

// Where each person lands once signed in.
const HOME = {
  admin: () => '/admin',
  kitchen: () => '/kitchen',
  staff: (person) => (person?.role === 'FrontDesk' ? '/frontdesk' : '/staff'),
};

/**
 * Signing in, the same way for every staff tool: post the details, keep the
 * token (and the person's name and role), set the signed-in marker that
 * middleware.js reads, and go to that person's screen.
 *
 *   const { signIn, error, loading } = useStaffLogin('kitchen');
 *   await signIn({ pin });   // true once signed in
 *
 * `section`: 'admin' | 'kitchen' | 'staff'. `messageFor(err)` may return this
 * screen's own wording for a failure; otherwise the API's message is shown
 * (it covers wrong details and "too many attempts").
 */
export default function useStaffLogin(section, { messageFor } = {}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const signIn = useCallback(
    async (credentials) => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.post(ENDPOINTS[section], credentials);
        window.localStorage.setItem(TOKEN_KEYS[section], data.token);
        if (PROFILE_KEYS[section]) window.localStorage.setItem(PROFILE_KEYS[section], JSON.stringify(data.staff));
        markSignedIn(section);
        router.replace(HOME[section](data.staff));
        return true; // `loading` stays on while the next screen opens
      } catch (err) {
        setError(messageFor?.(err) || errMsg(err, 'Could not sign in. Check your connection and try again.'));
        setLoading(false);
        return false;
      }
    },
    // messageFor is a plain function of the error; it need not be stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, section]
  );

  return { signIn, error, loading };
}
