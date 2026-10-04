import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';

// Shown instead of the ordering screen to anyone who didn't arrive by scanning
// a QR code at the resort (no key in the address, or one that doesn't match).
export default function ScanToOrder() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
      <svg viewBox="0 0 24 24" className="mx-auto h-14 w-14 text-ocean-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
        <path d="M7 7h4v4H7zM13 7h4v4h-4zM7 13h4v4H7zM13 13h1.5M17 13v1.5M13 17h1.5M17 17h0" />
      </svg>
      <PageHeader size="compact" title="Scan the QR code to order" className="mt-6">
        <p className="mt-4 text-navy-300">
          Ordering is for guests at our restaurant. Point your phone&apos;s camera at the QR code on your table, or the
          one at the restaurant counter, and the menu opens ready to order.
        </p>
      </PageHeader>
      <p className="mt-2 text-sm text-navy-400">Already scanned one and still seeing this? Please ask our staff — they&apos;ll take your order.</p>
      <Link href="/dining#menu" className="btn-gold mt-8 inline-flex">See the menu</Link>
    </div>
  );
}
