'use client';

import { useEffect, useMemo, useState } from 'react';
import Lightbox from './Lightbox';
import { GALLERY, GALLERY_CATEGORIES, thumb } from '@/lib/gallery';

/** Filterable photo grid with a full-screen viewer. `roomPhotos`: the resort's real room photos. */
export default function GalleryGrid({ roomPhotos = [] }) {
  const [category, setCategory] = useState('all');
  const [open, setOpen] = useState(null);

  // /gallery?c=beach preselects a category.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('c');
    if (GALLERY_CATEGORIES.some((x) => x.key === c)) setCategory(c);
  }, []);

  const all = useMemo(() => [...roomPhotos.map((p) => ({ ...p, category: 'rooms' })), ...GALLERY], [roomPhotos]);
  const shown = category === 'all' ? all : all.filter((p) => p.category === category);

  const pick = (key) => {
    setCategory(key);
    const url = new URL(window.location.href);
    if (key === 'all') url.searchParams.delete('c');
    else url.searchParams.set('c', key);
    window.history.replaceState(null, '', url);
  };

  const chip = (key, label) => (
    <button
      key={key}
      type="button"
      onClick={() => pick(key)}
      aria-pressed={category === key}
      className={`rounded-full px-4 py-2 text-sm font-medium ${category === key ? 'bg-ocean-500 text-white' : 'bg-navy-800 text-navy-200 hover:bg-navy-700'}`}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="mb-8 flex flex-wrap gap-2">
        {chip('all', 'All')}
        {GALLERY_CATEGORIES.filter((c) => c.key !== 'rooms' || roomPhotos.length > 0).map((c) => chip(c.key, c.label))}
      </div>

      {category === 'rooms' && roomPhotos.length === 0 && (
        <div className="photo-coming-soon h-64 rounded-2xl">
          <span className="text-sm font-medium uppercase tracking-[0.2em]">Room photos coming soon</span>
        </div>
      )}

      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {shown.map((p, i) => (
          <button
            key={p.src}
            type="button"
            onClick={() => setOpen(i)}
            className="media-zoom mb-4 block w-full overflow-hidden rounded-2xl"
            aria-label={`Open photo: ${p.alt}`}
          >
            <img src={thumb(p.src)} alt={p.alt} loading="lazy" decoding="async" className="w-full" {...(p.placeholder ? { 'data-placeholder': 'true' } : {})} />
          </button>
        ))}
      </div>

      <Lightbox photos={shown} index={open} onChange={setOpen} onClose={() => setOpen(null)} />
    </>
  );
}
