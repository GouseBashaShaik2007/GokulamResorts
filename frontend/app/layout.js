import './globals.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export const metadata = {
  title: 'Gokulam Resorts — Luxury Beachfront Stays at Chirala Beach',
  description:
    'Book a luxury beachfront room or suite at Gokulam Resorts, Chirala Beach, Andhra Pradesh. Secure booking with instant Razorpay payments.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
