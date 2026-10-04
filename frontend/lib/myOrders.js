// The food orders placed from this phone, so a guest can find them again and
// see what they have ordered so far. Only the orders' private tokens are kept,
// on the device, for a few hours — nothing here is shared with other phones.

const KEEP_MS = 8 * 60 * 60 * 1000; // a long meal, or lunch and then dinner
const MAX = 10;
const storageKey = (cartKey) => `gokulam_orders_${cartKey}`;

function read(cartKey) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey(cartKey)) || '[]');
    return saved.filter((o) => o?.token && Date.now() - o.at < KEEP_MS);
  } catch {
    return [];
  }
}

/** Tokens of this device's recent orders for one ordering context, newest first. */
export const recentOrderTokens = (cartKey) => read(cartKey).map((o) => o.token);

/** Call after an order is placed. */
export function rememberOrder(cartKey, token) {
  try {
    const next = [{ token, at: Date.now() }, ...read(cartKey).filter((o) => o.token !== token)].slice(0, MAX);
    window.localStorage.setItem(storageKey(cartKey), JSON.stringify(next));
  } catch {
    // storage blocked — the confirmation page still shows this order
  }
}
