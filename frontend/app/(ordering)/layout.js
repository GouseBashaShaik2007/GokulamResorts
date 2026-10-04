import Providers from '@/components/motion/Providers';
import OrderingHeader from '@/components/ordering/OrderingHeader';
import { ToastProvider } from '@/components/ui/Toast';

// The screens behind the restaurant's QR codes. Someone at a table wants the
// menu, not the resort's website: no site navigation, booking bar, currency
// switcher or footer — just the name, where the order is for, and the menu.
export const metadata = { robots: { index: false, follow: false } };

export default function OrderingLayout({ children }) {
  return (
    <Providers>
      <ToastProvider>
        {/* --nav-h: the menu's category bar sticks just under this shorter header. */}
        <div className="flex flex-1 flex-col [--nav-h:3.5rem]">
          <a
            href="#content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ocean-500 focus:px-5 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
          >
            Skip to the menu
          </a>
          <OrderingHeader />
          <main id="content" className="flex-1">{children}</main>
          <footer className="border-t border-navy-700 px-4 py-5 text-center text-xs text-navy-400">
            Gokulam Resorts, Chirala Beach · Need a hand? Any member of our staff can take your order.
          </footer>
        </div>
      </ToastProvider>
    </Providers>
  );
}
