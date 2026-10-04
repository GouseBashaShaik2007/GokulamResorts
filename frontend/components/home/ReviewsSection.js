import { REVIEWS } from '@/lib/site';
import SectionHead from './SectionHead';

/** Guest reviews — only once real ratings and quotes are in lib/site.js. */
export default function ReviewsSection() {
  if (!REVIEWS?.quotes?.length) return null;
  return (
    <section id="reviews" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <SectionHead eyebrow="Guest reviews" title="What guests say" />
      <div className="mb-8 flex flex-wrap gap-6 text-navy-100">
        {REVIEWS.google && (
          <p><span className="text-3xl font-semibold">{REVIEWS.google.rating.toFixed(1)}</span> <span className="text-amber-500">★</span> Google{REVIEWS.google.count ? ` · ${REVIEWS.google.count} reviews` : ''}</p>
        )}
        {REVIEWS.tripadvisor && (
          <p><span className="text-3xl font-semibold">{REVIEWS.tripadvisor.rating.toFixed(1)}</span> TripAdvisor</p>
        )}
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {REVIEWS.quotes.slice(0, 3).map((q) => (
          <figure key={q.text} className="card p-6">
            <blockquote className="font-serif text-lg leading-relaxed text-navy-100">“{q.text}”</blockquote>
            <figcaption className="mt-4 text-sm text-navy-400">— {q.author}, {q.source}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
