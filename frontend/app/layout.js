import './globals.css';
import { serif, sans } from './fonts';

// Root shell only. Guest pages get the site chrome from app/(site)/layout.js;
// staff tools (admin, front desk, kitchen, housekeeping) use app/(staff)/layout.js.
export const metadata = {
  title: 'Gokulam Resorts — Luxury Beachfront Stays at Chirala Beach',
  description:
    'Book a luxury beachfront room or suite at Gokulam Resorts, Chirala Beach, Andhra Pradesh. Secure booking with instant Razorpay payments.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
