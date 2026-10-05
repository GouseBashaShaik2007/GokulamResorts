// Placeholder shown while a guest page waits on the API (rooms, menu), so
// navigation answers immediately instead of leaving the previous page frozen.
// Used by the loading.js of the list pages only: a loading file higher up
// starts the response early, which turns real 404s into "200 OK" pages.
export default function PageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-16 sm:px-6 lg:px-8" role="status" aria-label="Loading">
      <div className="h-3 w-24 rounded bg-sand-200" />
      <div className="mt-4 h-10 w-72 max-w-full rounded bg-sand-200" />
      <div className="mt-4 h-4 w-96 max-w-full rounded bg-sand-200" />
      <div className="mt-12 grid gap-8 md:grid-cols-2">
        <div className="h-72 rounded-2xl bg-sand-200" />
        <div className="h-72 rounded-2xl bg-sand-200" />
      </div>
    </div>
  );
}
