'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from './api';
import { errMsg } from './bookingUi';
import { loadRazorpayScript } from './loadRazorpay';

const IDLE = { stage: 'idle' };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Paying for a food order online before it exists — the restaurant's kiosk,
 * and an order from a table's or a hotel room's QR code. Nothing reaches the
 * kitchen until the payment is in: `start` opens a checkout on the server and
 * the payment window on the screen; when the customer has paid, the server
 * checks the payment and only then places the order
 * (see backend/src/controllers/checkout.controller.js).
 *
 * Options:
 *   messages       { startFailed, windowFailed, backedOut } — what to say, in the screen's own words
 *   onPaid({ orderNumber, orderToken, total })   orderToken: the guest's private link to the
 *                  order, for a table or a room; null for the kiosk, whose customer has only the number
 *   onMenuChanged({ code, message, total })   the server refused the checkout: a dish
 *                  sold out ('sold_out') or a price changed ('price_changed') since the menu was read
 *   onBackedOut(message)                      the payment window was closed without paying
 *
 * Returns { pay, start, cancel, mockPay, mockCancel, dismiss } where pay.stage is one of:
 *   idle         nothing going on
 *   opening      the checkout is being prepared
 *   waiting      the payment window is open
 *   mock         test mode: the API has no gateway keys, a stand-in panel is shown
 *   confirming   the customer paid (or closed the window); asking the server
 *   failed       it did not work — pay.message says what to do
 *   unconfirmed  paid, but the server could not be reached to place the order
 */
export default function useOrderCheckout({ messages, onPaid, onMenuChanged, onBackedOut }) {
  const [pay, setPay] = useState(IDLE);
  // The checkout in progress: { checkout, settled, rzp }. `settled` is set the
  // moment it is decided either way, so "paid" and "closed" cannot both act.
  const open = useRef(null);
  const starting = useRef(false);
  const latest = useRef({});
  latest.current = { messages, onPaid, onMenuChanged, onBackedOut };

  const finish = (data) => {
    open.current = null;
    setPay(IDLE);
    latest.current.onPaid({ orderNumber: data.orderNumber, orderToken: data.orderToken || null, total: data.total });
  };
  const fail = (message) => {
    open.current = null;
    setPay({ stage: 'failed', message });
  };

  // The payment window reported success. The customer has paid, so a dropped
  // connection must not lose the order: retry, then ask the server to look
  // the payment up itself.
  const confirm = async (checkout, response) => {
    const current = open.current;
    if (!current || current.checkout.token !== checkout.token || current.settled) return;
    current.settled = true;
    setPay({ stage: 'confirming', total: checkout.total });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const res = await api.post(`/checkouts/${checkout.token}/confirm`, response);
        return finish(res.data);
      } catch (err) {
        if (err?.response) return fail(errMsg(err, 'The payment could not be confirmed. Please speak to our staff.'));
        await sleep(2000);
      }
    }
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        const res = await api.get(`/checkouts/${checkout.token}`, { params: { check: 1 } });
        if (res.data.status === 'paid') return finish(res.data);
        if (res.data.status === 'refunded') return fail('This payment arrived after the order had been closed, so it is being refunded. Please order again.');
      } catch {
        // still unreachable
      }
      await sleep(3000);
    }
    open.current = null;
    return setPay({ stage: 'unconfirmed', total: checkout.total });
  };

  // The customer closed the payment window, or it timed out.
  const backOut = async (checkout) => {
    const current = open.current;
    if (!current || current.checkout.token !== checkout.token || current.settled) return;
    current.settled = true;
    setPay({ stage: 'confirming', total: checkout.total });
    try {
      const res = await api.post(`/checkouts/${checkout.token}/abandon`);
      // It went through in the very moment the window closed: the order is placed after all.
      if (res.data.status === 'paid') return finish(res.data);
    } catch {
      // unreachable: the server's clean-up job closes the checkout by itself
    }
    open.current = null;
    setPay(IDLE);
    return latest.current.onBackedOut(latest.current.messages.backedOut);
  };

  /**
   * `body`: what POST /checkouts takes ({ orderType, accessKey, items, … }, with
   * the table, the room, or the kiosk customer's serviceMode).
   * `total`: what the screen showed. `gateway`: extra options for the payment
   * window (name, description, prefill, …).
   */
  const start = useCallback(async ({ body, total, gateway = {} }) => {
    if (open.current || starting.current) return;
    starting.current = true;
    setPay({ stage: 'opening', total });
    try {
      let checkout;
      try {
        const res = await api.post('/checkouts', body);
        checkout = res.data;
      } catch (err) {
        const data = err?.response?.data;
        if (data?.code === 'sold_out' || data?.code === 'price_changed') {
          setPay(IDLE);
          latest.current.onMenuChanged({ code: data.code, message: data.message, total: data.total });
          return;
        }
        fail(errMsg(err, latest.current.messages.startFailed));
        return;
      }

      open.current = { checkout, settled: false, rzp: null };
      if (checkout.mock) {
        setPay({ stage: 'mock', total: checkout.total });
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        open.current.settled = true;
        api.post(`/checkouts/${checkout.token}/abandon`).catch(() => {});
        fail(latest.current.messages.windowFailed);
        return;
      }

      const rzp = new window.Razorpay({
        key: checkout.keyId,
        amount: checkout.amount,
        currency: checkout.currency,
        name: 'Gokulam Resorts',
        order_id: checkout.gatewayOrderId,
        // The window closes itself after this long; the screen then returns to the order.
        timeout: checkout.paySeconds,
        theme: { color: '#0E4F5C' },
        ...gateway,
        handler: (response) => confirm(checkout, response),
        modal: { ondismiss: () => backOut(checkout), escape: false, backdropclose: false, confirm_close: true },
      });
      open.current.rzp = rzp;
      rzp.open();
      setPay({ stage: 'waiting', total: checkout.total });
    } finally {
      starting.current = false;
    }
    // confirm/backOut only touch refs and setters, so they need not be listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Drop whatever is in progress (the screen is being cleared, or the guest is leaving). */
  const cancel = useCallback(() => {
    const current = open.current;
    open.current = null;
    setPay(IDLE);
    if (!current || current.settled) return;
    current.settled = true;
    try {
      current.rzp?.close();
    } catch {
      // the window had already gone
    }
    api.post(`/checkouts/${current.checkout.token}/abandon`).catch(() => {});
  }, []);

  // Test mode only (the API has no gateway keys and says `mock: true`).
  const mockPay = () => {
    const checkout = open.current?.checkout;
    if (!checkout) return;
    confirm(checkout, { razorpay_order_id: checkout.gatewayOrderId, razorpay_payment_id: `pay_mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, razorpay_signature: 'mock_signature' });
  };
  const mockCancel = () => {
    if (open.current) backOut(open.current.checkout);
  };

  /** Close a "failed" or "unconfirmed" message. */
  const dismiss = useCallback(() => setPay(IDLE), []);

  // Leaving the page with a checkout open: tell the server it is over.
  useEffect(
    () => () => {
      const current = open.current;
      if (current && !current.settled) api.post(`/checkouts/${current.checkout.token}/abandon`).catch(() => {});
    },
    []
  );

  return { pay, start, cancel, mockPay, mockCancel, dismiss };
}
