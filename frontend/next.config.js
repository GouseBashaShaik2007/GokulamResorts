/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets two dev servers run side by side without sharing (and corrupting) one build folder.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // "Order Food" was renamed "Dine With Us" (/kiosk -> /dine); keep old links working.
  async redirects() {
    return [
      { source: '/kiosk', destination: '/dine', permanent: true },
      { source: '/kiosk/:path*', destination: '/dine/:path*', permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

module.exports = nextConfig;
