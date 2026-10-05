'use client';

import { useCallback, useEffect, useState } from 'react';

// A PIN is 4 to 6 digits, so there is no "last digit" to sign in on: the
// person taps Sign in (or Enter) when theirs is complete.
const MIN_PIN = 4;
const MAX_PIN = 6;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

// 'dark' is the kitchen's wall display; 'light' the site's own look (housekeeping).
const TONE = {
  dark: {
    name: 'text-white',
    back: 'text-neutral-300',
    dotOn: 'border-amber-300 bg-amber-300',
    dotOff: 'border-neutral-600',
    key: 'bg-neutral-800 text-white hover:bg-neutral-700',
    del: 'bg-neutral-700 text-neutral-200',
    submit: 'bg-amber-300 text-neutral-950',
    error: 'text-red-400',
  },
  light: {
    name: 'text-ink-900',
    back: 'text-ocean-600',
    dotOn: 'border-ocean-500 bg-ocean-500',
    dotOff: 'border-sand-400',
    key: 'border border-sand-300 bg-white text-ink-900 hover:bg-sand-200',
    del: 'bg-sand-200 text-ink-700',
    submit: 'bg-ocean-500 text-white',
    error: 'text-red-700',
  },
};

/**
 * A number pad for typing a PIN, for the person whose name tile was tapped.
 *
 * `name`: who is signing in. `onSubmit(pin)` resolves true once signed in; on
 * false the pad is cleared for another try. `onBack` returns to the names.
 * `error` and `loading` come from the sign-in in progress.
 */
export default function PinPad({ name, tone = 'dark', error, loading, onSubmit, onBack }) {
  const [pin, setPin] = useState('');
  const look = TONE[tone];

  const submit = useCallback(
    async (value) => {
      if (loading || value.length < MIN_PIN) return;
      if (!(await onSubmit(value))) setPin('');
    },
    [loading, onSubmit]
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
    <div className="flex flex-col items-center">
      <h2 className={`text-2xl font-bold ${look.name}`}>Hi {name}, enter your PIN</h2>
      {onBack && (
        <button type="button" onClick={onBack} disabled={loading} className={`mt-2 text-sm underline underline-offset-2 ${look.back}`}>
          Not {name}? Choose another name
        </button>
      )}

      <div className="mt-6 flex h-4 gap-3" data-pin-dots>
        {Array.from({ length: dots }).map((_, i) => (
          <span key={i} className={`h-4 w-4 rounded-full border-2 ${i < pin.length ? look.dotOn : look.dotOff}`} />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">{pin.length} digit{pin.length === 1 ? '' : 's'} entered</p>

      {error && <p role="alert" className={`mt-4 max-w-xs text-center text-sm font-semibold ${look.error}`}>{error}</p>}

      <div className="mt-6 grid w-full max-w-xs grid-cols-3 gap-3">
        {KEYS.map((key, i) => (
          <button
            key={i}
            type="button"
            disabled={!key || loading}
            onClick={() => press(key)}
            aria-label={key === '⌫' ? 'Delete last digit' : undefined}
            className={`h-16 rounded-2xl text-2xl font-bold transition active:scale-95 ${key ? (key === '⌫' ? look.del : look.key) : 'invisible'}`}
          >
            {key}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => submit(pin)}
        disabled={loading || pin.length < MIN_PIN}
        className={`mt-6 w-full max-w-xs rounded-2xl py-4 text-xl font-bold disabled:opacity-40 ${look.submit}`}
      >
        {loading ? 'Checking…' : 'Sign in'}
      </button>
    </div>
  );
}
