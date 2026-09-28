'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api, { withKitchenAuth } from '../../lib/api';

const TOKEN_KEY = 'gokulam_kitchen_token';
const POLL_MS = 5000;

const STATUS_FLOW = { new: 'preparing', preparing: 'ready', ready: 'served' };
const STATUS_LABEL = { new: 'New', preparing: 'Preparing', ready: 'Ready', served: 'Served', cancelled: 'Cancelled' };
const STATUS_ACTION_LABEL = { new: 'Start Preparing', preparing: 'Mark Ready', ready: 'Mark Served' };
const STATUS_COLOR = {
  new: 'border-gold-500/60 bg-gold-500/5',
  preparing: 'border-blue-400/50 bg-blue-400/5',
  ready: 'border-green-500/60 bg-green-500/5',
};

function playChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    [880, 1320].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.18 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.18);
      osc.stop(ctx.currentTime + idx * 0.18 + 0.3);
    });
  } catch {
    // Web Audio unsupported/blocked — silently skip the chime.
  }
}

const UNATTENDED_MINUTES = 10;

function minutesAgo(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

function timeAgo(dateStr) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

function LoginForm({ onLoggedIn }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/kitchen/login', { password });
      window.localStorage.setItem(TOKEN_KEY, res.data.token);
      onLoggedIn();
    } catch (err) {
      setError(err?.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-24 sm:px-6">
      <div className="card p-8">
        <p className="eyebrow">Kitchen Dashboard</p>
        <h1 className="mt-2 font-serif text-2xl font-bold text-navy-50">Sign in</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="password">Kitchen Password</label>
            <input
              id="password" type="password" required className="input-field"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={loading} className="btn-gold w-full disabled:opacity-60">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

function OrderCard({ order, onAdvance, onCancel }) {
  const unattended = order.status === 'new' && minutesAgo(order.created_at) >= UNATTENDED_MINUTES;

  return (
    <div
      className={`card border p-5 ${unattended ? 'animate-pulse border-red-500' : STATUS_COLOR[order.status] || ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-serif text-lg font-bold text-navy-50">
            {order.table_number ? `Table ${order.table_number}` : order.customer_name || 'Walk-in'}
          </p>
          <p className={`text-xs ${unattended ? 'font-semibold text-red-300' : 'text-navy-400'}`}>
            Order #{order.id} · {timeAgo(order.created_at)}
            {unattended && ' · waiting!'}
          </p>
        </div>
        <span className="rounded-full bg-navy-800 px-2.5 py-1 text-xs capitalize text-navy-200">
          {STATUS_LABEL[order.status]}
        </span>
      </div>

      <ul className="mt-4 space-y-1 text-sm text-navy-200">
        {order.items.map((item, idx) => (
          <li key={idx} className="flex justify-between">
            <span>{item.item_name}</span>
            <span className="text-navy-400">× {item.quantity}</span>
          </li>
        ))}
      </ul>

      {order.notes && <p className="mt-3 text-xs italic text-navy-400">Note: {order.notes}</p>}

      <div className="mt-5 flex gap-2">
        {STATUS_FLOW[order.status] && (
          <button onClick={() => onAdvance(order)} className="btn-gold flex-1 px-4 py-2 text-sm">
            {STATUS_ACTION_LABEL[order.status]}
          </button>
        )}
        <button
          onClick={() => onCancel(order)}
          className="rounded-lg border border-red-500/50 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function KitchenPage() {
  const [checked, setChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [orders, setOrders] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [error, setError] = useState('');
  const lastMaxOrderId = useRef(0);
  const soundEnabledRef = useRef(false);

  useEffect(() => {
    setLoggedIn(!!window.localStorage.getItem(TOKEN_KEY));
    setChecked(true);
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const res = await api.get('/kitchen/orders', withKitchenAuth());
      const fetched = res.data.orders;
      const maxId = fetched.reduce((max, o) => Math.max(max, o.id), 0);
      if (lastMaxOrderId.current > 0 && maxId > lastMaxOrderId.current && soundEnabledRef.current) {
        playChime();
      }
      lastMaxOrderId.current = Math.max(lastMaxOrderId.current, maxId);
      setOrders(fetched);
      setError('');
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        window.localStorage.removeItem(TOKEN_KEY);
        setLoggedIn(false);
      } else {
        setError('Could not reach the kitchen order feed.');
      }
    }
  }, []);

  useEffect(() => {
    if (!loggedIn) return undefined;
    loadOrders();
    const interval = setInterval(loadOrders, POLL_MS);
    return () => clearInterval(interval);
  }, [loggedIn, loadOrders]);

  const enableSound = () => {
    playChime();
    soundEnabledRef.current = true;
    setSoundEnabled(true);
  };

  const updateStatus = async (order, status) => {
    try {
      await api.patch(`/kitchen/orders/${order.id}/status`, { status }, withKitchenAuth());
      loadOrders();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not update that order.');
    }
  };

  if (!checked) return null;

  if (!loggedIn) {
    return <LoginForm onLoggedIn={() => setLoggedIn(true)} />;
  }

  const grouped = ['new', 'preparing', 'ready'].map((status) => ({
    status,
    orders: orders.filter((o) => o.status === status),
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Kitchen</p>
          <h1 className="section-heading mt-1">Live Orders</h1>
        </div>
        {!soundEnabled && (
          <button onClick={enableSound} className="btn-gold px-4 py-2 text-sm">
            🔔 Enable Sound Alerts
          </button>
        )}
        <button
          onClick={() => {
            window.localStorage.removeItem(TOKEN_KEY);
            setLoggedIn(false);
          }}
          className="btn-outline px-4 py-2 text-sm"
        >
          Log Out
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-300">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        {grouped.map(({ status, orders: statusOrders }) => (
          <div key={status}>
            <h2 className="mb-3 font-serif text-lg font-bold text-navy-50">
              {STATUS_LABEL[status]} <span className="text-sm font-normal text-navy-400">({statusOrders.length})</span>
            </h2>
            <div className="space-y-4">
              {statusOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onAdvance={(o) => updateStatus(o, STATUS_FLOW[o.status])}
                  onCancel={(o) => {
                    if (confirm(`Cancel order #${o.id}?`)) updateStatus(o, 'cancelled');
                  }}
                />
              ))}
              {statusOrders.length === 0 && <p className="text-sm text-navy-500">No orders</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
