'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../lib/api';
import { StatusBadge, inr, fmtDate, errMsg, STATUS_LABEL } from '../../lib/bookingUi';

const PAGE_SIZE = 25;
const MAX_ROWS = 500; // the most the API returns for one search

const SORTS = {
  newest: { label: 'Newest booking first', fn: (a, b) => new Date(b.created_at) - new Date(a.created_at) },
  checkIn: { label: 'Check-in date', fn: (a, b) => String(a.check_in).localeCompare(String(b.check_in)) || a.id - b.id },
  due: { label: 'Balance due, highest first', fn: (a, b) => Number(b.balance_due) - Number(a.balance_due) },
};

// One cell of a CSV file. Text that a spreadsheet would run as a formula
// (a guest "name" starting with = + - or @) is made plain with a leading '.
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(rows) {
  const header = ['Booking', 'Reference', 'Guest', 'Phone', 'Email', 'Room', 'Room type', 'Check-in', 'Check-out', 'Status', 'Total', 'Paid', 'Balance due', 'Source', 'Booked on'];
  const lines = rows.map((b) =>
    [
      b.id, b.reference, b.guest_name, b.guest_phone, b.guest_email, b.unit_number, b.room_type,
      String(b.check_in).slice(0, 10), String(b.check_out).slice(0, 10), STATUS_LABEL[b.status] || b.status,
      b.total_amount, b.amount_paid, b.balance_due, b.source, String(b.created_at).slice(0, 10),
    ].map(csvCell).join(',')
  );
  // The leading BOM makes Excel read names with non-English letters correctly.
  const blob = new Blob([`﻿${[header.map(csvCell).join(','), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `gokulam-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Find any booking: by number, name or phone, by status, and by the dates the
 * stay touches. Sortable, paged, and downloadable as a spreadsheet file.
 * `onOpen(bookingId)` opens one; `refreshKey` changes when a booking changes.
 */
export default function BookingSearch({ auth, onOpen, refreshKey }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  const newest = useRef(0); // number of the latest search; answers to older ones are dropped
  const load = useCallback(async () => {
    newest.current += 1;
    const mine = newest.current;
    try {
      const res = await api.get(
        '/desk/bookings',
        auth({ params: { q: q || undefined, status: status || undefined, from: from || undefined, to: to || undefined, limit: MAX_ROWS } })
      );
      if (mine !== newest.current) return;
      setRows(res.data.bookings);
      setError('');
    } catch (err) {
      if (mine === newest.current) setError(errMsg(err, 'Search failed'));
    }
  }, [q, status, from, to, auth]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load, refreshKey]);

  // A new search starts on its first page.
  useEffect(() => setPage(1), [q, status, from, to, sort]);

  const sorted = useMemo(() => [...rows].sort(SORTS[sort].fn), [rows, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const shown = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <input className="input-field max-w-sm flex-1 py-2" placeholder="Booking #, guest name or phone" aria-label="Search bookings" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input-field w-auto py-2" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="text-xs text-ink-400">
          Staying from
          <input type="date" className="input-field mt-0.5 block w-auto py-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs text-ink-400">
          to
          <input type="date" min={from || undefined} className="input-field mt-0.5 block w-auto py-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <select className="input-field w-auto py-2" aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}>
          {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-400">
        <p role="status">
          {sorted.length} booking{sorted.length === 1 ? '' : 's'}
          {sorted.length >= MAX_ROWS && ` (the first ${MAX_ROWS} — narrow the search to see the rest)`}
        </p>
        <button type="button" disabled={sorted.length === 0} onClick={() => downloadCsv(sorted)} className="rounded-lg border border-sand-400 px-3 py-1.5 text-sm text-ink-800 hover:bg-sand-200 disabled:opacity-40">
          Download as CSV
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">Bookings matching the search. Select a booking number to open it.</caption>
          <thead>
            <tr className="border-b border-sand-300 text-ink-400">
              <th scope="col" className="px-4 py-2">#</th>
              <th scope="col" className="px-4 py-2">Guest</th>
              <th scope="col" className="px-4 py-2">Room</th>
              <th scope="col" className="px-4 py-2">Dates</th>
              <th scope="col" className="px-4 py-2">Total</th>
              <th scope="col" className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((b) => (
              <tr key={b.id} onClick={() => onOpen(b.id)} className="cursor-pointer border-b border-sand-200 text-ink-800 hover:bg-sand-200">
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(b.id);
                    }}
                    aria-label={`Open booking ${b.id}, ${b.guest_name}`}
                    className="font-medium text-ocean-600 underline underline-offset-2"
                  >
                    {b.id}
                  </button>
                </td>
                <td className="px-4 py-2">
                  {b.guest_name}
                  <div className="text-xs text-ink-400">{b.guest_phone} · {b.source}</div>
                </td>
                <td className="px-4 py-2">{b.unit_number} <span className="text-xs text-ink-400">{b.room_type}</span></td>
                <td className="px-4 py-2">{fmtDate(b.check_in)} → {fmtDate(b.check_out)}</td>
                <td className="px-4 py-2">
                  {inr(b.total_amount)}
                  {Number(b.balance_due) > 0 && <div className="text-xs text-red-700">Due {inr(b.balance_due)}</div>}
                </td>
                <td className="px-4 py-2"><StatusBadge status={b.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-4 text-ink-400">No bookings found.</p>}
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm" aria-label="Pages of results">
          <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-sand-400 px-3 py-1.5 text-ink-800 disabled:opacity-40">← Previous</button>
          <span className="text-ink-500">Page {page} of {pages}</span>
          <button type="button" disabled={page === pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-sand-400 px-3 py-1.5 text-ink-800 disabled:opacity-40">Next →</button>
        </nav>
      )}
    </div>
  );
}
