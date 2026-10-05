/**
 * Approximate exchange rates for the guest-facing currency switcher.
 * Display only — every charge is in INR. Fetched at boot and once a day from
 * a free, key-less source (open.er-api.com, updated daily). If the fetch
 * fails we keep the last good rates; with none at all the switcher hides.
 */
const SOURCE_URL = 'https://open.er-api.com/v6/latest/INR';
const CURRENCIES = ['USD', 'AED', 'GBP'];

let cache = null; // { base: 'INR', rates: { USD, AED, GBP }, updatedAt, source }

async function refreshRates() {
  try {
    const res = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.result !== 'success') throw new Error(data['error-type'] || 'bad response');
    const rates = Object.fromEntries(CURRENCIES.map((c) => [c, Number(data.rates[c])]));
    if (CURRENCIES.some((c) => !(rates[c] > 0))) throw new Error('missing currency');
    cache = {
      base: 'INR',
      rates,
      updatedAt: new Date((data.time_last_update_unix || Date.now() / 1000) * 1000).toISOString(),
      source: 'open.er-api.com',
    };
    return { updated: true };
  } catch (err) {
    console.error('[fx] rate refresh failed:', err.message);
    return { updated: false };
  }
}

const getRates = () => cache;

module.exports = { refreshRates, getRates, CURRENCIES };
