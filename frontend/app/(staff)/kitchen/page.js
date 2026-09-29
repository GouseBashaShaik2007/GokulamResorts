'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import api, { withKitchenAuth } from '@/lib/api';
import { clearSignedIn } from '../_lib/session';

// Kitchen wall display. Deliberately its own high-contrast dark look (not the
// guest site theme): readable from across a hot, bright kitchen.

const TOKEN_KEY = 'gokulam_kitchen_token';
const STAFF_KEY = 'gokulam_kitchen_staff';
const POLL_MS = 5000;
const AMBER_MIN = 10;
const RED_MIN = 20;

const STATUS_FLOW = { new: 'preparing', preparing: 'ready', ready: 'served' };
const STATUS_LABEL = { new: 'New', preparing: 'Preparing', ready: 'Ready', served: 'Served', cancelled: 'Cancelled' };
const STATUS_ACTION_LABEL = { new: 'Start preparing', preparing: 'Mark ready', ready: 'Mark served' };
const COLUMN_ACCENT = { new: 'text-sky-300', preparing: 'text-violet-300', ready: 'text-emerald-300' };

let audioCtx = null;
// Must first run inside a user gesture (Start shift) for browsers to allow sound.
function playChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = audioCtx || new AudioContextClass();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    [880, 1320, 1760].forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const t = audioCtx.currentTime + idx * 0.18;
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  } catch {
    // Web Audio unsupported/blocked — the visual alert still works.
  }
}

// Keeps the display from sleeping. The lock drops whenever the tab is hidden,
// so it is re-requested when the page becomes visible again.
function useWakeLock(active) {
  const [state, setState] = useState('off'); // off | on | unsupported | failed
  const lockRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    if (!('wakeLock' in navigator)) {
      setState('unsupported');
      return undefined;
    }
    let cancelled = false;
    const request = async () => {
      try {
        lockRef.current = await navigator.wakeLock.request('screen');
        if (cancelled) return lockRef.current.release();
        setState('on');
        lockRef.current.addEventListener('release', () => !cancelled && setState('off'));
      } catch {
        if (!cancelled) setState('failed');
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && request();
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lockRef.current?.release().catch(() => {});
    };
  }, [active]);

  return state;
}

// "4:07" under an hour; "1h 12m" (or "13h 18m") after that.
function elapsed(fromIso, now) {
  const secs = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000));
  const mins = Math.floor(secs / 60);
  const label = mins < 60 ? `${mins}:${String(secs % 60).padStart(2, '0')}` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return { mins, label };
}

function KitchenSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950">
      <div className="h-3 w-3 animate-ping rounded-full bg-amber-300" />
    </div>
  );
}

function StartShift({ onStart }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/95 px-4">
      <div className="max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Kitchen display</p>
        <h1 className="mt-3 text-4xl font-bold text-white">Ready to start the shift?</h1>
        <p className="mt-4 text-lg text-neutral-300">
          This turns on the new-order sound and keeps this screen from going to sleep.
        </p>
        <button onClick={onStart} className="mt-8 rounded-2xl bg-amber-300 px-10 py-5 text-2xl font-bold text-neutral-950 shadow-lg shadow-amber-300/20 active:scale-95">
          Start shift
        </button>
      </div>
    </div>
  );
}

