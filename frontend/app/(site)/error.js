'use client';

import Link from 'next/link';

// Shown when a guest page fails to render. `reset` re-tries the same page.
export default function SiteError({ reset }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="display-heading mt-2 text-4xl md:text-5xl">This page didn&apos;t load</h1>
      <p className="mt-4 text-navy-300">
        It&apos;s a problem on our side, not yours. Please try again in a moment.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => reset()} className="btn-gold">Try again</button>
        <Link href="/contact" className="btn-outline">Contact us</Link>
      </div>
    </div>
  );
}
