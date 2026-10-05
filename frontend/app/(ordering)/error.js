'use client';

import PageHeader from '@/components/ui/PageHeader';

// Shown when an ordering screen fails to render. `reset` re-tries the same page.
export default function OrderingError({ reset }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
      <PageHeader size="compact" eyebrow="Something went wrong" title="The menu didn’t load">
        <p className="mt-4 text-ink-500">
          It&apos;s a problem on our side, not yours. Try again, or tell any member of our staff what you would like —
          they&apos;ll take your order.
        </p>
      </PageHeader>
      <button type="button" onClick={() => reset()} className="btn-primary mt-8">Try again</button>
    </div>
  );
}
