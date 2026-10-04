'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api, { TOKEN_KEYS, withAdminAuth } from '../../lib/api';
import useCleaningSocket from '../../lib/useCleaningSocket';
import Chip from '../ui/Chip';
import { addDays, errMsg, inr, todayIST } from '../../lib/bookingUi';
import VegMark from '../ui/VegMark';
import { NEXT_ORDER_STATUS, ORDER_STATUS_LABEL, ORDER_TYPE_LABEL, splitOrderNotes } from '../../lib/foodOrders';
import { useConfirm } from '@/components/ui/Confirm';
import { useToast } from '@/components/ui/Toast';

const STATUS_STYLE = {
  new: 'bg-gold-500/10 text-gold-600',
  preparing: 'bg-blue-400/10 text-blue-700',
  ready: 'bg-green-500/10 text-green-700',
  served: 'bg-navy-700 text-navy-300',
  cancelled: 'bg-red-500/10 text-red-700',
};

const NEXT_LABEL = { new: 'Start', preparing: 'Ready', ready: 'Served' };
const REFRESH_MS = 10000;

// Which days' orders to show, as resort-calendar dates for the API.
const PERIODS = [
  { key: 'today', label: 'Today', range: (today) => ({ from: today, to: today }) },
  { key: 'yesterday', label: 'Yesterday', range: (today) => ({ from: addDays(today, -1), to: addDays(today, -1) }) },
  { key: 'week', label: 'Last 7 days', range: (today) => ({ from: addDays(today, -6), to: today }) },
  { key: 'all', label: 'All time', range: () => ({}) },
];

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'served', label: 'Served' },
  { key: 'cancelled', label: 'Cancelled' },
];

function formatWhen(iso) {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

  const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  let ago;
  if (mins < 1) ago = 'just now';
  else if (mins < 60) ago = `${mins}m ago`;
  else if (mins < 24 * 60) ago = `${Math.floor(mins / 60)}h ago`;
  else ago = `${Math.floor(mins / (24 * 60))}d ago`;

  return `${time} · ${ago}`;
}

function OrderItems({ order }) {
  const { allergy, notes } = splitOrderNotes(order.notes);
  return (
    <>
      <ul className="space-y-0.5">
        {order.items.map((i, idx) => (
          <li key={i.id ?? `${i.item_name}-${idx}`}>
            <span className="font-medium">{i.quantity}×</span>{' '}
            {typeof i.is_veg === 'boolean' && <VegMark veg={i.is_veg} className="mr-1 !h-3.5 !w-3.5 align-[-2px]" />}
            {i.item_name}
            {i.spice_level && <span className="ml-1.5 text-xs uppercase text-orange-700">{i.spice_level}</span>}
            {i.notes && <span className="block text-xs italic text-navy-300">“{i.notes}”</span>}
          </li>
        ))}
      </ul>
      {allergy && <p className="mt-1 inline-block rounded bg-red-500/10 px-1.5 py-0.5 text-xs font-semibold text-red-700">Allergy: {allergy}</p>}
      {notes && <p className="mt-1 text-xs text-navy-300">Note: {notes}</p>}
    </>
  );
}

