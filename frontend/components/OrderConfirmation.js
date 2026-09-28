'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '../lib/api';

const STATUS_LABEL = {
  new: 'Order Received',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  cancelled: 'Cancelled',
};

const STATUS_ICON = {
  new: '🧾',
  preparing: '👨‍🍳',
  ready: '🔔',
  served: '✅',
  cancelled: '✕',
};

function ConfirmationContent({ browseHref }) {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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
          if (!cancelled) setOrder(res.data.order);
        })
        .catch(() => {
          if (!cancelled) setError('We could not find that order.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [orderId]);

  if (loading) {
    return <p className="text-center text-navy-300">Loading your order...</p>;
  }

  if (error || !order) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <p className="text-red-300">{error || 'Order not found.'}</p>
        <Link href={browseHref} className="btn-gold mt-6 inline-flex">Back to Menu</Link>
      </div>
    );
  }

  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/10 text-3xl">
        {STATUS_ICON[order.status] || '🧾'}
      </div>
      <h1 className="section-heading">{STATUS_LABEL[order.status] || order.status}</h1>
      <p className="mt-2 text-navy-300">
        {order.status === 'served'
          ? 'Enjoy your meal!'
          : order.status === 'cancelled'
          ? 'This order was cancelled.'
          : "We'll update this page automatically as your order moves through the kitchen."}
      </p>

      <dl className="mt-6 space-y-3 rounded-xl border border-navy-700 bg-navy-800 p-5 text-left text-sm">
        <div className="flex justify-between"><dt className="text-navy-400">Order ID</dt><dd className="text-navy-50">#{order.id}</dd></div>
        {order.table_number && (
          <div className="flex justify-between"><dt className="text-navy-400">Table</dt><dd className="text-navy-50">{order.table_number}</dd></div>
        )}
        <div className="space-y-1 border-t border-navy-700 pt-3">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-navy-200">
              <span>{item.item_name} × {item.quantity}</span>
              <span>₹{Number(item.line_total).toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t border-navy-700 pt-3">
          <dt className="text-navy-400">Total</dt>
          <dd className="font-semibold text-gold-400">₹{Number(order.total_amount).toLocaleString('en-IN')}</dd>
        </div>
        <div className="flex justify-between"><dt className="text-navy-400">Status</dt><dd className="capitalize text-navy-50">{order.status}</dd></div>
      </dl>

      <Link href={browseHref} className="btn-gold mt-8 inline-flex">Order More</Link>
    </div>
  );
}

export default function OrderConfirmation({ browseHref }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <Suspense fallback={<p className="text-center text-navy-300">Loading...</p>}>
        <ConfirmationContent browseHref={browseHref} />
      </Suspense>
    </div>
  );
}
