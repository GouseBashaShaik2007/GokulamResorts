'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api, { TOKEN_KEYS, withKitchenAuth } from '@/lib/api';
import { errMsg } from '@/lib/bookingUi';
import useStaffSession from '../_lib/useStaffSession';
import { useConfirm } from '@/components/ui/Confirm';
import { useToast } from '@/components/ui/Toast';
import VegMark from '@/components/ui/VegMark';
import { NEXT_ORDER_STATUS, ORDER_STATUS_LABEL, ORDER_TYPE_LABEL, PREVIOUS_ORDER_STATUS, splitOrderNotes } from '@/lib/foodOrders';
import useCleaningSocket from '@/lib/useCleaningSocket';

// Kitchen wall display. Deliberately its own high-contrast dark look (not the
// guest site theme): readable from across a hot, bright kitchen.

// New orders arrive as live events. The board also asks for itself — rarely
// while the live connection is up, every few seconds while it is down — so a
// dropped connection never leaves an order unseen.
const POLL_LIVE_MS = 20000;
const POLL_OFFLINE_MS = 5000;
// Ticket colours (amber, red) and the "late" count are worked out this often;
// the mm:ss on each ticket runs on its own one-second clock (see Elapsed).
const LEVEL_TICK_MS = 10000;
const AMBER_MIN = 10;
const RED_MIN = 20;
// The busiest dishes shown in the "to cook" strip.
const COOK_NOW_MAX = 8;

const STATUS_ACTION_LABEL = { new: 'Start preparing', preparing: 'Mark ready', ready: 'Mark served' };
// What a table asked for from its ordering page.
const REQUEST_LABEL = { staff: 'is calling for staff', bill: 'wants the bill' };
const COLUMN_ACCENT = { new: 'text-sky-300', preparing: 'text-violet-300', ready: 'text-emerald-300' };

// "Table 7", or the name a counter order was placed under.
const whoFor = (order) => (order.table_number ? `Table ${order.table_number}` : order.customer_name || `Order ${order.id}`);

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

