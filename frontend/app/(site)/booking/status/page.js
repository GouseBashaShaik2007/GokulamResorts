import GuestBookingStatus from '@/components/GuestBookingStatus';

export const metadata = {
  title: 'My Booking',
  description: 'Look up your Gokulam Resorts booking with your booking reference and mobile number.',
};

// Linked from guest SMS / WhatsApp messages: /booking/status?ref=GKL-7F3K2
export default function BookingStatusPage({ searchParams }) {
  const reference = typeof searchParams.ref === 'string' ? searchParams.ref : '';
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <GuestBookingStatus initialRef={reference} />
    </div>
  );
}
