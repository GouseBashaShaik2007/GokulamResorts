// Server-side reads for the guest pages (rooms and menu). Import from Server
// Components only; client components use lib/api.js.

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
