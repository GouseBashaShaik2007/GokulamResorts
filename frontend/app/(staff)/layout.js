// Staff tools (admin, front desk, kitchen, housekeeping): no guest menu,
// footer, booking bar or WhatsApp button. Each tool renders its own header.
export const metadata = {
  title: 'Gokulam Resorts — Staff',
  robots: { index: false, follow: false },
};

export default function StaffLayout({ children }) {
  return <main className="flex-1">{children}</main>;
}
