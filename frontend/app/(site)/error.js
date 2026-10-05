'use client';

import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';

// Shown when a guest page fails to render. `reset` re-tries the same page.
export default function SiteError({ reset }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <PageHeader eyebrow="Something went wrong" title="This page didn’t load">
        <p className="mt-4 text-ink-500">
          It&apos;s a problem on our side, not yours. Please try again in a moment.
        </p>
      </PageHeader>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => reset()} className="btn-primary">Try again</button>
        <Link href="/contact" className="btn-outline">Contact us</Link>
      </div>
    </div>
  );
}
