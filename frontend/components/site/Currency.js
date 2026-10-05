'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';

/**
 * Display-only currency conversion. Prices are always charged in INR; other
 * currencies are shown as "≈ approximate" figures from daily rates (/api/fx).
 * If rates aren't available the switcher hides and everything stays in ₹.
 */
const CurrencyCtx = createContext({ currency: 'INR', rates: null, setCurrency: () => {} });
const STORAGE_KEY = 'gokulam_currency';

export const CURRENCIES = [
  { code: 'INR', label: '₹ INR', symbol: '₹' },
  { code: 'USD', label: '$ USD', symbol: 'US$' },
  { code: 'AED', label: 'AED', symbol: 'AED ' },
  { code: 'GBP', label: '£ GBP', symbol: '£' },
];

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState('INR');
  const [fx, setFx] = useState(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (CURRENCIES.some((c) => c.code === saved)) setCurrencyState(saved);
    } catch {
      // storage unavailable — stay on INR
    }
    api.get('/fx').then((r) => setFx(r.data.fx)).catch(() => setFx(null));
  }, []);

  const value = useMemo(
    () => ({
      currency: fx ? currency : 'INR',
      rates: fx,
      setCurrency: (code) => {
        setCurrencyState(code);
        try {
          window.localStorage.setItem(STORAGE_KEY, code);
        } catch {
          // ignore
        }
      },
    }),
    [currency, fx]
  );

  return <CurrencyCtx.Provider value={value}>{children}</CurrencyCtx.Provider>;
}

export const useCurrency = () => useContext(CurrencyCtx);

const inrText = (n) => `₹${Math.round(Number(n)).toLocaleString('en-IN')}`;

/**
 * A rupee amount, plus an approximate conversion when the guest picked
 * another currency. `suffix` e.g. "+ GST" or "/ night".
 */
export function Price({ inr, suffix, className = '', approxClassName = '' }) {
  const { currency, rates } = useCurrency();
  const meta = CURRENCIES.find((c) => c.code === currency);
  const converted =
    currency !== 'INR' && rates?.rates?.[currency]
      ? `≈ ${meta.symbol}${Math.round(Number(inr) * rates.rates[currency]).toLocaleString('en-US')}`
      : null;
  return (
    <span className={className}>
      <span className="price">{inrText(inr)}</span>
      {suffix && <span className="ml-1 text-[0.8em] font-normal text-ink-400">{suffix}</span>}
      {converted && (
        <span className={`ml-2 whitespace-nowrap text-[0.75em] font-normal text-ink-400 ${approxClassName}`} title="Approximate — you are charged in Indian rupees">
          {converted}
        </span>
      )}
    </span>
  );
}

/**
 * "≈ US$78" for a rupee amount when the guest picked another currency; nothing
 * otherwise. For rows of a price breakdown, so every line converts — not just
 * the total.
 */
export function Approx({ inr, className = '' }) {
  const { currency, rates } = useCurrency();
  const meta = CURRENCIES.find((c) => c.code === currency);
  if (currency === 'INR' || !rates?.rates?.[currency]) return null;
  return (
    <span className={`ml-1.5 whitespace-nowrap text-[0.85em] text-ink-400 ${className}`} title="Approximate — you are charged in Indian rupees">
      ≈ {meta.symbol}{Math.round(Number(inr) * rates.rates[currency]).toLocaleString('en-US')}
    </span>
  );
}

export function CurrencySwitcher({ className = '' }) {
  const { currency, rates, setCurrency } = useCurrency();
  if (!rates) return null;
  return (
    <label className={`flex items-center gap-1 text-xs text-ink-500 ${className}`}>
      <span className="sr-only">Currency</span>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        className="rounded-full border border-sand-300 bg-transparent px-2 py-1 text-xs text-ink-800 focus:border-ocean-400 focus:outline-none"
        title="Approximate prices — bookings are charged in Indian rupees"
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>{c.label}</option>
        ))}
      </select>
      {currency !== 'INR' && <span className="hidden text-[0.65rem] text-ink-400 xl:inline">Approximate</span>}
    </label>
  );
}
