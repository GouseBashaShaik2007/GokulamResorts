'use client';

import { useRef, useState } from 'react';
import RoomCard from '../RoomCard';
import { offersForRoom } from '@/lib/offers';

/**
 * Horizontal, swipeable row of room cards. Arrow buttons on desktop; on a
 * phone a "2 / 4" counter says there is more to swipe to. The row itself can
 * be focused and scrolled with the arrow keys. `offers`: live offers.
 */
export default function RoomSlider({ rooms, offers = [] }) {
  const track = useRef(null);
  const [index, setIndex] = useState(0); // the card at the left edge

  const scroll = (dir) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const onScroll = () => {
    const el = track.current;
    const cards = el ? [...el.children] : [];
    if (cards.length === 0) return;
    // At the far end the last card may never reach the left edge.
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    const left = el.getBoundingClientRect().left;
    const nearest = cards.reduce((best, card, i) => (Math.abs(card.getBoundingClientRect().left - left) < Math.abs(cards[best].getBoundingClientRect().left - left) ? i : best), 0);
    setIndex(atEnd ? cards.length - 1 : nearest);
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
        onScroll={onScroll}
        tabIndex={0}
        role="region"
        aria-label="Rooms"
        className="-mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth rounded-2xl px-4 pb-4 [scrollbar-width:none] focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-400 sm:mx-0 sm:px-0"
      >
        {rooms.map((room) => (
          <div key={room.id} className="w-[85%] flex-none snap-start sm:w-[46%] lg:w-[31.5%]">
            <RoomCard room={room} size="slide" offer={offersForRoom(offers, room)[0]} />
          </div>
        ))}
      </div>
      {rooms.length > 1 && (
        <p className="mt-1 text-center text-xs font-medium text-navy-400 [font-variant-numeric:tabular-nums] md:hidden" aria-hidden="true">
          {index + 1} / {rooms.length} · swipe for more
        </p>
      )}
    </div>
  );
}
