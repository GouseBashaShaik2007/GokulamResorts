'use client';

// Shown when a staff screen (admin, front desk, kitchen, housekeeping) fails
// to render, instead of a blank page or a technical error.
export default function StaffError({ reset }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
      <div className="card p-8">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="mt-2 font-serif text-2xl font-bold text-ink-900">This screen didn&apos;t load</h1>
        <p className="mt-3 text-sm text-ink-500">
          Nothing you entered has been lost on the server. Try again; if it keeps happening, reload the page
          or sign in again.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => reset()} className="btn-primary px-5 py-2 text-sm">Try again</button>
          <button type="button" onClick={() => window.location.reload()} className="btn-outline px-5 py-2 text-sm">Reload</button>
        </div>
      </div>
    </div>
  );
}
