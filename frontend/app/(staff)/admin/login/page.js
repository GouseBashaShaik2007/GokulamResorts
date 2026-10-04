'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api, { TOKEN_KEYS } from '@/lib/api';
import { markSignedIn } from '../../_lib/session';

const TOKEN_KEY = TOKEN_KEYS.admin;

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/admin/login', form);
      window.localStorage.setItem(TOKEN_KEY, res.data.token);
      markSignedIn('admin');
      router.replace('/admin');
    } catch (err) {
      setError(err?.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-24 sm:px-6">
      <div className="card p-8">
        <p className="eyebrow">Resort Admin</p>
        <h1 className="mt-2 font-serif text-2xl font-bold text-navy-50">Sign in</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email" type="email" required autoComplete="username" className="input-field"
              value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password" type="password" required autoComplete="current-password" className="input-field"
              value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            />
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={loading} className="btn-gold w-full disabled:opacity-60">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        {/* Setup hint for developers only — never shown on the deployed site. */}
        {process.env.NODE_ENV === 'development' && (
          <p className="mt-4 text-center text-xs text-navy-400">
            Default credentials come from ADMIN_EMAIL / ADMIN_PASSWORD in the backend .env (set via{' '}
            <code className="text-gold-600">npm run db:seed</code>).
          </p>
        )}
      </div>
    </div>
  );
}
