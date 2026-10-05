'use client';

import { useState } from 'react';
import DeskBoard from '@/components/bookings/DeskBoard';
import BookingsCalendar from '@/components/admin/BookingsCalendar';
import PageHeader from '@/components/ui/PageHeader';

export default function AdminBookingsPage() {
  const [view, setView] = useState('list');

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <PageHeader size="section" eyebrow="Front Desk" title="Bookings" />
        <div className="flex gap-2">
          {[
            ['list', 'List'],
            ['calendar', 'Calendar'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`rounded-lg px-3 py-1.5 text-sm ${view === key ? 'bg-sand-300 text-gold-600' : 'text-ink-500 hover:text-ink-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === 'list' ? <DeskBoard mode="admin" /> : <BookingsCalendar />}
    </div>
  );
}
