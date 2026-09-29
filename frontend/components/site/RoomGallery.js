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
      <RoomPhoto src={src} alt={`${name} — photo ${i + 1}`} label={i === 0 ? 'Photos coming soon' : ''} />
      {i === 4 && photos.length > 5 && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-semibold text-white">
          +{photos.length - 5} more
        </span>
      )}
    </button>
  );

  return (
    <>
      <div className="grid h-[26rem] grid-cols-4 grid-rows-2 gap-2 sm:h-[30rem]">
        {tile(slots[0], 0, 'col-span-4 row-span-2 sm:col-span-2')}
        {slots.slice(1).map((src, i) => tile(src, i + 1, 'hidden sm:block'))}
      </div>
      <Lightbox photos={items} index={open} onChange={setOpen} onClose={() => setOpen(null)} />
    </>
  );
}
