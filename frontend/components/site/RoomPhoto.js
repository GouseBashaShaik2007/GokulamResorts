/**
 * A room photo, or the neutral "Photos coming soon" frame when the resort
 * hasn't supplied one. Never falls back to a stock bedroom.
 */
export default function RoomPhoto({ src, alt, className = '', label = 'Photos coming soon' }) {
  if (!src) {
    return (
      <div className={`photo-coming-soon ${className}`} role="img" aria-label={`${alt} — ${label.toLowerCase()}`}>
        <svg viewBox="0 0 24 24" className="h-7 w-7 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="12" cy="12" r="3.5" />
          <path d="M8 5l1.5-2h5L16 5" />
        </svg>
        <span className="text-xs font-medium uppercase tracking-[0.2em]">{label}</span>
      </div>
    );
  }
  return <img src={src} alt={alt} className={`h-full w-full object-cover ${className}`} />;
}
