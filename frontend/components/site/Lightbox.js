'use client';

import { useEffect } from 'react';

/** Full-screen photo viewer. photos: [{ src, alt, caption? }]. Arrow keys / Esc. */
export default function Lightbox({ photos, index, onChange, onClose }) {
  const open = index !== null && index !== undefined;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onChange((index + 1) % photos.length);
      if (e.key === 'ArrowLeft') onChange((index - 1 + photos.length) % photos.length);
    };
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = prev;
    };
  }, [open, index, photos.length, onChange, onClose]);

  if (!open) return null;
  const photo = photos[index];
  const nav = 'absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={onClose}>
      <figure className="max-h-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
        <img src={photo.src} alt={photo.alt} className="max-h-[82vh] w-auto rounded-lg object-contain" />
        <figcaption className="mt-3 text-center text-sm text-white/80">
          {photo.caption || photo.alt} <span className="text-white/50">· {index + 1} / {photos.length}</span>
        </figcaption>
      </figure>
      {photos.length > 1 && (
        <>
          <button type="button" aria-label="Previous photo" className={`${nav} left-4`} onClick={(e) => { e.stopPropagation(); onChange((index - 1 + photos.length) % photos.length); }}>‹</button>
          <button type="button" aria-label="Next photo" className={`${nav} right-4`} onClick={(e) => { e.stopPropagation(); onChange((index + 1) % photos.length); }}>›</button>
        </>
      )}
      <button type="button" aria-label="Close" onClick={onClose} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">✕</button>
    </div>
  );
}
