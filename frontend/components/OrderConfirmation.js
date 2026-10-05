'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '../lib/api';
import { inr } from '../lib/bookingUi';
import { FINAL_ORDER_STATUSES, ORDER_STAGES, guestStatusLabel, orderHref, orderingHref, orderingKey } from '../lib/foodOrders';
import YourOrders from './ordering/YourOrders';
import TableService from './site/TableService';

// The page's heading for each status.
const heading = (order) => (order.status === 'new' ? 'Order Received' : stageLabel(order.status, order));

const stageLabel = (stage, order) => guestStatusLabel(order, stage);

// Where the money for a cancelled order that had been paid online stands.
const REFUND_TEXT = {
  pending: 'Your payment is being refunded to the way you paid.',
  processed: 'Your payment has been refunded to the way you paid.',
  failed: 'Your payment could not be refunded automatically. Please speak to our staff: they will return it.',
};

// What the guest should do (or expect) at each stage.
function nextStep(order) {
  const room = order.room_number;
  const where = order.table_number ? 'at your table' : 'at the counter';
  switch (order.status) {
    case 'new':
      if (order.paid) return room ? `The kitchen has your order. We will bring it to Room ${room}.` : 'The kitchen has your order.';
      return room
        ? `The kitchen has your order. Please have ${inr(order.total_amount)} ready in cash for when it arrives at Room ${room}.`
        : `The kitchen has your order. Pay ${inr(order.total_amount)} ${where}.`;
    case 'preparing':
      return 'Your order is being cooked now.';
    case 'ready':
      if (room) return order.paid ? `Your order is on its way to Room ${room}.` : `Your order is on its way to Room ${room}. Please have ${inr(order.total_amount)} ready in cash.`;
      return order.table_number ? 'Your order is ready to be served.' : 'Your order is ready. Please collect it at the counter.';
    case 'served':
      return 'Enjoy your meal!';
    case 'cancelled':
      if (order.refund_status) return `This order was cancelled. ${REFUND_TEXT[order.refund_status] || ''}`;
      return 'This order was cancelled. Please speak to our staff if that is unexpected.';
    default:
      return '';
  }
}

function Steps({ order }) {
  const at = ORDER_STAGES.indexOf(order.status);
  if (at === -1) return null;
  return (
    <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Order progress">
      {ORDER_STAGES.map((stage, i) => (
        <li key={stage} className="text-center" aria-current={i === at ? 'step' : undefined}>
          <span className={`mx-auto block h-1.5 rounded-full ${i <= at ? 'bg-ocean-500' : 'bg-sand-300'}`} />
          <span className={`mt-2 block text-xs ${i === at ? 'font-semibold text-ink-900' : 'text-ink-400'}`}>{stageLabel(stage, order)}</span>
        </li>
      ))}
    </ol>
  );
}

