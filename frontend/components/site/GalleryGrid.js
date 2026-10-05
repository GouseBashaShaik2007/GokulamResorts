'use client';

import { useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Chip from '../ui/Chip';
import Lightbox from './Lightbox';
import { GALLERY, GALLERY_CATEGORIES, galleryCategory, thumb } from '@/lib/gallery';

/**
 * Filterable photo grid with a full-screen viewer.
 * `roomPhotos`: the resort's real room photos, each { id, src, alt, link }
 * where `link` leads to that room's page.
 *
 * The chosen category is the `c` in the address (/gallery?c=beach), so it is
 * right from the first paint and survives the back button or a shared link.
 */
export default function GalleryGrid({ roomPhotos = [] }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const category = galleryCategory(params.get('c'));
  const [open, setOpen] = useState(null);

  const all = useMemo(() => [...roomPhotos.map((p) => ({ ...p, category: 'rooms' })), ...GALLERY], [roomPhotos]);
  const shown = category === 'all' ? all : all.filter((p) => p.category === category);
  const current = GALLERY_CATEGORIES.find((c) => c.key === category);

  const pick = (key) => {
    const next = new URLSearchParams(params);
    if (key === 'all') next.delete('c');
    else next.set('c', key);
    const query = next.toString();
    window.history.replaceState(null, '', `${pathname}${query ? `?${query}` : ''}`);
  };

  return (
    <>
      <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Photo category">
        <Chip tone="solid" pressed={category === 'all'} onClick={() => pick('all')}>All</Chip>
        {GALLERY_CATEGORIES.filter((c) => c.key !== 'rooms' || roomPhotos.length > 0).map((c) => (
          <Chip key={c.key} tone="solid" pressed={category === c.key} onClick={() => pick(c.key)}>{c.label}</Chip>
        ))}
      </div>

      {/* The chosen category as a heading, so the page has an outline beyond its title. */}
      {current && (
        <h2 className="mb-6 font-serif text-2xl font-semibold text-ink-900">
          {current.label} <span className="font-sans text-sm font-normal text-ink-400">· {shown.length} photo{shown.length === 1 ? '' : 's'}</span>
        </h2>
      )}

      {category === 'rooms' && roomPhotos.length === 0 && (
        <div className="photo-coming-soon h-64 rounded-2xl">
          <span className="text-sm font-medium uppercase tracking-[0.2em]">Room photos coming soon</span>
        </div>
      )}

      {/* A grid, not CSS columns: photos read left to right, in the order the viewer steps through them. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(i)}
            // Every tile has its shape before its photo arrives, so nothing jumps.
            className="media-zoom block aspect-[4/3] w-full overflow-hidden rounded-2xl bg-sand-200"
            aria-label={`Open photo: ${p.alt}`}
          >
            <img src={thumb(p.src)} alt={p.alt} loading="lazy" decoding="async" className="h-full w-full object-cover" {...(p.placeholder ? { 'data-placeholder': 'true' } : {})} />
          </button>
        ))}
      </div>

      <Lightbox photos={shown} index={open} onChange={setOpen} onClose={() => setOpen(null)} />
    </>
  );
}
