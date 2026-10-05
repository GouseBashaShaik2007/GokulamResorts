import StaffProviders from './_components/StaffProviders';
import { screenTitle } from './_lib/titles';

// Staff tools (admin, front desk, kitchen, housekeeping): no guest menu,
// footer, booking bar or WhatsApp button. Each tool renders its own header,
// and each screen names itself in the tab ("Bookings — Gokulam staff").
export const metadata = {
  title: screenTitle('Staff'),
  robots: { index: false, follow: false },
};

export default function StaffLayout({ children }) {
  return (
    <StaffProviders>
      <main className="flex-1">{children}</main>
    </StaffProviders>
  );
}