// "Cancel this order", offered only while the kitchen hasn't started on it.
// Two taps (ask, then confirm) so a slip of the thumb doesn't cancel dinner.
// `paidOnline`: the guest has already paid, so cancelling refunds them;
// `onCancelled(refund)` is given the refund ({ status, amount }) or null.
function CancelOrder({ token, paidOnline, onCancelled }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cancel = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/food-orders/${token}/cancel`);
      onCancelled(res.data?.refund || null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not cancel the order. Please ask our staff.');
      setAsking(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 text-sm">
      {asking ? (
        <p className="flex flex-wrap items-center justify-center gap-3">
          <span className="text-ink-700">Cancel the whole order?{paidOnline && ' Your payment will be refunded.'}</span>
          <button type="button" disabled={busy} onClick={cancel} className="rounded-full bg-red-700 px-4 py-1.5 font-semibold text-white disabled:opacity-60">
            {busy ? 'Cancelling…' : 'Yes, cancel it'}
          </button>
          <button type="button" disabled={busy} onClick={() => setAsking(false)} className="font-semibold text-ocean-600 underline">Keep it</button>
        </p>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className="text-ink-500 underline underline-offset-2 hover:text-red-700">
          Cancel this order
        </button>
      )}
      {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    </div>
  );
}

function ConfirmationContent({ orderContext }) {
  const browseHref = orderingHref(orderContext); // back to the menu
  const table = orderContext.type === 'table' ? orderContext.tableId : null;
  const { accessKey } = orderContext;
  const searchParams = useSearchParams();
  // The order's private token (not its number — those run 1, 2, 3 and could be guessed).
  const orderId = searchParams.get('order');
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
          setError('');
          setOrder(next);
          if (FINAL_ORDER_STATUSES.includes(next.status)) clearInterval(interval); // nothing changes after these
        })
        .catch((err) => {
          if (cancelled) return;
          // Only "no such order" ends the page; a dropped connection just waits for the next try.
          if (err?.response) {
            setError('We could not find that order.');
            clearInterval(interval);
          } else if (!lastStatus.current) {
            setError('We could not reach the restaurant. Please check your connection.');
          }
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

  if (!order) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <p role="alert" className="text-red-700">{error || 'Order not found.'}</p>
        <Link href={browseHref} className="btn-primary mt-6 inline-flex">Back to Menu</Link>
      </div>
    );
  }

  const cancelledOrder = order.status === 'cancelled';

  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <p className="eyebrow">
        Order #{order.id}
        {order.table_number ? ` · Table ${order.table_number}` : ''}
        {order.room_number ? ` · Room ${order.room_number}` : ''}
      </p>
      <div aria-live="polite">
        <h1 className={`section-heading mt-2 ${cancelledOrder ? 'text-red-700' : ''}`}>{heading(order)}</h1>
        <p className="mt-2 text-ink-500">{nextStep(order)}</p>
      </div>
      {!FINAL_ORDER_STATUSES.includes(order.status) && (
        <p className="mt-1 text-xs text-ink-400">This page updates on its own.</p>
      )}

      <Steps order={order} />

      <dl className="mt-6 space-y-3 rounded-xl border border-sand-300 bg-sand-200 p-5 text-left text-sm">
        <div className="space-y-1">
          {order.items.map((item, idx) => (
            <div key={item.id ?? `${item.item_name}-${idx}`} className="flex justify-between gap-3 text-ink-700">
              <span>{item.quantity} × {item.item_name}</span>
              <span>{inr(item.line_total)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t border-sand-300 pt-3">
          <dt className="text-ink-400">Total</dt>
          <dd className="price">{inr(order.total_amount)}</dd>
        </div>
        {/* Shown once the counter has recorded the payment; older API servers don't say. */}
        {order.paid !== undefined && !cancelledOrder && (
          <div className="flex justify-between">
            <dt className="text-ink-400">Payment</dt>
            <dd className={order.paid ? 'font-semibold text-green-800' : 'text-ink-700'}>
              {order.paid ? 'Paid — thank you' : order.room_number ? 'Cash, when it arrives' : `To pay ${order.table_number ? 'at your table' : 'at the counter'}`}
            </dd>
          </div>
        )}
      </dl>

      <Link href={browseHref} className="btn-primary mt-8 inline-flex">Order More</Link>
      {order.status === 'new' && (
        <CancelOrder
          token={orderId}
          paidOnline={Boolean(order.paid_online)}
          onCancelled={(refund) => setOrder((o) => ({ ...o, status: 'cancelled', refund_status: refund ? refund.status : o.refund_status }))}
        />
      )}
      {order.status === 'preparing' && <p className="mt-4 text-sm text-ink-400">Need to change it? Please ask our staff — the kitchen has started.</p>}
      {table && accessKey && !cancelledOrder && <TableService table={table} accessKey={accessKey} className="mt-4" />}

      {/* Everything ordered from this phone in this sitting, with the running total. */}
      <YourOrders cartKey={orderingKey(orderContext)} confirmationHref={(token) => orderHref(orderContext, token)} minOrders={2} className="mt-8" />
    </div>
  );
}

/**
 * Live status of one food order. `orderContext`: the table, room or counter it
 * was ordered from (lib/foodOrders.js) — it leads back to the menu, and a table
 * also gets "Call staff" / "Request the bill".
 */
export default function OrderConfirmation({ orderContext }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Suspense fallback={<div className="card mx-auto h-80 max-w-lg animate-pulse" role="status" aria-label="Loading your order" />}>
        <ConfirmationContent orderContext={orderContext} />
      </Suspense>
    </div>
  );
}
