'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { roomPath } from '@/lib/rooms';

const KEY = 'gokulam_recent_rooms';
const MAX = 4;

function read() {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

/** Call on a room page to remember it. */
export function TrackRoomView({ room }) {
  useEffect(() => {
    try {
      const entry = { id: room.id, slug: room.slug, name: room.name, price: Number(room.price_per_night) };
      const next = [entry, ...read().filter((r) => r.id !== room.id)].slice(0, MAX);
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage blocked — just don't remember
    }
  }, [room.id, room.slug, room.name, room.price_per_night]);
  return null;
}

/** A quiet "You recently looked at" strip. Hidden when there's nothing to show. */
export default function RecentlyViewed({ excludeId, className = '' }) {
  const [rooms, setRooms] = useState([]);
  useEffect(() => setRooms(read().filter((r) => r.id !== excludeId)), [excludeId]);
  if (rooms.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 text-sm ${className}`}>
      <span className="text-ink-400">Recently viewed:</span>
      {rooms.map((r) => (
        <Link key={r.id} href={roomPath(r)} className="rounded-full border border-sand-300 px-3 py-1 text-ink-800 hover:border-ocean-400 hover:text-ocean-500">
          {r.name}
        </Link>
      ))}
    </div>
  );
}
