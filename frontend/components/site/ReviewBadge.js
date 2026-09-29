import { REVIEWS } from '@/lib/site';

/** "4.7 ★ on Google (312 reviews)". Renders nothing until real ratings are set in lib/site.js. */
export default function ReviewBadge({ className = '', tone = 'light' }) {
  const g = REVIEWS?.google;
  if (!g?.rating) return null;
  const color = tone === 'dark' ? 'bg-black/45 text-white' : 'bg-navy-900 text-navy-100 border border-navy-700';
  return (
    <a
      href={g.url || '#reviews'}
      target={g.url ? '_blank' : undefined}
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm backdrop-blur-sm ${color} ${className}`}
    >
      <span className="font-semibold">{g.rating.toFixed(1)}</span>
      <span className="text-amber-400" aria-hidden="true">★</span>
      <span>on Google{g.count ? ` · ${g.count.toLocaleString('en-IN')} reviews` : ''}</span>
    </a>
  );
}
