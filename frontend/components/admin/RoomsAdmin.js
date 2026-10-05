'use client';

import { useEffect, useState } from 'react';
import RoomsManager from './RoomsManager';
import RoomUnitsManager from './RoomUnitsManager';

const TABS = [
  { key: 'types', label: 'Room types' },
  { key: 'numbers', label: 'Room numbers' },
];

/** Admin → Rooms: the room types guests browse, and the numbered rooms of each type. */
export default function RoomsAdmin() {
  const [tab, setTab] = useState('types');

  // /admin/rooms?tab=numbers opens straight on the room numbers.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('tab');
    if (TABS.some((t) => t.key === wanted)) setTab(wanted);
  }, []);

  const pick = (key) => {
    setTab(key);
    const url = new URL(window.location.href);
    if (key === 'types') url.searchParams.delete('tab');
    else url.searchParams.set('tab', key);
    window.history.replaceState(null, '', url);
  };

  return (
    <div>
      <div className="mb-6 flex gap-2 border-b border-sand-200 pb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => pick(t.key)}
            aria-pressed={tab === t.key}
            className={`rounded-lg px-3 py-1.5 text-sm ${tab === t.key ? 'bg-sand-300 font-medium text-gold-600' : 'text-ink-500 hover:text-ink-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'types' ? <RoomsManager /> : <RoomUnitsManager />}
    </div>
  );
}
