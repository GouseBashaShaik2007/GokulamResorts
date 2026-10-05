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

// What is still owed on an order that has not been paid. A counter order is
// paid at the counter. A table's or a room's order is paid online when it is
// placed, so only one from before that can be unpaid: our staff collect it.
const stillToPay = (order) =>
  order.table_number || order.room_number
    ? `${inr(order.total_amount)} is still to be paid: please pay our staff.`
    : `Pay ${inr(order.total_amount)} at the counter.`;

// What the guest should do (or expect) at each stage. An order for a room or
// a table is brought there (the kiosk's "room drop" and "dine-in" too);
// anything else is collected at the counter.
function nextStep(order) {
  const room = order.room_number;
  const table = order.table_number;
  switch (order.status) {
    case 'new': {
      const bringing = room ? ` We will bring it to Room ${room}.` : table ? ` We will bring it to Table ${table}.` : '';
      return `The kitchen has your order.${bringing}${order.paid ? '' : ` ${stillToPay(order)}`}`;
    }
    case 'preparing':
      return 'Your order is being cooked now.';
    case 'ready':
      if (room) return `Your order is on its way to Room ${room}.${order.paid ? '' : ` ${stillToPay(order)}`}`;
      return table ? 'Your order is ready to be served.' : 'Your order is ready. Please collect it at the counter.';
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

const Loading = () => <div className="card mx-auto h-80 max-w-lg animate-pulse" role="status" aria-label="Loading your order" />;

/**
 * One order, followed live: where it stands, what was ordered, what was paid.
 * `token`: the order's private token (not its number — those run 1, 2, 3 and
 * could be guessed). `orderContext`: the table, room or counter the page was
 * reached from, with its QR key; null when the page was opened from the link
 * in an SMS, which carries no key — there is then no way back to the menu, so
 * no "Order more", no "Call staff" and no list of this phone's other orders.
 */
function OrderStatus({ token, orderContext = null }) {
  const browseHref = orderContext ? orderingHref(orderContext) : null; // back to the menu
  const table = orderContext?.type === 'table' ? orderContext.tableId : null;
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const lastStatus = useRef(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('No order reference was provided.');
      return;
    }

    let cancelled = false;
    const poll = () => {
      api
        .get(`/food-orders/${token}`)
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
  }, [token]);

  if (loading) return <Loading />;

  if (!order) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <p role="alert" className="text-red-700">{error || 'Order not found.'}</p>
        {browseHref ? (
          <Link href={browseHref} className="btn-primary mt-6 inline-flex">Back to Menu</Link>
        ) : (
          <p className="mt-3 text-sm text-ink-500">Please check the link in your message, or ask our staff.</p>
        )}
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
        {/* Older API servers don't say whether an order is paid. */}
        {order.paid !== undefined && !cancelledOrder && (
          <div className="flex justify-between">
            <dt className="text-ink-400">Payment</dt>
            <dd className={order.paid ? 'font-semibold text-green-800' : 'text-ink-700'}>
              {order.paid ? 'Paid — thank you' : order.table_number || order.room_number ? 'Not paid yet — please pay our staff' : 'To pay at the counter'}
            </dd>
          </div>
        )}
      </dl>

      {browseHref && <Link href={browseHref} className="btn-primary mt-8 inline-flex">Order More</Link>}
      {order.status === 'new' && (
        <CancelOrder
          token={token}
          paidOnline={Boolean(order.paid_online)}
          onCancelled={(refund) => setOrder((o) => ({ ...o, status: 'cancelled', refund_status: refund ? refund.status : o.refund_status }))}
        />
      )}
      {order.status === 'preparing' && <p className="mt-4 text-sm text-ink-400">Need to change it? Please ask our staff — the kitchen has started.</p>}
      {table && orderContext.accessKey && !cancelledOrder && <TableService table={table} accessKey={orderContext.accessKey} className="mt-4" />}

      {/* Everything ordered from this phone in this sitting, with the running total. */}
      {orderContext && (
        <YourOrders cartKey={orderingKey(orderContext)} confirmationHref={(other) => orderHref(orderContext, other)} minOrders={2} className="mt-8" />
      )}
    </div>
  );
}

// The order's token arrives in the address (?order=…) on the pages reached from the menu.
function ConfirmationContent({ orderContext }) {
  const searchParams = useSearchParams();
  return <OrderStatus token={searchParams.get('order')} orderContext={orderContext} />;
}

/**
 * Live status of one food order, on the page a guest lands on after ordering.
 * `orderContext`: the table, room or counter it was ordered from
 * (lib/foodOrders.js) — it leads back to the menu, and a table also gets
 * "Call staff".
 */
export default function OrderConfirmation({ orderContext }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Suspense fallback={<Loading />}>
        <ConfirmationContent orderContext={orderContext} />
      </Suspense>
    </div>
  );
}

/**
 * The same live status for someone who opened the link in their order's SMS
 * (/order/track/<token>), on any phone. The link carries no QR key, so the
 * page only follows the order: there is no way from it to order more.
 */
export function OrderTracking({ token }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <OrderStatus token={token} />
    </div>
  );
}
