'use client';

import { useState } from 'react';
import DeskBoard from '@/components/bookings/DeskBoard';
import BookingsCalendar from '@/components/admin/BookingsCalendar';

export default function AdminBookingsPage() {
  const [view, setView] = useState('list');

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Front Desk</p>
          <h1 className="section-heading mt-1">Bookings</h1>
        </div>
        <div className="flex gap-2">
          {[
            ['list', 'List / Approvals'],
            ['calendar', 'Calendar'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`rounded-lg px-3 py-1.5 text-sm ${view === key ? 'bg-navy-700 text-gold-400' : 'text-navy-300 hover:text-navy-100'}`}
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
