'use client';

import api from '../../lib/api';
import { errMsg, inr } from '../../lib/bookingUi';
import { useConfirm } from '../ui/Confirm';
import { useToast } from '../ui/Toast';

// How a food order can be paid at the counter. Keep in step with the API
// (backend/src/routes/desk.routes.js).
export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
];
// 'online' is never chosen here: it is what is recorded when a customer pays through the
// payment gateway — on the kiosk's screen, or on their own phone at a table or in a hotel room.
export const PAYMENT_LABEL = { ...Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label])), online: 'Online' };

/** How a refund of an online payment stands, for an order cancelled after it was paid. */
export const REFUND_LABEL = { pending: 'Refund on its way', processed: 'Refunded', failed: 'Refund failed — refund by hand' };

/**
 * Recording that a food order has been paid — used by the front desk's Food
 * orders tab and the manager's Food Orders page.
 *
 * `auth`: from deskAs(mode), so the payment is recorded against the right
 * person. `onChanged()`: reload the list.
 * Returns { pay(order, method), undo(order) }. Undo is the manager's only.
 */
export function useOrderPayments({ auth, onChanged }) {
  const ask = useConfirm();
  const toast = useToast();

  const pay = async (order, method) => {
    const label = PAYMENT_LABEL[method];
    const title = `Order #${order.id}: ${inr(order.total_amount)} paid ${method === 'cash' ? 'in cash' : `by ${label}`}?`;
    // Cash is a yes or no. UPI and card can carry a reference, if there is one.
    const answer = await ask(
      method === 'cash'
        ? { title, confirmLabel: 'Mark paid' }
        : {
            title,
            confirmLabel: 'Mark paid',
            input: {
              label: 'Reference (optional)',
              placeholder: method === 'upi' ? 'UTR, or its last digits' : 'Card slip number',
              hint: 'Leave empty if there is none.',
              validate: (v) => (v.length > 100 ? 'Keep the reference under 100 characters.' : ''),
            },
          }
    );
    if (answer === false || answer === null) return;
    try {
      await api.post(`/desk/food-orders/${order.id}/pay`, { method, reference: typeof answer === 'string' ? answer.trim() : undefined }, auth());
      toast(`Order #${order.id} marked paid (${label}).`);
    } catch (err) {
      toast(errMsg(err, 'Could not mark that order paid.'), { tone: 'error' });
    }
    onChanged();
  };

  const undo = async (order) => {
    const reason = await ask({
      title: `Undo the payment on order #${order.id}?`,
      body: 'The order goes back to unpaid. Use this only when it was marked paid by mistake.',
      confirmLabel: 'Undo payment',
      cancelLabel: 'Leave it',
      danger: true,
      input: { label: 'Reason', placeholder: 'e.g. Wrong order ticked', validate: (v) => (v.trim().length < 3 ? 'Say why the payment is being undone.' : '') },
    });
    if (!reason) return;
    try {
      await api.post(`/desk/food-orders/${order.id}/unpay`, { reason: reason.trim() }, auth());
      toast(`Order #${order.id} is unpaid again.`, { tone: 'info' });
    } catch (err) {
      toast(errMsg(err, 'Could not undo that payment.'), { tone: 'error' });
    }
    onChanged();
  };

  return { pay, undo };
}

/** Cash · UPI · Card, for one unpaid order. `size`: 'sm' in a table row, 'md' on the front desk. */
export function PayButtons({ order, onPay, size = 'md' }) {
  const shape = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm';
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={`Mark order ${order.id} paid`}>
      {PAYMENT_METHODS.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => onPay(order, m.value)}
          className={`rounded-lg border border-green-700/50 font-semibold text-green-800 hover:bg-green-500/10 ${shape}`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
