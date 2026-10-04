import { roomPath } from '@/lib/rooms';
import { getRooms } from '@/lib/server-api';
import { SITE_URL } from '@/lib/site';

// Guest pages worth finding in search. Ordering screens, confirmations and the
// staff tools are left out on purpose (they are noindex).
const PAGES = ['', '/rooms', '/dining', '/gallery', '/chirala-guide', '/faq', '/contact', '/booking/status'];

export default async function sitemap() {
  // Sitemap URLs must be absolute; set NEXT_PUBLIC_SITE_URL in the deployment.
  const base = SITE_URL || 'http://localhost:3000';
  const rooms = await getRooms(); // [] if the API is down — then only the static pages are listed

  return [
    ...PAGES.map((path) => ({ url: `${base}${path}`, changeFrequency: path === '' ? 'weekly' : 'monthly', priority: path === '' ? 1 : 0.7 })),
    ...rooms.map((room) => ({ url: `${base}${roomPath(room)}`, changeFrequency: 'weekly', priority: 0.8 })),
  ];
}