// A running "4:07" that keeps its own clock, so only this small piece redraws
// every second — not the whole board.
function Elapsed({ since, className }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className={className}>{elapsed(since, now).label}</span>;
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
        <h2 className="mt-3 text-4xl font-bold text-white">Ready to start the shift?</h2>
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

// Tables waiting for a person — above the orders, because someone has to walk over.
function TableRequests({ requests, onDone }) {
  if (requests.length === 0) return null;
  return (
    <section aria-label="Table requests" className="flex flex-wrap gap-3 border-b border-neutral-800 bg-amber-300/10 px-6 py-4">
      {requests.map((r) => (
        <div key={r.id} className="flex items-center gap-4 rounded-2xl border-2 border-amber-300 bg-neutral-900 px-4 py-3">
          <p className="text-xl font-bold text-white">
            Table {r.table_number} <span className="font-semibold text-amber-300">{REQUEST_LABEL[r.kind] || r.kind}</span>
            <Elapsed since={r.created_at} className="ml-3 font-mono text-base font-normal tabular-nums text-neutral-400" />
          </p>
          <button onClick={() => onDone(r)} className="rounded-xl bg-white px-4 py-2 text-base font-bold text-neutral-950 active:scale-95">
            Done
          </button>
        </div>
      ))}
    </section>
  );
}

// Every dish still to be cooked, added up across tickets ("6× Chicken biryani"
// spread over four tables), busiest first — what to put on the stove now.
function CookNow({ orders }) {
  const dishes = useMemo(() => {
    const totals = new Map();
    orders
      .filter((o) => o.status === 'new' || o.status === 'preparing')
      .forEach((o) => o.items.forEach((item) => totals.set(item.item_name, (totals.get(item.item_name) || 0) + item.quantity)));
    return [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [orders]);

  // One ticket's worth is already on its ticket; the strip earns its place
  // once the same work is spread over several.
  if (dishes.length === 0 || orders.filter((o) => o.status !== 'ready').length < 2) return null;
  const more = dishes.length - COOK_NOW_MAX;

  return (
    <section aria-label="To cook now, across all tickets" className="flex flex-wrap items-center gap-2 border-b border-neutral-800 px-6 py-3">
      <h2 className="mr-1 text-sm font-bold uppercase tracking-wider text-neutral-400">To cook</h2>
      {dishes.slice(0, COOK_NOW_MAX).map(([name, quantity]) => (
        <span key={name} className="rounded-lg bg-neutral-800 px-3 py-1.5 text-base font-semibold text-white">
          <span className="text-amber-300">{quantity}×</span> {name}
        </span>
      ))}
      {more > 0 && <span className="text-sm text-neutral-400">+{more} more dish{more === 1 ? '' : 'es'}</span>}
    </section>
  );
}

// `mins`: whole minutes this order has waited (drives the amber / red frame).
const OrderCard = memo(function OrderCard({ order, mins, onAdvance, onCancel }) {
  // A ready ticket is the kitchen's work done: it shows how long the food has
  // been waiting to be served, and no longer turns amber or red.
  const isReady = order.status === 'ready';
  const level = isReady ? 'done' : mins >= RED_MIN ? 'red' : mins >= AMBER_MIN ? 'amber' : 'ok';
  const frame = {
    ok: 'border-neutral-600',
    done: 'border-emerald-500/60',
    amber: 'border-amber-400 ring-2 ring-amber-400/40',
    red: 'border-red-500 ring-4 ring-red-500/50',
  }[level];
  const timer = {
    ok: 'bg-neutral-800 text-white',
    done: 'bg-emerald-500/15 text-emerald-300',
    amber: 'bg-amber-400 text-neutral-950',
    red: 'animate-pulse bg-red-600 text-white',
  }[level];
  const { allergy, notes } = splitOrderNotes(order.notes);

  return (
    <article className={`rounded-2xl border-2 bg-neutral-900 p-5 ${frame}`}>
      {/* First thing on the ticket: an allergy must not read like an ordinary note. */}
      {allergy && (
        <p className="mb-4 rounded-lg bg-red-600 px-3 py-2 text-lg font-bold uppercase tracking-wide text-white">
          Allergy: {allergy}
        </p>
      )}
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-bold leading-tight text-white">
            {order.table_number ? `Table ${order.table_number}` : order.customer_name || 'Walk-in'}
          </p>
          <p className="mt-1 text-sm text-neutral-400">
            #{order.id} · {ORDER_TYPE_LABEL[order.order_type] || order.order_type} order
            {/* Up here, well away from the big button a thumb is aiming for. */}
            <button onClick={() => onCancel(order)} className="ml-3 rounded px-1 text-sm text-red-300 underline underline-offset-2">
              Cancel order
            </button>
          </p>
        </div>
        <span className={`rounded-xl px-3 py-1.5 text-right font-mono text-2xl font-bold tabular-nums ${timer}`}>
          {isReady && <span className="block font-sans text-[0.65rem] font-semibold uppercase tracking-wider">Ready for</span>}
          <Elapsed since={isReady ? order.updated_at : order.created_at} />
          <span className="sr-only">{isReady ? ' since it was ready' : ` waiting, ${mins} minutes`}</span>
        </span>
      </header>

      <ul className="mt-4 divide-y divide-neutral-800">
        {order.items.map((item, idx) => (
          <li key={item.id ?? idx} className="flex items-baseline gap-3 py-2">
            <span className="min-w-[2.5rem] text-2xl font-bold text-amber-300">{item.quantity}×</span>
            <span className="flex-1">
              {/* Veg / non-veg as the dish is on the menu; nothing if it has since been removed. */}
              {typeof item.is_veg === 'boolean' && <VegMark veg={item.is_veg} className="mr-2 align-middle" />}
              <span className="text-xl font-semibold text-white">{item.item_name}</span>
              {item.spice_level && (
                <span className="ml-2 rounded bg-orange-500 px-1.5 py-0.5 align-middle text-xs font-bold uppercase text-white">{item.spice_level}</span>
              )}
              {item.notes && <span className="mt-1 block text-base font-semibold text-yellow-300">↳ {item.notes}</span>}
            </span>
          </li>
        ))}
      </ul>

      {notes && (
        <p className="mt-3 rounded-lg bg-yellow-300 px-3 py-2 text-base font-semibold text-neutral-950">Note: {notes}</p>
      )}

      {NEXT_ORDER_STATUS[order.status] && (
        <button onClick={() => onAdvance(order)} className="mt-5 w-full rounded-xl bg-white py-4 text-lg font-bold text-neutral-950 active:scale-[0.98]">
          {STATUS_ACTION_LABEL[order.status]}
        </button>
      )}
    </article>
  );
});

export default function KitchenPage() {
  const ask = useConfirm();
  const toast = useToast();
  // middleware.js already sent anyone without the session cookie to the PIN
  // screen; this covers a sign-in that has expired since.
  const { ready: loggedIn, profile, signOut } = useStaffSession('kitchen');
  const staffName = profile?.name || '';
  const [shiftStarted, setShiftStarted] = useState(false);
  const [orders, setOrders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  // Read out by screen readers; the chime covers everyone who can hear it.
  const [announcement, setAnnouncement] = useState('');
  const lastMaxOrderId = useRef(0);
  const lastMaxRequestId = useRef(0);
  const soundOnRef = useRef(false);
  const wakeLock = useWakeLock(shiftStarted);

  // For the amber / red frames and the late count; each ticket's mm:ss runs on its own clock.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), LEVEL_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const res = await api.get('/kitchen/orders', withKitchenAuth());
      const fetched = res.data.orders;
      const maxId = fetched.reduce((max, o) => Math.max(max, o.id), 0);
      if (lastMaxOrderId.current > 0 && maxId > lastMaxOrderId.current) {
        if (soundOnRef.current) playChime();
        const fresh = fetched.filter((o) => o.id > lastMaxOrderId.current);
        setAnnouncement(`New order: ${fresh.map(whoFor).join(', ')}`);
      }
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

  // Chimes like a new order does. A failure here never takes the board down:
  // orders matter more, and loadOrders reports a lost connection.
  const loadRequests = useCallback(async () => {
    try {
      const res = await api.get('/kitchen/requests', withKitchenAuth());
      const fetched = res.data.requests;
      const maxId = fetched.reduce((max, r) => Math.max(max, r.id), 0);
      if (maxId > lastMaxRequestId.current) {
        if (soundOnRef.current) playChime();
        const fresh = fetched.filter((r) => r.id > lastMaxRequestId.current);
        setAnnouncement(fresh.map((r) => `Table ${r.table_number} ${REQUEST_LABEL[r.kind] || r.kind}`).join('. '));
      }
      lastMaxRequestId.current = Math.max(lastMaxRequestId.current, maxId);
      setRequests(fetched);
    } catch {
      // keep showing what we had
    }
  }, []);

  const load = useCallback(() => {
    loadOrders();
    loadRequests();
  }, [loadOrders, loadRequests]);

  // Live: the API says "something changed" the moment an order is placed,
  // cancelled or moved on, or a table calls — and the board reloads.
  const live = useCleaningSocket(TOKEN_KEYS.kitchen, () => loggedIn && load(), 'food:update');

  useEffect(() => {
    if (!loggedIn) return undefined;
    load();
    const interval = setInterval(load, live ? POLL_LIVE_MS : POLL_OFFLINE_MS);
    return () => clearInterval(interval);
  }, [loggedIn, load, live]);

  const completeRequest = async (request) => {
    setRequests((list) => list.filter((r) => r.id !== request.id));
    try {
      await api.patch(`/kitchen/requests/${request.id}/done`, {}, withKitchenAuth());
    } catch (err) {
      // 404 = someone else already marked it done, which is fine.
      if (err?.response?.status !== 404) setError(errMsg(err, 'Could not update that request.'));
      loadRequests();
    }
  };

  const startShift = () => {
    playChime(); // unlocks audio inside the click, and confirms the speaker works
    soundOnRef.current = true;
    setShiftStarted(true);
  };

  const updateStatus = async (order, status, { undoable = true } = {}) => {
    try {
      await api.patch(`/kitchen/orders/${order.id}/status`, { status }, withKitchenAuth());
      loadOrders();
      // One tap moves a ticket on (and "served" takes it off the board), so a
      // slip of the thumb can be put back for a few seconds.
      if (undoable && PREVIOUS_ORDER_STATUS[status] === order.status) {
        toast(`${whoFor(order)}: ${ORDER_STATUS_LABEL[status]}`, {
          tone: 'info',
          duration: 8000,
          action: { label: 'Undo', onClick: () => updateStatus(order, order.status, { undoable: false }) },
        });
      }
    } catch (err) {
      setError(errMsg(err, 'Could not update that order.'));
    }
  };

  // Tickets are memoised, so the handlers they get must not change between
  // renders; they reach the latest updateStatus through this ref.
  const latest = useRef({});
  latest.current = { updateStatus, ask };
  const advance = useCallback((o) => latest.current.updateStatus(o, NEXT_ORDER_STATUS[o.status]), []);
  const cancelOrder = useCallback(async (o) => {
    const ok = await latest.current.ask({
      title: `Cancel order #${o.id}?`,
      body: 'It leaves the board and the guest sees it as cancelled.',
      confirmLabel: 'Cancel order',
      cancelLabel: 'Keep order',
      danger: true,
    });
    if (ok) latest.current.updateStatus(o, 'cancelled');
  }, []);

  if (!loggedIn) return <KitchenSkeleton />;

  const grouped = ['new', 'preparing', 'ready'].map((status) => ({
    status,
    orders: orders.filter((o) => o.status === status),
  }));
  // Late means still being cooked after RED_MIN; a ready ticket is not the kitchen's wait.
  const late = orders.filter((o) => o.status !== 'ready' && elapsed(o.created_at, now).mins >= RED_MIN).length;

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
          <span className={`rounded-full px-3 py-1 ${live ? 'bg-emerald-500/15 text-emerald-300' : 'bg-neutral-800 text-neutral-400'}`}>
            {live ? 'Live' : `Checking every ${POLL_OFFLINE_MS / 1000}s`}
          </span>
          <span className={`rounded-full px-3 py-1 ${shiftStarted ? 'bg-emerald-500/15 text-emerald-300' : 'bg-neutral-800 text-neutral-400'}`}>
            <span aria-hidden="true">🔔 </span>Sound {shiftStarted ? 'on' : 'off'}
          </span>
          <span
            className={`rounded-full px-3 py-1 ${wakeLock === 'on' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}
            title={wakeLock === 'unsupported' ? 'This browser cannot keep the screen awake — set the device to never sleep.' : ''}
          >
            <span aria-hidden="true">☀ </span>Screen {wakeLock === 'on' ? 'kept awake' : wakeLock === 'unsupported' ? 'may sleep (unsupported)' : 'may sleep'}
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

      <p className="sr-only" aria-live="assertive">{announcement}</p>
      {error && <p role="alert" className="bg-red-600 px-6 py-2 text-center font-semibold">{error}</p>}

      <TableRequests requests={requests} onDone={completeRequest} />
      <CookNow orders={orders} />

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        {grouped.map(({ status, orders: list }) => (
          <section key={status}>
            <h2 className={`mb-4 text-lg font-bold uppercase tracking-wider ${COLUMN_ACCENT[status]}`}>
              {ORDER_STATUS_LABEL[status]} <span className="text-neutral-500">({list.length})</span>
            </h2>
            <div className="space-y-4">
              {list.map((order) => (
                <OrderCard key={order.id} order={order} mins={elapsed(order.created_at, now).mins} onAdvance={advance} onCancel={cancelOrder} />
              ))}
              {list.length === 0 && <p className="rounded-2xl border border-dashed border-neutral-800 p-6 text-center text-neutral-500">No orders</p>}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
