'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api, { TOKEN_KEYS } from '@/lib/api';
import { markSignedIn } from '../../_lib/session';

const TOKEN_KEY = TOKEN_KEYS.kitchen;
const STAFF_KEY = 'gokulam_kitchen_staff';
const MAX_PIN = 6;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function KitchenLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = useCallback(
    async (value) => {
      if (loading || value.length < 4) return;
      setLoading(true);
      setError('');
      try {
        const res = await api.post('/kitchen/login', { pin: value });
        window.localStorage.setItem(TOKEN_KEY, res.data.token);
        window.localStorage.setItem(STAFF_KEY, JSON.stringify(res.data.staff));
        markSignedIn('kitchen');
        router.replace('/kitchen');
      } catch (err) {
        setError(err?.response?.data?.message || 'Login failed');
        setPin('');
      } finally {
        setLoading(false);
      }
    },
    [loading, router]
  );

  const press = (key) => {
    if (loading) return;
    if (key === '⌫') return setPin((p) => p.slice(0, -1));
    if (!key) return;
    setPin((p) => (p.length >= MAX_PIN ? p : p + key));
  };

  // Physical keyboard support (useful when testing on a laptop).
  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('⌫');
      else if (e.key === 'Enter') submit(pin);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, submit]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 py-10 text-white">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Kitchen</p>
      <h1 className="mt-2 text-3xl font-bold">Enter your PIN</h1>

      <div className="mt-8 flex gap-3" aria-live="polite">
        {Array.from({ length: MAX_PIN }).map((_, i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full border-2 ${
              i < pin.length ? 'border-amber-300 bg-amber-300' : 'border-neutral-600'
            }`}
          />
        ))}
        <span className="sr-only">{pin.length} of up to {MAX_PIN} digits entered</span>
      </div>

      {error && <p role="alert" className="mt-4 text-sm font-semibold text-red-400">{error}</p>}

      <div className="mt-8 grid w-full max-w-xs grid-cols-3 gap-3">
        {KEYS.map((key, i) => (
          <button
            key={i}
            type="button"
            disabled={!key || loading}
            onClick={() => press(key)}
            aria-label={key === '⌫' ? 'Delete last digit' : undefined}
            className={`h-16 rounded-2xl text-2xl font-bold transition active:scale-95 ${
              key
                ? key === '⌫'
                  ? 'bg-neutral-700 text-neutral-200'
                  : 'bg-neutral-800 text-white hover:bg-neutral-700'
                : 'invisible'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => submit(pin)}
        disabled={loading || pin.length < 4}
        className="mt-8 w-full max-w-xs rounded-2xl bg-amber-300 py-4 text-xl font-bold text-neutral-950 disabled:opacity-40"
      >
        {loading ? 'Checking…' : 'Sign in'}
      </button>
    </div>
  );
}
