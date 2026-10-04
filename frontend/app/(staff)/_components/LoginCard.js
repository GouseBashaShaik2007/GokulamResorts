'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { errMsg } from '@/lib/bookingUi';

/**
 * The sign-in card shared by the manager and staff logins: one identifier
 * field (email or phone), a password with a show/hide switch, and the error.
 *
 * `idField`: { name, label, type, inputMode?, autoComplete?, hint? }.
 * `endpoint`: where to post { [idField.name], password }.
 * `onSignedIn(data)`: store the token and move on. `help`: what to do about a
 * forgotten password, shown under the form.
 */
export default function LoginCard({ eyebrow, idField, endpoint, onSignedIn, help, children }) {
  const [form, setForm] = useState({ [idField.name]: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post(endpoint, form);
      onSignedIn(res.data);
    } catch (err) {
      // The API's own message covers wrong details and "too many attempts, wait 15 minutes".
      setError(errMsg(err, 'Could not sign in. Check your connection and try again.'));
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <p className="mb-6 text-center font-serif text-2xl font-semibold tracking-wide text-gold-600">Gokulam Resorts</p>
      <div className="card p-8">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 font-serif text-2xl font-bold text-navy-50">Sign in</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor={idField.name}>{idField.label}</label>
            <input
              id={idField.name} type={idField.type} inputMode={idField.inputMode} required
              autoComplete={idField.autoComplete || 'username'} className="input-field"
              aria-describedby={idField.hint ? `${idField.name}-hint` : undefined}
              value={form[idField.name]} onChange={(e) => setForm((p) => ({ ...p, [idField.name]: e.target.value }))}
            />
            {idField.hint && <p id={`${idField.name}-hint`} className="mt-1 text-xs text-navy-400">{idField.hint}</p>}
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="flex overflow-hidden rounded-lg border border-navy-600 bg-navy-800 focus-within:border-ocean-400 focus-within:ring-1 focus-within:ring-ocean-400">
              <input
                id="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password"
                className="w-full bg-transparent px-4 py-3 text-navy-50 focus:outline-none"
                value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              />
              <button
                type="button"
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
                className="flex-none px-4 text-sm font-medium text-ocean-600 hover:bg-navy-700"
              >
                {showPassword ? 'Hide' : 'Show'}<span className="sr-only"> password</span>
              </button>
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={loading} className="btn-gold w-full disabled:opacity-60">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        {help && <p className="mt-4 text-center text-xs text-navy-400">{help}</p>}
        {children}
      </div>
    </div>
  );
}