export default function FoodOrdersManager() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('');
  const [period, setPeriod] = useState('today');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const ask = useConfirm();
  const toast = useToast();

  const newest = useRef(0); // number of the latest request; older answers are dropped
  const load = useCallback(() => {
    const params = { ...(filter ? { status: filter } : {}), ...PERIODS.find((p) => p.key === period).range(todayIST()) };
    newest.current += 1;
    const mine = newest.current;
    api
      .get('/admin/food-orders', { ...withAdminAuth(), params })
      .then((res) => {
        if (mine !== newest.current) return;
        setOrders(res.data.orders);
        setError('');
      })
      .catch((err) => mine === newest.current && setError(errMsg(err, 'Failed to load food orders')));
  }, [filter, period]);

  // Orders arrive while this page is open, so it keeps itself current (and the
  // "x minutes ago" text with it) instead of waiting for a reload.
  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);
  // …and hears about a new or changed order the moment it happens.
  const live = useCleaningSocket(TOKEN_KEYS.admin, load, 'food:update');

  const setStatus = async (order, status, fallback, extra = {}) => {
    setBusyId(order.id);
    try {
      await api.patch(`/admin/food-orders/${order.id}/status`, { status, ...extra }, withAdminAuth());
      toast(`Order #${order.id}: ${ORDER_STATUS_LABEL[status] || status}`, { tone: 'info' });
      load();
    } catch (err) {
      toast(errMsg(err, fallback), { tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const advance = (order) => {
    const next = NEXT_ORDER_STATUS[order.status];
    if (next) setStatus(order, next, 'Could not update that order.');
  };

  // Like a booking, an order is only cancelled with a reason, kept in the activity log.
  const cancel = async (order) => {
    const reason = await ask({
      title: `Cancel order #${order.id}?`,
      body: 'It leaves the kitchen display, and the guest sees it as cancelled.',
      confirmLabel: 'Cancel order',
      cancelLabel: 'Keep order',
      danger: true,
      input: {
        label: 'Reason',
        placeholder: 'e.g. Guest changed their mind, dish ran out',
        validate: (v) => (v.trim().length < 3 ? 'Say why the order is being cancelled.' : ''),
      },
    });
    if (reason) setStatus(order, 'cancelled', 'Could not cancel that order.', { reason: reason.trim() });
  };

  // What the listed orders are worth; cancelled ones bring in nothing.
  const kept = orders.filter((o) => o.status !== 'cancelled');
  const revenue = kept.reduce((sum, o) => sum + Number(o.total_amount), 0);

  return (
    <div className="card overflow-x-auto p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Period">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            aria-pressed={period === p.key}
            className={`rounded-lg px-3 py-1.5 text-sm ${period === p.key ? 'bg-navy-700 font-medium text-gold-600' : 'text-navy-300 hover:text-navy-100'}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-navy-400" aria-live="polite">
          <span className="font-semibold text-navy-50">{orders.length} order{orders.length === 1 ? '' : 's'} · {inr(revenue)}</span>
          {kept.length !== orders.length && ` (excluding ${orders.length - kept.length} cancelled)`} · {live ? 'updates live' : `updates every ${REFRESH_MS / 1000} seconds`}
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <Chip key={f.key} tone="solid" size="xs" pressed={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}</Chip>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}

      <table className="mt-4 w-full min-w-[820px] text-left text-sm">
        <caption className="sr-only">Food orders, newest first</caption>
        <thead>
          <tr className="border-b border-navy-700 text-navy-400">
            <th scope="col" className="py-2 pr-4">#</th>
            <th scope="col" className="py-2 pr-4">Source</th>
            <th scope="col" className="py-2 pr-4">Placed</th>
            <th scope="col" className="py-2 pr-4">Items</th>
            <th scope="col" className="py-2 pr-4">Amount</th>
            <th scope="col" className="py-2 pr-4">Status</th>
            <th scope="col" className="py-2 pr-4">Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-navy-800 align-top text-navy-100">
              <td className="py-2 pr-4">{o.id}</td>
              <td className="py-2 pr-4">
                {o.table_number ? `Table ${o.table_number}` : o.customer_name || ORDER_TYPE_LABEL.kiosk}
                {!o.table_number && o.customer_name && <span className="block text-xs text-navy-400">{ORDER_TYPE_LABEL.kiosk}</span>}
              </td>
              <td className="py-2 pr-4 text-navy-300">{formatWhen(o.created_at)}</td>
              <td className="py-2 pr-4"><OrderItems order={o} /></td>
              <td className="py-2 pr-4">{inr(o.total_amount)}</td>
              <td className="py-2 pr-4">
                <span className={`rounded-full px-2 py-1 text-xs capitalize ${STATUS_STYLE[o.status] || ''}`}>
                  {o.status}
                </span>
              </td>
              <td className="py-2 pr-4">
                <div className="flex gap-2">
                  {NEXT_ORDER_STATUS[o.status] && (
                    <button
                      disabled={busyId === o.id}
                      onClick={() => advance(o)}
                      className="rounded-lg border border-gold-500/50 px-2.5 py-1 text-xs text-gold-600 hover:bg-gold-500/10 disabled:opacity-50"
                    >
                      {NEXT_LABEL[o.status]}
                    </button>
                  )}
                  {NEXT_ORDER_STATUS[o.status] && (
                    <button
                      disabled={busyId === o.id}
                      onClick={() => cancel(o)}
                      className="rounded-lg border border-red-500/50 px-2.5 py-1 text-xs text-red-700 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && <p className="mt-4 text-navy-400">No food orders here.</p>}
    </div>
  );
}
