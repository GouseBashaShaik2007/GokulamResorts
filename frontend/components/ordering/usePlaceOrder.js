'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { errMsg } from '@/lib/bookingUi';
import { ORDER_TYPE_FOR_API, composeOrderNotes, orderHref } from '@/lib/foodOrders';
import { rememberOrder } from '@/lib/myOrders';

/**
 * The guest's details and the act of placing the order.
 * `orderContext`: { type: 'table', tableId, accessKey } or { type: 'counter', accessKey }
 * — the key comes from the QR code that opened the page. `cartKey` names this
 * ordering context on the device (see lib/cart.js).
 * Returns { form, setField, status ('idle' | 'placing' | 'error'), error, submit }.
 */
export default function usePlaceOrder({ orderContext, cart, cartKey }) {
  const router = useRouter();
  const isTable = orderContext.type === 'table';
  const [form, setForm] = useState({ customerName: '', customerPhone: '', allergy: '', notes: '' });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isTable && !form.customerName.trim()) {
      setError('Please enter a name so we can call out your order.');
      return;
    }
    try {
      setStatus('placing');
      const res = await api.post('/food-orders', {
        orderType: ORDER_TYPE_FOR_API[orderContext.type],
        accessKey: orderContext.accessKey,
        ...(isTable ? { tableNumber: String(orderContext.tableId) } : {}),
        customerName: form.customerName || undefined,
        // The phone field always carries a country code; only send a real number.
        customerPhone: /\d{6,}/.test(form.customerPhone) ? form.customerPhone : undefined,
        notes: composeOrderNotes(form) || undefined,
        items: cart.items.map((i) => ({ menuItemId: i.id, quantity: i.quantity, spiceLevel: i.spiceLevel || undefined, notes: i.notes || undefined })),
      });
      cart.clear();
      rememberOrder(cartKey, res.data.token);
      router.push(orderHref(orderContext, res.data.token));
    } catch (err) {
      setStatus('error');
      setError(errMsg(err, 'Could not place your order. Please try again.'));
    }
  };

  return { form, setField, status, error, submit };
}
