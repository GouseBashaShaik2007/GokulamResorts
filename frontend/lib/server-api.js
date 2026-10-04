// Server-side reads for the guest pages (rooms, menu, offers, resort details).
// Import from Server Components only; client components use lib/api.js.
import { resolveContact } from './site';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Browsing pages may show rooms and the menu up to this many seconds old, so
// they don't wait on the API for every visitor. A price or photo changed in
// admin shows up within a minute. Ordering screens pass { fresh: true }: a
// dish marked sold out must disappear at once.
const REVALIDATE_SECONDS = 60;

async function getJson(path, { fresh = false } = {}) {
  try {
    const res = await fetch(`${API_URL}${path}`, fresh ? { cache: 'no-store' } : { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null; // backend down — callers render their "not available right now" state
  }
}

/** All active room types, cheapest first. [] if the API is unreachable. */
export async function getRooms(options) {
  return (await getJson('/rooms', options))?.rooms || [];
}

export async function getRoomBySlug(slug) {
  return (await getRooms()).find((room) => room.slug === slug) || null;
}

export async function getRoomById(id) {
  return (await getRooms()).find((room) => String(room.id) === String(id)) || null;
}

/** { categories, items } exactly as the API returns them. */
export async function getMenu(options) {
  const [c, i] = await Promise.all([getJson('/menu/categories', options), getJson('/menu/items', options)]);
  return { categories: c?.categories || [], items: i?.items || [] };
}

/** Categories that have dishes, each with its `items`. */
export async function getMenuByCategory(options) {
  const { categories, items } = await getMenu(options);
  return categories
    .map((category) => ({ ...category, items: items.filter((item) => item.category_id === category.id) }))
    .filter((category) => category.items.length > 0);
}

/**
 * Whether `key` is the one printed on a QR code: pass { table, key } for a
 * table's code, or just { key } for the restaurant counter's. Ordering is only
 * offered to people who scanned a code, so anything else — no key, a guessed
 * one, or the API being unreachable — is a "no".
 */
export async function hasOrderAccess({ table, key }) {
  if (!key) return false;
  const query = new URLSearchParams(table ? { type: 'table', table: String(table), k: key } : { type: 'counter', k: key });
  return (await getJson(`/order-access?${query}`, { fresh: true }))?.valid === true;
}

/** Phone, address, check-in times… as set in Admin → Settings (see lib/site.js). */
export async function getContact() {
  return resolveContact((await getJson('/site-info'))?.info);
}

/** Offers that are switched on and not yet over — the same rules the price uses. */
export async function getOffers() {
  return (await getJson('/offers'))?.offers || [];
}
