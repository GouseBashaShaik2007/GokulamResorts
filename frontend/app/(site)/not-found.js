import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';

export const metadata = { title: 'Page not found', robots: { index: false } };

// Shown inside the guest layout (navbar + footer) for a room that no longer
// exists, a bad table link, or any address that doesn't match a page.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <PageHeader eyebrow="Page not found" title="We couldn’t find that page">
        <p className="mt-4 text-ink-500">
          The link may be old, or the address may have a typo. Here is where most guests are headed.
        </p>
      </PageHeader>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/rooms" className="btn-primary">Rooms &amp; Suites</Link>
        <Link href="/booking/status" className="btn-outline">My Booking</Link>
        <Link href="/contact" className="btn-outline">Contact us</Link>
      </div>
    </div>
  );
}
