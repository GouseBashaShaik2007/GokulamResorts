'use client';

import { useRouter } from 'next/navigation';
import { TOKEN_KEYS } from '@/lib/api';
import LoginCard from '../../_components/LoginCard';
import { markSignedIn } from '../../_lib/session';

export default function AdminLoginPage() {
  const router = useRouter();

  return (
    <LoginCard
      eyebrow="Resort Admin"
      idField={{ name: 'email', label: 'Email', type: 'email' }}
      endpoint="/admin/login"
      onSignedIn={(data) => {
        window.localStorage.setItem(TOKEN_KEYS.admin, data.token);
        markSignedIn('admin');
        router.replace('/admin');
      }}
      help="Forgotten the password? It can't be recovered from this page — ask whoever set up the site to reset it."
    >
      {/* Setup hint for developers only — never shown on the deployed site. */}
      {process.env.NODE_ENV === 'development' && (
        <p className="mt-4 text-center text-xs text-navy-400">
          Default credentials come from ADMIN_EMAIL / ADMIN_PASSWORD in the backend .env (set via{' '}
          <code className="text-gold-600">npm run db:seed</code>).
        </p>
      )}
    </LoginCard>
  );
}
