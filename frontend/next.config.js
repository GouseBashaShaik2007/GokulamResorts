// Sent with every page. None of these change how the site looks.
const SECURITY_HEADERS = [
  // The site — above all the admin screens — may not be shown inside a frame
  // on someone else's page, which is how clickjacking works. (Both headers:
  // older browsers read the first, newer ones the second.)
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  // Browsers must use the file type the server states instead of guessing.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Other sites learn which site a visitor came from, not which page or booking reference.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Once visited over HTTPS, always HTTPS. (Ignored on http://localhost.)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  // Features the site never uses are switched off for it and anything it embeds.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  // Lets two dev servers run side by side without sharing (and corrupting) one build folder.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // The restaurant's kiosk screen lives at /dine-in; its older names lead
  // there. (Not permanent: these two addresses pointed at /order for a while,
  // and a browser that remembers a permanent redirect never asks again.)
  // Their sub-pages were order confirmations, which now live under /order.
  async redirects() {
    return ['/kiosk', '/dine'].flatMap((old) => [
      { source: old, destination: '/dine-in', permanent: false },
      { source: `${old}/:path*`, destination: '/order/:path*', permanent: true },
    ]);
  },
  images: {
    // Only these hosts may be resized by the image optimiser (an open "**"
    // would let anyone use the site as an image proxy). Keep in step with
    // OPTIMISABLE in components/ui/Photo.js.
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' }, // room and dish photos uploaded in admin
      { protocol: 'https', hostname: 'images.unsplash.com' }, // stock stand-ins until the resort's own photos arrive
    ],
  },
};

module.exports = nextConfig;
