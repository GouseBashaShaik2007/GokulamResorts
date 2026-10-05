// Shown briefly while a protected staff page's own data (bookings, orders,
// rooms...) is loading. Auth itself is decided by middleware.js before this
// ever renders, so this is about avoiding a blank screen for data fetches,
// not about hiding a logged-out flash.
export default function StaffSkeleton({ rows = 4 }) {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-sand-200" />
          <div className="h-6 w-48 rounded bg-sand-200" />
        </div>
        <div className="h-9 w-20 rounded-lg bg-sand-200" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-sand-200" />
        ))}
      </div>
    </div>
  );
}
