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
            ['list', 'List / Approvals'],
            ['calendar', 'Calendar'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`rounded-lg px-3 py-1.5 text-sm ${view === key ? 'bg-navy-700 text-gold-600' : 'text-navy-300 hover:text-navy-100'}`}
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
