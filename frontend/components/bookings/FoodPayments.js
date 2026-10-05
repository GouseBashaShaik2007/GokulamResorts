'use client';

import { inr } from '../../lib/bookingUi';
import { ORDER_STATUS_LABEL, orderTitle, paidOnline } from '../../lib/foodOrders';
import { PAYMENT_LABEL, PayButtons, useOrderPayments } from './orderPayments';

const time = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
const day = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();

const dishes = (o) => o.items.map((i) => `${i.quantity}× ${i.item_name}`).join(', ');

function OrderLine({ order, children }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sand-300 bg-sand-200 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-ink-900">
          {/* What the order is and where it goes ("Table 4", "Counter", "Kiosk · Pickup"), then its number. */}
          <span className="mr-2 font-serif text-xl font-bold">{orderTitle(order)}</span>
          <span className="text-sm text-ink-500">
            #{order.id}
            {order.customer_name ? ` · ${order.customer_name}` : ''} · {isToday(order.created_at) ? time(order.created_at) : `${day(order.created_at)}, ${time(order.created_at)}`} · {ORDER_STATUS_LABEL[order.status] || order.status}
          </span>
        </p>
        <p className="mt-0.5 truncate text-sm text-ink-500" title={dishes(order)}>{dishes(order)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <span className="price text-lg">{inr(order.total_amount)}</span>
        {children}
      </div>
    </li>
  );
}

/**
 * The front desk's Food orders tab: who still has to pay, and what has been
 * paid today. Counter orders are paid for at the counter and recorded here.
 * Table, room and kiosk orders arrive already paid online and show as part of
 * the day's takings. (An order from before tables paid online can still be
 * recorded here; an unpaid room order from then is paid in cash at the door.)
 *
 * `orders`: from GET /desk/food-orders (today's, plus older unpaid ones);
 * null while loading. `auth`: from deskAs(mode). `mode`: 'admin' lets a
 * manager undo a payment. `onChanged()`: reload.
 */
export default function FoodPayments({ orders, error, auth, mode, onChanged }) {
  const { pay, undo } = useOrderPayments({ auth, onChanged });

  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!orders) return <div className="card h-48 animate-pulse" role="status" aria-label="Loading food orders" />;

  const unpaid = orders.filter((o) => !o.paid_at);
  const paid = orders.filter((o) => o.paid_at);
  const sum = (list) => list.reduce((total, o) => total + Number(o.total_amount), 0);

  return (
    <div className="space-y-8">
      <section aria-labelledby="food-unpaid">
        <h3 id="food-unpaid" className="text-sm font-semibold uppercase tracking-wider text-gold-600">
          To be paid <span className="text-ink-400">({unpaid.length})</span>
        </h3>
        <p className="mb-3 mt-0.5 text-sm text-ink-500">
          {unpaid.length ? `${inr(sum(unpaid))} to collect. Take the payment, then tap how it was paid.` : 'Every order has been paid.'}
        </p>
        <ul className="space-y-2">
          {unpaid.map((o) => (
            <OrderLine key={o.id} order={o}>
              <PayButtons order={o} onPay={pay} />
            </OrderLine>
          ))}
        </ul>
      </section>

      <section aria-labelledby="food-paid">
        <h3 id="food-paid" className="text-sm font-semibold uppercase tracking-wider text-ink-500">
          Paid today <span className="text-ink-400">({paid.length})</span>
        </h3>
        <p className="mb-3 mt-0.5 text-sm text-ink-500">
          {paid.length
            ? `${inr(sum(paid))} taken: ${['cash', 'upi', 'card', 'online']
                .map((m) => [m, sum(paid.filter((o) => o.payment_method === m))])
                .filter(([, amount]) => amount > 0)
                .map(([m, amount]) => `${PAYMENT_LABEL[m]} ${inr(amount)}`)
                .join(' · ')}`
            : 'Nothing has been paid yet today.'}
        </p>
        <ul className="space-y-2">
          {paid.map((o) => (
            <OrderLine key={o.id} order={o}>
              <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-800">
                Paid · {PAYMENT_LABEL[o.payment_method] || o.payment_method} · {time(o.paid_at)}
                {o.payment_reference ? ` · ${o.payment_reference}` : ''}
              </span>
              {/* An online payment is only given back by cancelling the order. */}
              {mode === 'admin' && !paidOnline(o) && (
                <button type="button" onClick={() => undo(o)} className="text-xs text-ink-500 underline underline-offset-2 hover:text-red-700">
                  Undo
                </button>
              )}
            </OrderLine>
          ))}
        </ul>
      </section>
    </div>
  );
}
