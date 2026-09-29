'use client';

import { useCallback, useEffect, useState } from 'react';
import api, { withAdminAuth } from '../../lib/api';

const STATUS_STYLE = {
  new: 'bg-gold-500/10 text-gold-400',
  preparing: 'bg-blue-400/10 text-blue-300',
  ready: 'bg-green-500/10 text-green-300',
  served: 'bg-navy-700 text-navy-300',
  cancelled: 'bg-red-500/10 text-red-300',
};

const NEXT_STATUS = { new: 'preparing', preparing: 'ready', ready: 'served' };
const NEXT_LABEL = { new: 'Start', preparing: 'Ready', ready: 'Served' };

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

export default function FoodOrdersManager() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    const params = filter ? { status: filter } : {};
    api
      .get('/admin/food-orders', { ...withAdminAuth(), params })
      .then((res) => setOrders(res.data.orders))
      .catch((err) => setError(err?.response?.data?.message || 'Failed to load food orders'));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const advance = async (order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setBusyId(order.id);
    setError('');
    try {
      await api.patch(`/admin/food-orders/${order.id}/status`, { status: next }, withAdminAuth());
      load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not update that order.');
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (order) => {
    if (!confirm(`Cancel order #${order.id}?`)) return;
    setBusyId(order.id);
    try {
      await api.patch(`/admin/food-orders/${order.id}/status`, { status: 'cancelled' }, withAdminAuth());
      load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not cancel that order.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card overflow-x-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-bold text-navy-50">Food Orders</h2>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs ${filter === f.key ? 'bg-gold-500 text-navy-950' : 'bg-navy-800 text-navy-200'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}

      <table className="mt-4 w-full min-w-[820px] text-left text-sm">
        <thead>
          <tr className="border-b border-navy-700 text-navy-400">
            <th className="py-2 pr-4">#</th>
            <th className="py-2 pr-4">Source</th>
            <th className="py-2 pr-4">Placed</th>
            <th className="py-2 pr-4">Items</th>
            <th className="py-2 pr-4">Amount</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-navy-800 text-navy-100">
              <td className="py-2 pr-4">{o.id}</td>
              <td className="py-2 pr-4">{o.table_number ? `Table ${o.table_number}` : o.customer_name || 'Kiosk'}</td>
              <td className="py-2 pr-4 text-navy-300">{formatWhen(o.created_at)}</td>
              <td className="py-2 pr-4">
                {o.items.map((i) => `${i.item_name} ×${i.quantity}`).join(', ')}
              </td>
              <td className="py-2 pr-4">₹{Number(o.total_amount).toLocaleString('en-IN')}</td>
              <td className="py-2 pr-4">
                <span className={`rounded-full px-2 py-1 text-xs capitalize ${STATUS_STYLE[o.status] || ''}`}>
                  {o.status}
                </span>
              </td>
              <td className="py-2 pr-4">
                <div className="flex gap-2">
                  {NEXT_STATUS[o.status] && (
                    <button
                      disabled={busyId === o.id}
                      onClick={() => advance(o)}
                      className="rounded-lg border border-gold-500/50 px-2.5 py-1 text-xs text-gold-400 hover:bg-gold-500/10 disabled:opacity-50"
                    >
                      {NEXT_LABEL[o.status]}
                    </button>
                  )}
                  {['new', 'preparing', 'ready'].includes(o.status) && (
                    <button
                      disabled={busyId === o.id}
                      onClick={() => cancel(o)}
                      className="rounded-lg border border-red-500/50 px-2.5 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
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
