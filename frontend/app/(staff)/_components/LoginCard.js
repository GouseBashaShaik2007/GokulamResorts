'use client';

import { useState } from 'react';
import useStaffLogin from '../_lib/useStaffLogin';

/**
 * The sign-in form itself: one identifier field (email or phone), a password
 * with a show/hide switch, and the error. A card with no page around it, so
 * it can sit beside another way of signing in.
 *
 * `section`: 'admin' | 'staff' — which sign-in this is (see useStaffLogin).
 * `idField`: { name, label, type, inputMode?, autoComplete?, hint? }.
 * `heading`: the card's title, and the tag it is written in ('h1' on a page
 * where this is the only form). `help`: what to do about a forgotten password.
 */
export function LoginForm({ section, eyebrow, heading = 'Sign in', headingAs: Heading = 'h1', idField, help, children }) {
  const [form, setForm] = useState({ [idField.name]: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, error, loading } = useStaffLogin(section);

  const submit = (e) => {
    e.preventDefault();
    signIn(form);
  };

  return (
    <div className="card p-8">
      <p className="eyebrow">{eyebrow}</p>
      <Heading className="mt-2 font-serif text-2xl font-bold text-ink-900">{heading}</Heading>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor={idField.name}>{idField.label}</label>
          <input
            id={idField.name} type={idField.type} inputMode={idField.inputMode} required
            autoComplete={idField.autoComplete || 'username'} className="input-field"
            aria-describedby={idField.hint ? `${idField.name}-hint` : undefined}
            value={form[idField.name]} onChange={(e) => setForm((p) => ({ ...p, [idField.name]: e.target.value }))}
          />
          {idField.hint && <p id={`${idField.name}-hint`} className="mt-1 text-xs text-ink-400">{idField.hint}</p>}
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <div className="flex overflow-hidden rounded-lg border border-sand-400 bg-sand-200 focus-within:border-ocean-400 focus-within:ring-1 focus-within:ring-ocean-400">
            <input
              id="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password"
              className="w-full bg-transparent px-4 py-3 text-ink-900 focus:outline-none"
              value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            />
            <button
              type="button"
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
              className="flex-none px-4 text-sm font-medium text-ocean-600 hover:bg-sand-300"
            >
              {showPassword ? 'Hide' : 'Show'}<span className="sr-only"> password</span>
            </button>
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
      {help && <p className="mt-4 text-center text-xs text-ink-400">{help}</p>}
      {children}
    </div>
  );
}

/** A whole sign-in page: the resort's name above one LoginForm. */
export default function LoginCard(props) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <p className="mb-6 text-center font-serif text-2xl font-semibold tracking-wide text-gold-600">Gokulam Resorts</p>
      <LoginForm {...props} />
    </div>
  );
}
