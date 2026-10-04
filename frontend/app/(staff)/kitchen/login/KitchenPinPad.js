'use client';

import { useCallback, useEffect, useState } from 'react';
import useStaffLogin from '../../_lib/useStaffLogin';

// A kitchen PIN is 4 to 6 digits, so there is no "last digit" to sign in on:
// the cook taps Sign in (or Enter) when theirs is complete.
const MIN_PIN = 4;
const MAX_PIN = 6;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

// The API answers 401 for a PIN nobody has; say what to do about it.
const messageFor = (err) =>
  err?.response?.status === 401 ? 'Wrong PIN. Try again, or ask the manager to set a new one in Admin → Staff.' : null;

export default function KitchenPinPad() {
  const [pin, setPin] = useState('');
  const { signIn, error, loading } = useStaffLogin('kitchen', { messageFor });

  const submit = useCallback(
    async (value) => {
      if (loading || value.length < MIN_PIN) return;
      if (!(await signIn({ pin: value }))) setPin('');
    },
    [loading, signIn]
  );

  const press = useCallback(
    (key) => {
      if (loading || !key) return;
      setPin((p) => (key === '⌫' ? p.slice(0, -1) : p.length >= MAX_PIN ? p : p + key));
    },
    [loading]
  );

  // A real keyboard works too (handy on a laptop).
  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('⌫');
      else if (e.key === 'Enter') submit(pin);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pin, press, submit]);

  // Four dots to fill — a 4-digit PIN looks complete at four — and one more
  // appears for each extra digit of a longer PIN.
  const dots = Math.max(MIN_PIN, pin.length);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 py-10 text-white">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Kitchen</p>
      <h1 className="mt-2 text-3xl font-bold">Enter your PIN</h1>

      <div className="mt-8 flex h-4 gap-3">
        {Array.from({ length: dots }).map((_, i) => (
          <span key={i} className={`h-4 w-4 rounded-full border-2 ${i < pin.length ? 'border-amber-300 bg-amber-300' : 'border-neutral-600'}`} />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">{pin.length} digit{pin.length === 1 ? '' : 's'} entered</p>

      {error && <p role="alert" className="mt-4 max-w-xs text-center text-sm font-semibold text-red-400">{error}</p>}

      <div className="mt-8 grid w-full max-w-xs grid-cols-3 gap-3">
        {KEYS.map((key, i) => (
          <button
            key={i}
            type="button"
            disabled={!key || loading}
            onClick={() => press(key)}
            aria-label={key === '⌫' ? 'Delete last digit' : undefined}
            className={`h-16 rounded-2xl text-2xl font-bold transition active:scale-95 ${
              key ? (key === '⌫' ? 'bg-neutral-700 text-neutral-200' : 'bg-neutral-800 text-white hover:bg-neutral-700') : 'invisible'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => submit(pin)}
        disabled={loading || pin.length < MIN_PIN}
        className="mt-8 w-full max-w-xs rounded-2xl bg-amber-300 py-4 text-xl font-bold text-neutral-950 disabled:opacity-40"
      >
        {loading ? 'Checking…' : 'Sign in'}
      </button>
    </div>
  );
}
