import Providers from '@/components/motion/Providers';

// The restaurant's self-ordering kiosk: one screen that fills a tablet on a
// stand. No site navigation, no footer, nothing to scroll away from.
export const metadata = {
  title: 'Order here',
  robots: { index: false, follow: false },
  // Lets the tablet "Add to Home screen": the kiosk then opens full screen, on its side.
  manifest: '/kiosk.webmanifest',
};

// A public touch screen: the page is not to be pinched or zoomed out of shape.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0B1F26',
};

export default function KioskLayout({ children }) {
  return <Providers>{children}</Providers>;
}
