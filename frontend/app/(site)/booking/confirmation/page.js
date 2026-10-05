import ConfirmationContent from './ConfirmationContent';

// The address carries a booking reference, so it stays out of search.
export const metadata = { title: 'Booking confirmed', robots: { index: false, follow: false } };

export default function ConfirmationPage({ searchParams }) {
  const reference = typeof searchParams.ref === 'string' ? searchParams.ref : '';
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <ConfirmationContent reference={reference} />
    </div>
  );
}
