'use client';

import { useState } from 'react';
import RoomPhoto from './RoomPhoto';
import Lightbox from './Lightbox';

/** One large photo + four small. Empty slots show the "coming soon" frame. */
export default function RoomGallery({ name, photos }) {
  const [open, setOpen] = useState(null);
  const slots = Array.from({ length: 5 }, (_, i) => photos[i] || null);
  const items = photos.map((src, i) => ({ src, alt: `${name} — photo ${i + 1}` }));

  const tile = (src, i, extra) => (
    <button
      key={i}
      type="button"
      disabled={!src}
      onClick={() => setOpen(i)}
      className={`media-zoom relative overflow-hidden rounded-xl ${extra}`}
      aria-label={src ? `Open photo ${i + 1} of ${name}` : undefined}
    >
      <RoomPhoto
        src={src}
        alt={`${name} — photo ${i + 1}`}
        label={i === 0 ? 'Photos coming soon' : ''}
        sizes={i === 0 ? '(min-width: 640px) 50vw, 100vw' : '25vw'}
      />
      {i === 0 && photos.length > 1 && (
        <span className="photo-badge absolute bottom-3 right-3 sm:hidden">1 / {photos.length}</span>
      )}
      {i === 4 && photos.length > 5 && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-semibold text-white">
          +{photos.length - 5} more
        </span>
      )}
    </button>
  );

  return (
    <>
      {photos.length === 0 ? (
        <div className="relative h-64 overflow-hidden rounded-xl sm:h-80">
          <RoomPhoto src={null} alt={name} />
        </div>
      ) : (
        <div className="grid h-72 grid-cols-4 grid-rows-2 gap-2 sm:h-[30rem]">
          {tile(slots[0], 0, 'col-span-4 row-span-2 sm:col-span-2')}
          {slots.slice(1).map((src, i) => tile(src, i + 1, 'hidden sm:block'))}
        </div>
      )}
      <Lightbox photos={items} index={open} onChange={setOpen} onClose={() => setOpen(null)} />
    </>
  );
}
