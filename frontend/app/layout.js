import './globals.css';
import { serif, sans } from './fonts';
import { SITE_NAME, SITE_URL } from '@/lib/site';

const TITLE = 'Gokulam Resorts — Luxury Beachfront Stays at Chirala Beach';
const DESCRIPTION =
  'Book a luxury beachfront room or suite at Gokulam Resorts, Chirala Beach, Andhra Pradesh. Secure booking with instant Razorpay payments.';

// Root shell only. Guest pages get the site chrome from app/(site)/layout.js;
// staff tools (admin, front desk, kitchen, housekeeping) use app/(staff)/layout.js.
// Pages set a short `title` ("Rooms & Suites"); the template adds the brand.
export const metadata = {
  // Absolute URLs for social cards and the sitemap need the public address.
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  title: { default: TITLE, template: `%s — ${SITE_NAME}` },
  description: DESCRIPTION,
  // No title/description here: social cards then fall back to each page's own.
  openGraph: { type: 'website', siteName: SITE_NAME, locale: 'en_IN' },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-IN" className={`${serif.variable} ${sans.variable}`}>
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
