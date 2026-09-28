'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '../../lib/api';
import DeskBoard from '../../components/bookings/DeskBoard';

const TOKEN_KEY = 'gokulam_staff_token';
const STAFF_KEY = 'gokulam_staff_profile';

function LoginForm({ onLoggedIn }) {
  const [form, setForm] = useState({ phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/staff/login', form);
      if (res.data.staff.role !== 'FrontDesk') {
        setError('This login is for front desk staff. Housekeeping staff sign in at /staff.');
        return;
      }
      window.localStorage.setItem(TOKEN_KEY, res.data.token);
      window.localStorage.setItem(STAFF_KEY, JSON.stringify(res.data.staff));
      onLoggedIn(res.data.staff);
    } catch (err) {
      setError(err?.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="card p-8">
        <p className="eyebrow">Front Desk</p>
        <h1 className="mt-2 font-serif text-2xl font-bold text-navy-50">Sign in</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="phone">Phone number</label>
            <input id="phone" type="tel" autoComplete="username" required className="input-field" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" required className="input-field" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={loading} className="btn-gold w-full disabled:opacity-60">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function FrontDeskPage() {
  const [checked, setChecked] = useState(false);
  const [staff, setStaff] = useState(null);

  useEffect(() => {
    try {
      const profile = JSON.parse(window.localStorage.getItem(STAFF_KEY) || 'null');
      if (window.localStorage.getItem(TOKEN_KEY) && profile?.role === 'FrontDesk') setStaff(profile);
    } catch {
      // corrupt profile — show login
    }
    setChecked(true);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(STAFF_KEY);
    setStaff(null);
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

  if (!checked) return null;
  if (!staff) return <LoginForm onLoggedIn={setStaff} />;

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
