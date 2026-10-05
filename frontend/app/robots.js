import { SITE_URL } from '@/lib/site';

// Staff tools are private, and so is the restaurant's kiosk screen. Guest
// ordering and confirmation pages are kept out of search with a noindex tag
// on the page instead, so crawlers can see it.
export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/frontdesk', '/staff', '/kitchen', '/dine-in'] }],
    ...(SITE_URL ? { sitemap: `${SITE_URL}/sitemap.xml` } : {}),
  };
}