function OrderCard({ order, now, onAdvance, onCancel }) {
  const t = elapsed(order.created_at, now);
  const level = t.mins >= RED_MIN ? 'red' : t.mins >= AMBER_MIN ? 'amber' : 'ok';
  const frame = {
    ok: 'border-neutral-600',
    amber: 'border-amber-400 ring-2 ring-amber-400/40',
    red: 'border-red-500 ring-4 ring-red-500/50',
  }[level];
  const timer = {
    ok: 'bg-neutral-800 text-white',
    amber: 'bg-amber-400 text-neutral-950',
    red: 'animate-pulse bg-red-600 text-white',
  }[level];

  return (
    <article className={`rounded-2xl border-2 bg-neutral-900 p-5 ${frame}`}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-bold leading-tight text-white">
            {order.table_number ? `Table ${order.table_number}` : order.customer_name || 'Walk-in'}
          </p>
          <p className="mt-1 text-sm text-neutral-400">#{order.id} · {order.order_type === 'table' ? 'Dine-in' : 'Counter'}</p>
        </div>
        <span
          className={`rounded-xl px-3 py-1.5 font-mono text-2xl font-bold tabular-nums ${timer}`}
          aria-label={`Waiting ${t.mins} minutes`}
        >
          {t.label}
        </span>
      </header>

      <ul className="mt-4 divide-y divide-neutral-800">
        {order.items.map((item, idx) => (
          <li key={idx} className="flex items-baseline gap-3 py-2">
            <span className="min-w-[2.5rem] text-2xl font-bold text-amber-300">{item.quantity}×</span>
            <span className="flex-1">
              <span className="text-xl font-semibold text-white">{item.item_name}</span>
              {item.spice_level && (
                <span className="ml-2 rounded bg-orange-500 px-1.5 py-0.5 align-middle text-xs font-bold uppercase text-white">{item.spice_level}</span>
              )}
              {item.notes && <span className="mt-1 block text-base font-semibold text-yellow-300">↳ {item.notes}</span>}
            </span>
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className="mt-3 rounded-lg bg-yellow-300 px-3 py-2 text-base font-semibold text-neutral-950">Note: {order.notes}</p>
      )}

      <div className="mt-5 flex gap-3">
        {STATUS_FLOW[order.status] && (
          <button onClick={() => onAdvance(order)} className="flex-1 rounded-xl bg-white py-4 text-lg font-bold text-neutral-950 active:scale-[0.98]">
            {STATUS_ACTION_LABEL[order.status]}
          </button>
        )}
        <button onClick={() => onCancel(order)} className="rounded-xl border-2 border-red-500/70 px-4 text-sm font-semibold text-red-300">
          Cancel
        </button>
      </div>
    </article>
  );
}

export default function KitchenPage() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [shiftStarted, setShiftStarted] = useState(false);
  const [orders, setOrders] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  const lastMaxOrderId = useRef(0);
  const soundOnRef = useRef(false);
  const wakeLock = useWakeLock(shiftStarted);

  const signOut = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(STAFF_KEY);
    clearSignedIn('kitchen');
    router.replace('/kitchen/login');
  }, [router]);

  useEffect(() => {
    // middleware.js already redirected here if the session cookie was
    // missing; this covers a token that expired without a full navigation.
    if (!window.localStorage.getItem(TOKEN_KEY)) {
      signOut();
      return;
    }
    try {
      setStaffName(JSON.parse(window.localStorage.getItem(STAFF_KEY) || 'null')?.name || '');
    } catch {
      // ignore corrupt profile — cosmetic only
    }
    setLoggedIn(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timers tick every second.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const res = await api.get('/kitchen/orders', withKitchenAuth());
      const fetched = res.data.orders;
      const maxId = fetched.reduce((max, o) => Math.max(max, o.id), 0);
      if (lastMaxOrderId.current > 0 && maxId > lastMaxOrderId.current && soundOnRef.current) playChime();
      lastMaxOrderId.current = Math.max(lastMaxOrderId.current, maxId);
      setOrders(fetched);
      setError('');
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        signOut();
      } else {
        setError('Connection lost — retrying…');
      }
    }
  }, [signOut]);

  useEffect(() => {
    if (!loggedIn) return undefined;
    loadOrders();
    const interval = setInterval(loadOrders, POLL_MS);
    return () => clearInterval(interval);
  }, [loggedIn, loadOrders]);

  const startShift = () => {
    playChime(); // unlocks audio inside the click, and confirms the speaker works
    soundOnRef.current = true;
    setShiftStarted(true);
  };

  const updateStatus = async (order, status) => {
    try {
      await api.patch(`/kitchen/orders/${order.id}/status`, { status }, withKitchenAuth());
      loadOrders();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not update that order.');
    }
  };

  if (!loggedIn) return <KitchenSkeleton />;

  const grouped = ['new', 'preparing', 'ready'].map((status) => ({
    status,
    orders: orders.filter((o) => o.status === status),
  }));
  const late = orders.filter((o) => elapsed(o.created_at, now).mins >= RED_MIN).length;

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {!shiftStarted && <StartShift onStart={startShift} />}

      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 bg-neutral-950/95 px-6 py-4 backdrop-blur">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-bold">Live orders</h1>
          {staffName && <span className="text-sm text-neutral-400">Signed in as {staffName}</span>}
          {late > 0 && <span className="rounded-full bg-red-600 px-3 py-1 text-sm font-bold">{late} over {RED_MIN} min</span>}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className={`rounded-full px-3 py-1 ${shiftStarted ? 'bg-emerald-500/15 text-emerald-300' : 'bg-neutral-800 text-neutral-400'}`}>
            🔔 Sound {shiftStarted ? 'on' : 'off'}
          </span>
          <span
            className={`rounded-full px-3 py-1 ${wakeLock === 'on' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}
            title={wakeLock === 'unsupported' ? 'This browser cannot keep the screen awake — set the device to never sleep.' : ''}
          >
            ☀ Screen {wakeLock === 'on' ? 'kept awake' : wakeLock === 'unsupported' ? 'may sleep (unsupported)' : 'may sleep'}
          </span>
          <span className="text-neutral-500">
            Amber at {AMBER_MIN} min · red at {RED_MIN} min
          </span>
          <button
            onClick={() => {
              setShiftStarted(false);
              signOut();
            }}
            className="rounded-lg border border-neutral-600 px-3 py-1.5 text-neutral-300"
          >
            End shift / log out
          </button>
        </div>
      </header>

      {error && <p className="bg-red-600 px-6 py-2 text-center font-semibold">{error}</p>}

      <main className="grid gap-6 p-6 lg:grid-cols-3">
        {grouped.map(({ status, orders: list }) => (
          <section key={status}>
            <h2 className={`mb-4 text-lg font-bold uppercase tracking-wider ${COLUMN_ACCENT[status]}`}>
              {STATUS_LABEL[status]} <span className="text-neutral-500">({list.length})</span>
            </h2>
            <div className="space-y-4">
              {list.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  now={now}
                  onAdvance={(o) => updateStatus(o, STATUS_FLOW[o.status])}
                  onCancel={(o) => {
                    if (confirm(`Cancel order #${o.id}?`)) updateStatus(o, 'cancelled');
                  }}
                />
              ))}
              {list.length === 0 && <p className="rounded-2xl border border-dashed border-neutral-800 p-6 text-center text-neutral-500">No orders</p>}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
