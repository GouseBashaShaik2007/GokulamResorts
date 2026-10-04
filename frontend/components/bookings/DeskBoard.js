'use client';

import { useCallback, useEffect, useState } from 'react';
import api, { TOKEN_KEYS, authFor } from '../../lib/api';
import useCleaningSocket, { LiveBadge } from '../../lib/useCleaningSocket';
import { StatusBadge, inr, fmtDate, fmtDateTime, errMsg, STATUS_LABEL } from '../../lib/bookingUi';
import BookingDetail from './BookingDetail';
import CounterBookingForm from './CounterBookingForm';

function BookingRow({ b, onOpen, hint }) {
  const due = Number(b.balance_due);
  return (
    <button
      onClick={() => onOpen(b.id)}
      className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-navy-700 bg-navy-800 px-4 py-3 text-left transition hover:border-navy-500"
    >
      <span className="flex items-center gap-3">
        <span className="w-12 font-serif text-xl font-bold text-navy-50">{b.unit_number}</span>
        <span>
          <span className="block font-medium text-navy-50">{b.guest_name}</span>
          <span className="block text-xs text-navy-400">
            #{b.id} · {fmtDate(b.check_in)} → {fmtDate(b.check_out)} · {b.adults + b.children} guest{b.adults + b.children > 1 ? 's' : ''}
          </span>
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {hint}
        {due > 0 && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-700">Due {inr(due)}</span>}
        <StatusBadge status={b.status} />
      </span>
    </button>
  );
}

function Group({ title, items, empty, onOpen, hint, accent }) {
  return (
    <section>
      <h3 className={`mb-2 text-sm font-semibold uppercase tracking-wider ${accent || 'text-navy-300'}`}>
        {title} <span className="text-navy-500">({items.length})</span>
      </h3>
      <div className="space-y-2">
        {items.map((b) => <BookingRow key={b.id} b={b} onOpen={onOpen} hint={hint?.(b)} />)}
        {items.length === 0 && <p className="text-sm text-navy-500">{empty}</p>}
      </div>
    </section>
  );
}

function SearchPanel({ auth, onOpen, refreshKey }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/desk/bookings', auth({ params: { q: q || undefined, status: status || undefined } }));
      setRows(res.data.bookings);
      setError('');
    } catch (err) {
      setError(errMsg(err, 'Search failed'));
    }
  }, [q, status, auth]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load, refreshKey]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input className="input-field max-w-sm flex-1 py-2" placeholder="Booking #, guest name or phone" aria-label="Search bookings" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input-field w-auto py-2" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-700 text-navy-400">
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Guest</th>
              <th className="px-4 py-2">Room</th>
              <th className="px-4 py-2">Dates</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} onClick={() => onOpen(b.id)} className="cursor-pointer border-b border-navy-800 text-navy-100 hover:bg-navy-800">
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
                  <div className="text-xs text-navy-400">{b.guest_phone} · {b.source}</div>
                </td>
                <td className="px-4 py-2">{b.unit_number} <span className="text-xs text-navy-400">{b.room_type}</span></td>
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
        {rows.length === 0 && <p className="p-4 text-navy-400">No bookings found.</p>}
      </div>
    </div>
  );
}

/** mode: 'desk' (FrontDesk staff token) or 'admin' (manager token). */
export default function DeskBoard({ mode }) {
  const auth = authFor(mode);
  const tokenKey = mode === 'admin' ? TOKEN_KEYS.admin : TOKEN_KEYS.staff;
  const [view, setView] = useState('today');
  const [data, setData] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/desk/overview', auth());
      setData(res.data);
      setError('');
    } catch (err) {
      setError(errMsg(err, 'Could not load the front desk'));
    }
  }, [auth]);

  useEffect(() => {
    load();
  }, [load]);

  const live = useCleaningSocket(
    tokenKey,
    () => {
      load();
      setRefreshKey((k) => k + 1);
    },
    'booking:update'
  );

  const tab = (key, label, count) => (
    <button
      onClick={() => setView(key)}
      className={`rounded-full px-4 py-1.5 text-sm ${view === key ? 'bg-ocean-500 font-medium text-white' : 'bg-navy-800 text-navy-200'}`}
    >
      {label}{count ? ` (${count})` : ''}
    </button>
  );

  const today = data?.today;
  const departuresIds = new Set((data?.departures || []).map((b) => b.id));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tab('today', 'Today')}
          {tab('new', '+ Walk-in booking')}
          {tab('search', 'Find booking')}
        </div>
        <LiveBadge live={live} />
      </div>
      {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

      {view === 'today' && data && (
        <div className="space-y-8">
          {data.awaitingApproval.length > 0 && (
            <Group
              title={mode === 'admin' ? 'Needs your approval' : 'Awaiting manager approval'}
              accent="text-gold-600"
              items={data.awaitingApproval}
              onOpen={setOpenId}
              hint={(b) => <span className="text-xs text-navy-400">auto-cancels {fmtDateTime(b.hold_expires_at)}</span>}
            />
          )}
          {data.pendingRefunds.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gold-600">Refunds to pay out at the counter ({data.pendingRefunds.length})</h3>
              <div className="space-y-2">
                {data.pendingRefunds.map((r) => (
                  <button key={r.id} onClick={() => setOpenId(r.booking_id)} className="flex w-full justify-between rounded-xl border border-gold-500/30 bg-gold-500/5 px-4 py-3 text-left text-sm">
                    <span className="text-navy-100">#{r.booking_id} · {r.guest_name} · Room {r.unit_number}</span>
                    <span className="font-semibold text-gold-600">{inr(r.amount)} · {r.method.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          <Group
            title="Arrivals"
            items={data.arrivals}
            empty="No arrivals due."
            onOpen={setOpenId}
            hint={(b) => (b.check_in < today ? <span className="text-xs text-orange-700">late since {fmtDate(b.check_in)}</span> : null)}
          />
          <Group
            title="Departures"
            items={data.departures}
            empty="No departures due today."
            onOpen={setOpenId}
            hint={(b) => (b.check_out < today ? <span className="text-xs text-orange-700">overdue</span> : null)}
          />
          <Group
            title="In house"
            items={data.inHouse.filter((b) => !departuresIds.has(b.id))}
            empty="No other guests in house."
            onOpen={setOpenId}
          />
        </div>
      )}

      {view === 'new' && (
        <CounterBookingForm
          mode={mode}
          onCreated={(b) => {
            setView('today');
            load();
            setOpenId(b.id);
          }}
        />
      )}

      {view === 'search' && <SearchPanel auth={auth} onOpen={setOpenId} refreshKey={refreshKey} />}

      {openId && (
        <BookingDetail
          bookingId={openId}
          mode={mode}
          refreshKey={refreshKey}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
