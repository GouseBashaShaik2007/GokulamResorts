'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { errMsg, inr } from '@/lib/bookingUi';
import { ORDER_TYPE_FOR_API, composeOrderNotes, orderHref } from '@/lib/foodOrders';
import { rememberOrder } from '@/lib/myOrders';
import useOrderCheckout from '@/lib/useOrderCheckout';

const UNCONFIRMED =
  'We could not confirm your order from this phone. If your payment went through and the order was not placed, the money is returned to you automatically. Please call the restaurant.';

/**
 * The guest's details and the act of placing the order.
 * `orderContext`: which QR code opened the page (lib/foodOrders.js) — it
 * carries that code's key. `cartKey` names this ordering context on the
 * device (see lib/cart.js).
 *
 * A table or the counter pays afterwards, in person, so the order is simply
 * placed. A hotel room chooses: `payWith` 'online' (pay now, and only then
 * the order exists) or 'cash' (placed at once, paid at the door).
 *
 * Returns { form, setField, payWith, setPayWith, status, error, submit, testPayment }.
 * status: 'idle' | 'placing' | 'paying' (the payment window is open or being
 * checked) | 'error'. `testPayment` is { pay, cancel } while the API's test
 * mode is standing in for the payment window, otherwise null.
 */
export default function usePlaceOrder({ orderContext, cart, cartKey }) {
  const router = useRouter();
  const { type } = orderContext;
  const [form, setForm] = useState({ customerName: '', customerPhone: '', allergy: '', notes: '' });
  const [payWith, setPayWith] = useState('online');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  // If the server says a price changed, this is the total the guest has since been shown.
  const agreedTotal = useRef(null);
  useEffect(() => {
    agreedTotal.current = null;
  }, [cart.total]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const placed = (token) => {
    cart.clear();
    rememberOrder(cartKey, token);
    router.push(orderHref(orderContext, token));
  };

  const checkout = useOrderCheckout({
    messages: {
      startFailed: 'The payment could not be started. Please try again, or choose cash.',
      windowFailed: 'The payment window could not be opened. Please check your connection, or choose cash.',
      backedOut: 'The payment was not completed, so nothing has been ordered yet.',
    },
    onPaid: ({ orderToken }) => (orderToken ? placed(orderToken) : setError(UNCONFIRMED)),
    onMenuChanged: ({ code, message, total }) => {
      if (code === 'price_changed') {
        agreedTotal.current = total;
        setError(`Some prices have changed since you opened the menu. Your order now comes to ${inr(total)}. Tap the button again to pay that.`);
      } else {
        setError(message || 'A dish in your order is not available any more. Please check your order.');
      }
      router.refresh(); // the menu on the page is read again
    },
    onBackedOut: (message) => setError(message),
  });
  const stage = checkout.pay.stage;

  // A message left by a payment that did not work is cleared by the next attempt.
  const clearPaymentMessage = () => {
    if (stage === 'failed' || stage === 'unconfirmed') checkout.dismiss();
  };

  const choosePayWith = (value) => {
    setPayWith(value);
    setError('');
    clearPaymentMessage();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    clearPaymentMessage();
    if (type === 'counter' && !form.customerName.trim()) {
      setError('Please enter a name so we can call out your order.');
      return;
    }
    // The phone field always carries a country code; only send a real number.
    const phone = /\d{6,}/.test(form.customerPhone) ? form.customerPhone : undefined;
    const order = {
      orderType: ORDER_TYPE_FOR_API[type],
      accessKey: orderContext.accessKey,
      ...(type === 'table' ? { tableNumber: String(orderContext.tableId) } : {}),
      ...(type === 'room' ? { roomNumber: String(orderContext.roomId) } : {}),
      customerName: form.customerName.trim() || undefined,
      customerPhone: phone,
      notes: composeOrderNotes(form) || undefined,
      items: cart.items.map((i) => ({ menuItemId: i.id, quantity: i.quantity, spiceLevel: i.spiceLevel || undefined, notes: i.notes || undefined })),
    };

    if (type === 'room' && payWith === 'online') {
      const total = agreedTotal.current ?? cart.total;
      const prefill = { ...(phone ? { contact: phone.replace(/[^\d+]/g, '') } : {}), ...(order.customerName ? { name: order.customerName } : {}) };
      checkout.start({
        body: { ...order, expectedTotal: total },
        total,
        gateway: { description: `Food to Room ${orderContext.roomId}`, ...(Object.keys(prefill).length ? { prefill } : {}) },
      });
      return;
    }

    try {
      setPlacing(true);
      const res = await api.post('/food-orders', order);
      placed(res.data.token);
    } catch (err) {
      setPlacing(false);
      setError(errMsg(err, 'Could not place your order. Please try again.'));
    }
  };

  const paying = ['opening', 'waiting', 'confirming'].includes(stage);
  return {
    form,
    setField,
    payWith,
    setPayWith: choosePayWith,
    status: placing ? 'placing' : paying ? 'paying' : error ? 'error' : 'idle',
    stage,
    error: stage === 'failed' ? checkout.pay.message : stage === 'unconfirmed' ? UNCONFIRMED : error,
    submit,
    testPayment: stage === 'mock' ? { total: checkout.pay.total, pay: checkout.mockPay, cancel: checkout.mockCancel } : null,
  };
}
