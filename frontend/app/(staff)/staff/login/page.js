'use client';

import { useRouter } from 'next/navigation';
import { TOKEN_KEYS } from '@/lib/api';
import LoginCard from '../../_components/LoginCard';
import { markSignedIn } from '../../_lib/session';

const STAFF_KEY = 'gokulam_staff_profile';

// Shared sign-in for every staff.controller role (FrontDesk, Bedding,
// Toiletry, Inspector) — one login, one session cookie; where it lands
// after sign-in depends on the role that comes back.
export default function StaffLoginPage() {
  const router = useRouter();

  return (
    <LoginCard
      eyebrow="Staff"
      idField={{
        name: 'phone',
        label: 'Phone number',
        type: 'tel',
        inputMode: 'tel',
        hint: 'The mobile number your manager registered for you. Spaces and +91 don’t matter.',
      }}
      endpoint="/staff/login"
      onSignedIn={(data) => {
        window.localStorage.setItem(TOKEN_KEYS.staff, data.token);
        window.localStorage.setItem(STAFF_KEY, JSON.stringify(data.staff));
        markSignedIn('staff');
        router.replace(data.staff.role === 'FrontDesk' ? '/frontdesk' : '/staff');
      }}
      help="Forgotten your password? Ask your manager — they can set a new one in Admin → Staff."
    />
  );
}
