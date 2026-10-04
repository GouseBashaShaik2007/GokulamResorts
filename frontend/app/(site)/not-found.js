import Link from 'next/link';

export const metadata = { title: 'Page not found', robots: { index: false } };

// Shown inside the guest layout (navbar + footer) for a room that no longer
// exists, a bad table link, or any address that doesn't match a page.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <p className="eyebrow">Page not found</p>
      <h1 className="display-heading mt-2 text-4xl md:text-5xl">We couldn&apos;t find that page</h1>
      <p className="mt-4 text-navy-300">
        The link may be old, or the address may have a typo. Here is where most guests are headed.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/rooms" className="btn-gold">Rooms &amp; Suites</Link>
        <Link href="/booking/status" className="btn-outline">My Booking</Link>
        <Link href="/contact" className="btn-outline">Contact us</Link>
      </div>
    </div>
  );
}
