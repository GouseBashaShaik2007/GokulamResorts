'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '../lib/api';

const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

const STATUS_LABEL = {
  new: 'Order Received',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  cancelled: 'Cancelled',
};

// Nothing changes after these, so the page stops asking.
const FINAL_STATUSES = ['served', 'cancelled'];

// The stages an order moves through, in order.
const STEPS = [
  { key: 'new', label: 'Received' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'served', label: 'Served' },
];

// What the guest should do (or expect) at each stage.
function nextStep(order) {
  const where = order.table_number ? 'at your table' : 'at the counter';
  switch (order.status) {
    case 'new':
      return `The kitchen has your order. Pay ${rupees(order.total_amount)} ${where}.`;
    case 'preparing':
      return 'Your order is being cooked now.';
    case 'ready':
      return order.table_number ? 'Your order is ready to be served.' : 'Your order is ready. Please collect it at the counter.';
    case 'served':
      return 'Enjoy your meal!';
    case 'cancelled':
      return 'This order was cancelled. Please speak to our staff if that is unexpected.';
    default:
      return '';
  }
}

function Steps({ status }) {
  const at = STEPS.findIndex((s) => s.key === status);
  if (at === -1) return null;
  return (
    <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Order progress">
      {STEPS.map((s, i) => (
        <li key={s.key} className="text-center" aria-current={i === at ? 'step' : undefined}>
          <span className={`mx-auto block h-1.5 rounded-full ${i <= at ? 'bg-ocean-500' : 'bg-navy-700'}`} />
          <span className={`mt-2 block text-xs ${i === at ? 'font-semibold text-navy-50' : 'text-navy-400'}`}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

function ConfirmationContent({ browseHref }) {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const lastStatus = useRef(null);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setError('No order reference was provided.');
      return;
    }

    let cancelled = false;
    const poll = () => {
      api
        .get(`/food-orders/${orderId}`)
        .then((res) => {
          if (cancelled) return;
          const next = res.data.order;
          // A short buzz when the food becomes ready (phones that support it).
          if (lastStatus.current && lastStatus.current !== 'ready' && next.status === 'ready') navigator.vibrate?.(300);
          lastStatus.current = next.status;
          setOrder(next);
          if (FINAL_STATUSES.includes(next.status)) clearInterval(interval);
        })
        .catch(() => {
          if (!cancelled) setError('We could not find that order.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    poll();
    // Skip the request while the tab is in the background.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') poll();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [orderId]);

  if (loading) {
    return <div className="card mx-auto h-80 max-w-lg animate-pulse" role="status" aria-label="Loading your order" />;
  }

  if (error || !order) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <p role="alert" className="text-red-700">{error || 'Order not found.'}</p>
        <Link href={browseHref} className="btn-gold mt-6 inline-flex">Back to Menu</Link>
      </div>
    );
  }

  const cancelledOrder = order.status === 'cancelled';

  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <p className="eyebrow">
        Order #{order.id}
        {order.table_number ? ` · Table ${order.table_number}` : ''}
      </p>
      <div aria-live="polite">
        <h1 className={`section-heading mt-2 ${cancelledOrder ? 'text-red-700' : ''}`}>{STATUS_LABEL[order.status] || order.status}</h1>
        <p className="mt-2 text-navy-300">{nextStep(order)}</p>
      </div>
      {!FINAL_STATUSES.includes(order.status) && (
        <p className="mt-1 text-xs text-navy-400">This page updates on its own.</p>
      )}

      <Steps status={order.status} />

      <dl className="mt-6 space-y-3 rounded-xl border border-navy-700 bg-navy-800 p-5 text-left text-sm">
        <div className="space-y-1">
          {order.items.map((item, idx) => (
            <div key={`${item.item_name}-${idx}`} className="flex justify-between gap-3 text-navy-200">
              <span>{item.quantity} × {item.item_name}</span>
              <span>{rupees(item.line_total)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t border-navy-700 pt-3">
          <dt className="text-navy-400">Total</dt>
          <dd className="price">{rupees(order.total_amount)}</dd>
        </div>
      </dl>

      <Link href={browseHref} className="btn-gold mt-8 inline-flex">Order More</Link>
    </div>
  );
}

export default function OrderConfirmation({ browseHref }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <Suspense fallback={<div className="card mx-auto h-80 max-w-lg animate-pulse" role="status" aria-label="Loading your order" />}>
        <ConfirmationContent browseHref={browseHref} />
      </Suspense>
    </div>
  );
}
