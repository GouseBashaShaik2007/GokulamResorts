'use client';

import { useEffect } from 'react';

// The kiosk failed to draw. Nobody at the tablet can fix that, so it says who
// can take the order and tries again by itself.
export default function KioskError({ reset }) {
  useEffect(() => {
    const retry = setTimeout(() => reset(), 15000);
    return () => clearTimeout(retry);
  }, [reset]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-night px-10 text-center text-white" role="alert">
      <h1 className="font-serif text-5xl font-semibold">This screen needs a moment</h1>
      <p className="mt-5 max-w-xl text-xl leading-relaxed text-white/80">Please order with our staff. The screen will try again by itself.</p>
      <button type="button" onClick={() => reset()} className="mt-10 rounded-full bg-white px-10 py-4 text-xl font-semibold text-night">Try again now</button>
    </div>
  );
}
