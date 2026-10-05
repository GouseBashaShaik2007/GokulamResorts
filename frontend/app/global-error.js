'use client';

// Last resort: shown if the site's own shell (the root layout) fails, in place
// of the browser's bare error screen. It replaces the whole document, so it
// carries its own <html>/<body> and plain inline styles — the site's
// stylesheet may be exactly what failed to load.
export default function GlobalError({ reset }) {
  return (
    <html lang="en-IN">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#FBF8F3', color: '#1C2A33', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, margin: '0 0 12px' }}>Gokulam Resorts</h1>
          <p style={{ margin: '0 0 24px', color: '#5B6B73', lineHeight: 1.6 }}>
            The site is having a problem right now. It&apos;s on our side, not yours. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ border: 0, borderRadius: 999, padding: '12px 28px', background: '#0E4F5C', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
