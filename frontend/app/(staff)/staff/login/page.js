'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api, { TOKEN_KEYS } from '@/lib/api';
import { markSignedIn } from '../../_lib/session';

const TOKEN_KEY = TOKEN_KEYS.staff;
const STAFF_KEY = 'gokulam_staff_profile';

// Shared sign-in for every staff.controller role (FrontDesk, Bedding,
// Toiletry, Inspector) — one login, one session cookie; where it lands
// after sign-in depends on the role that comes back.
export default function StaffLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/staff/login', form);
      window.localStorage.setItem(TOKEN_KEY, res.data.token);
      window.localStorage.setItem(STAFF_KEY, JSON.stringify(res.data.staff));
      markSignedIn('staff');
      router.replace(res.data.staff.role === 'FrontDesk' ? '/frontdesk' : '/staff');
    } catch (err) {
      setError(err?.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="card p-8">
        <p className="eyebrow">Staff</p>
        <h1 className="mt-2 font-serif text-2xl font-bold text-navy-50">Sign in</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="phone">Phone number</label>
            <input
              id="phone" type="tel" inputMode="tel" autoComplete="username" required className="input-field"
              value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password" type="password" autoComplete="current-password" required className="input-field"
              value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            />
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={loading} className="btn-gold w-full disabled:opacity-60">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
