'use client';

import { useRef } from 'react';
import RoomCard from '../RoomCard';

/** Horizontal, swipeable row of room cards with arrow buttons on desktop. */
export default function RoomSlider({ rooms }) {
  const track = useRef(null);
  const scroll = (dir) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };
  const arrow = 'hidden h-11 w-11 items-center justify-center rounded-full border border-navy-700 bg-navy-950 text-xl text-navy-100 hover:border-ocean-400 md:flex';

  return (
    <div className="relative">
      <div className="mb-4 hidden justify-end gap-2 md:flex">
        <button type="button" onClick={() => scroll(-1)} className={arrow} aria-label="Previous rooms">‹</button>
        <button type="button" onClick={() => scroll(1)} className={arrow} aria-label="Next rooms">›</button>
      </div>
      <div
        ref={track}
        className="-mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth px-4 pb-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
      >
        {rooms.map((room) => (
          <div key={room.id} className="w-[85%] flex-none snap-start sm:w-[46%] lg:w-[31.5%]">
            <RoomCard room={room} size="slide" />
          </div>
        ))}
      </div>
    </div>
  );
}
