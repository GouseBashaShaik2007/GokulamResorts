'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import useModal from '@/lib/useModal';

const SWIPE_PX = 50;

/**
 * Full-screen photo viewer. photos: [{ src, alt, caption?, link? }] — `link`
 * ({ href, label }) adds "View this room" under a room's photo.
 * Arrow keys, swipe, Esc.
 */
export default function Lightbox({ photos, index, onChange, onClose }) {
  const open = index !== null && index !== undefined;
  const ref = useModal(open, onClose); // focus trap, Escape, scroll lock
  const touchStartX = useRef(null);

  const step = (delta) => onChange((index + delta + photos.length) % photos.length);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowRight') onChange((index + 1) % photos.length);
      if (e.key === 'ArrowLeft') onChange((index - 1 + photos.length) % photos.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, photos.length, onChange]);

  if (!open) return null;
  const photo = photos[index];
  const nav = 'absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20';

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4 focus:outline-none"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onClick={onClose}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null || photos.length < 2) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(dx) > SWIPE_PX) step(dx < 0 ? 1 : -1);
      }}
    >
      <figure className="max-h-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
        <img src={photo.src} alt={photo.alt} className="max-h-[82vh] w-auto rounded-lg object-contain" />
        <figcaption className="mt-3 text-center text-sm text-white/80" aria-live="polite">
          {photo.caption || photo.alt} <span className="text-white/50">· {index + 1} / {photos.length}</span>
          {photo.link && (
            <Link href={photo.link.href} onClick={onClose} className="ml-3 font-semibold text-white underline underline-offset-2">
              {photo.link.label}
            </Link>
          )}
        </figcaption>
      </figure>
      {photos.length > 1 && (
        <>
          <button type="button" aria-label="Previous photo" className={`${nav} left-4`} onClick={(e) => { e.stopPropagation(); step(-1); }}>‹</button>
          <button type="button" aria-label="Next photo" className={`${nav} right-4`} onClick={(e) => { e.stopPropagation(); step(1); }}>›</button>
        </>
      )}
      <button type="button" aria-label="Close" data-autofocus onClick={(e) => { e.stopPropagation(); onClose(); }} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">✕</button>
    </div>
  );
}
