import './globals.css';
import { serif, sans } from './fonts';
import Providers from '../components/motion/Providers';
import { BookingProvider } from '../components/booking/BookingContext';
import FloatingBookingBar from '../components/booking/FloatingBookingBar';
import BookingSlideOver from '../components/booking/BookingSlideOver';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export const metadata = {
  title: 'Gokulam Resorts — Luxury Beachfront Stays at Chirala Beach',
  description:
    'Book a luxury beachfront room or suite at Gokulam Resorts, Chirala Beach, Andhra Pradesh. Secure booking with instant Razorpay payments.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body className="flex min-h-screen flex-col">
        <Providers>
          <BookingProvider>
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
            <FloatingBookingBar />
            <BookingSlideOver />
          </BookingProvider>
        </Providers>
      </body>
    </html>
  );
}
