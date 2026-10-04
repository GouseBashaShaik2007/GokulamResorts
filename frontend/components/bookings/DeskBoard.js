'use client';

import { useCallback, useEffect, useState } from 'react';
import api, { TOKEN_KEYS, authFor } from '../../lib/api';
import useCleaningSocket, { LiveBadge, StaleNotice } from '../../lib/useCleaningSocket';
import { StatusBadge, inr, fmtDate, fmtDateTime, errMsg } from '../../lib/bookingUi';
import BookingDetail from './BookingDetail';
import BookingSearch from './BookingSearch';
import CounterBookingForm from './CounterBookingForm';
import RoomBoard from './RoomBoard';

// What still stands between an arriving guest and a check-in, as small flags,
// so the desk can sort it out before the guest is standing there.
function Blockers({ b }) {
  const flags = [
    b.has_primary_id === false && 'ID needed',
    b.room_status && b.room_status !== 'Ready' && `Room ${b.room_status.toLowerCase()}`,
  ].filter(Boolean);
  return flags.map((flag) => (
    <span key={flag} className="rounded-full bg-orange-400/10 px-2 py-0.5 text-xs text-orange-700">{flag}</span>
  ));
}

function BookingRow({ b, onOpen, hint, showBlockers }) {
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
        {showBlockers && <Blockers b={b} />}
        {due > 0 && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-700">Due {inr(due)}</span>}
        <StatusBadge status={b.status} />
      </span>
    </button>
  );
}

// `note`: a line under the title saying what to do about this group.
function Group({ title, note, items, empty, onOpen, hint, accent, showBlockers }) {
  return (
    <section>
      <h3 className={`text-sm font-semibold uppercase tracking-wider ${note ? '' : 'mb-2'} ${accent || 'text-navy-300'}`}>
        {title} <span className="text-navy-400">({items.length})</span>
      </h3>
      {note && <p className="mb-2 mt-0.5 text-sm text-navy-300">{note}</p>}
      <div className="space-y-2">
        {items.map((b) => <BookingRow key={b.id} b={b} onOpen={onOpen} hint={hint?.(b)} showBlockers={showBlockers} />)}
        {items.length === 0 && <p className="text-sm text-navy-400">{empty}</p>}
      </div>
    </section>
  );
}

const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

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

  const refresh = useCallback(() => {
    load();
    setRefreshKey((k) => k + 1);
  }, [load]);
  const live = useCleaningSocket(tokenKey, refresh, 'booking:update');

  const tab = (key, label) => (
    <button
      onClick={() => setView(key)}
      aria-pressed={view === key}
      className={`rounded-full px-4 py-1.5 text-sm ${view === key ? 'bg-ocean-500 font-medium text-white' : 'bg-navy-800 text-navy-200'}`}
    >
      {label}
    </button>
  );

  const today = data?.today;
  const departuresIds = new Set((data?.departures || []).map((b) => b.id));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tab('today', 'Today')}
          {tab('rooms', 'Rooms')}
          {tab('search', 'Find booking')}
        </div>
        <div className="flex items-center gap-4">
          <LiveBadge live={live} />
          {/* An action, not a view — so it is a button, set apart from the tabs. */}
          <button type="button" onClick={() => setView('new')} className="btn-gold px-4 py-2 text-sm">+ Walk-in booking</button>
        </div>
      </div>
      <StaleNotice live={live} onRefresh={refresh} />
      {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}

      {view === 'today' && data && (
        <div className="space-y-8">
          {/* The day in one line: what a desk needs before anything else. */}
          <p className="font-serif text-2xl font-semibold text-navy-50">
            {new Date(`${today}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            <span className="mt-1 block font-sans text-sm font-normal text-navy-300">
              {count(data.arrivals.length, 'arrival')} · {count(data.departures.length, 'departure')} · {data.inHouse.length} in house
              {data.tomorrowArrivals ? ` · ${data.tomorrowArrivals.length} arriving tomorrow` : ''}
            </span>
          </p>

          {data.awaitingApproval.length > 0 && (
            <Group
              title={mode === 'admin' ? 'Needs your approval' : 'Awaiting manager approval'}
              note={
                mode === 'admin'
                  ? 'Paid online. Open one to approve or decline it; left alone, it cancels and refunds itself at the time shown.'
                  : 'Paid online, not yet approved. Only the manager can approve — if the guest is here or the time is close, call the manager.'
              }
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
            showBlockers
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
          {data.tomorrowArrivals && (
            <Group
              title="Arriving tomorrow"
              items={data.tomorrowArrivals}
              empty="Nobody is due tomorrow yet."
              onOpen={setOpenId}
              showBlockers
            />
          )}
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

      {view === 'rooms' && <RoomBoard auth={auth} onOpen={setOpenId} refreshKey={refreshKey} />}

      {view === 'search' && <BookingSearch auth={auth} onOpen={setOpenId} refreshKey={refreshKey} />}

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
