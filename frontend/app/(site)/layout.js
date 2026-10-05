import Providers from '@/components/motion/Providers';
import { BookingProvider } from '@/components/booking/BookingContext';
import { CurrencyProvider } from '@/components/site/Currency';
import { ContactProvider } from '@/components/site/ContactContext';
import FloatingBookingBar from '@/components/booking/FloatingBookingBar';
import BookingSlideOver from '@/components/booking/BookingSlideOver';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/site/WhatsAppButton';
import { ToastProvider } from '@/components/ui/Toast';
import { getContact } from '@/lib/server-api';

// Guest-facing site: navigation, footer, booking panel, WhatsApp button.
export default async function SiteLayout({ children }) {
  // Phone, address, check-in times: read once here, shared with every client component.
  const contact = await getContact();

  return (
    <Providers>
      <ToastProvider>
      <CurrencyProvider>
      <ContactProvider contact={contact}>
        <BookingProvider>
          {/* First thing a keyboard user reaches; invisible until focused. */}
          <a
            href="#content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ocean-500 focus:px-5 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
          >
            Skip to content
          </a>
          <Navbar />
          <main id="content" className="flex-1">{children}</main>
          <Footer contact={contact} />
          <FloatingBookingBar />
          <BookingSlideOver />
          <WhatsAppButton />
        </BookingProvider>
      </ContactProvider>
      </CurrencyProvider>
      </ToastProvider>
    </Providers>
  );
}
