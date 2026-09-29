import Providers from '@/components/motion/Providers';
import { BookingProvider } from '@/components/booking/BookingContext';
import { CurrencyProvider } from '@/components/site/Currency';
import FloatingBookingBar from '@/components/booking/FloatingBookingBar';
import BookingSlideOver from '@/components/booking/BookingSlideOver';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/site/WhatsAppButton';

// Guest-facing site: navigation, footer, booking panel, WhatsApp button.
export default function SiteLayout({ children }) {
  return (
    <Providers>
      <CurrencyProvider>
        <BookingProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <FloatingBookingBar />
          <BookingSlideOver />
          <WhatsAppButton />
        </BookingProvider>
      </CurrencyProvider>
    </Providers>
  );
}
