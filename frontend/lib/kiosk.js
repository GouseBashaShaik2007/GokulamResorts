// The restaurant's self-ordering kiosk: a tablet on a stand, turned sideways,
// where a customer picks dishes and pays on the same screen. It is not behind
// a QR code: the tablet is set up once with a key from Admin → QR Codes, kept
// on the device, and sent with every order it takes.

/** Where the kiosk screen lives. */
export const KIOSK_PATH = '/dine-in';

/** The set-up link for a tablet: `siteUrl` + this. */
export const kioskSetupPath = (key) => `${KIOSK_PATH}?k=${encodeURIComponent(key)}`;

// How long the screen waits before it clears itself for the next customer.
export const IDLE_SECONDS = 75; // no touch for this long while ordering…
export const IDLE_WARNING_SECONDS = 20; // …then "Still there?" counts down this long
export const DONE_SECONDS = 25; // the order number stays up this long
// On the start screen the menu is re-read this often (prices, sold-out dishes).
export const MENU_REFRESH_MS = 60 * 1000;
// A tablet left running for days picks up a new version of the site by itself.
export const RELOAD_AFTER_MS = 12 * 60 * 60 * 1000;

const KEY_NAME = 'gokulam_kiosk_key';

export function readKioskKey() {
  try {
    return window.localStorage.getItem(KEY_NAME) || '';
  } catch {
    return ''; // storage blocked: the tablet will need its set-up link again after a reload
  }
}

export function saveKioskKey(key) {
  try {
    window.localStorage.setItem(KEY_NAME, key);
  } catch {
    // storage blocked — the key still works until the page is reloaded
  }
}

export function forgetKioskKey() {
  try {
    window.localStorage.removeItem(KEY_NAME);
  } catch {
    // nothing to forget
  }
}

/** The dishes of one category that pass the filters, in menu order. */
export function dishesFor(items, categoryId, { vegOnly = false, jainOnly = false } = {}) {
  return items.filter(
    (i) => String(i.category_id) === String(categoryId) && (!vegOnly || i.is_veg) && (!jainOnly || i.is_jain)
  );
}

/**
 * Brings an order in line with a freshly loaded menu. A dish that has sold out
 * or left the menu is dropped; a changed price is taken over.
 * Returns { lines, removed: [names], repriced: boolean }.
 */
export function reconcileOrder(lines, menuItems) {
  const menu = new Map(menuItems.map((i) => [i.id, i]));
  const removed = [];
  let repriced = false;
  const next = [];
  for (const line of lines) {
    const dish = menu.get(line.id);
    if (!dish || dish.is_available === false) {
      if (!removed.includes(line.name)) removed.push(line.name);
    } else if (Number(dish.price) !== line.price) {
      repriced = true;
      next.push({ ...line, price: Number(dish.price) });
    } else {
      next.push(line);
    }
  }
  return { lines: next, removed, repriced };
}

/** What to tell the customer after reconcileOrder changed their order; '' if nothing did. */
export function menuChangeNotice({ removed, repriced }) {
  const parts = [];
  if (removed.length === 1) parts.push(`${removed[0]} has just sold out and was taken off your order.`);
  if (removed.length > 1) parts.push(`${removed.join(', ')} have just sold out and were taken off your order.`);
  if (repriced) parts.push('A price has changed; your total is up to date.');
  return parts.length ? `${parts.join(' ')} Please check your order.` : '';
}
