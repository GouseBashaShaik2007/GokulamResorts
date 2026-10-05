'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { useCart } from '@/lib/cart';
import { composeOrderNotes } from '@/lib/foodOrders';
import {
  DONE_SECONDS,
  IDLE_SECONDS,
  IDLE_WARNING_SECONDS,
  KIOSK_PATH,
  MENU_REFRESH_MS,
  NO_SERVICE,
  RELOAD_AFTER_MS,
  forgetKioskKey,
  menuChangeNotice,
  readKioskKey,
  reconcileOrder,
  saveKioskKey,
  serviceChosen,
  serviceForApi,
} from '@/lib/kiosk';
import KioskOrder from './KioskOrder';
import KioskPay from './KioskPay';
import KioskService from './KioskService';
import { IdleWarning, KioskConnecting, KioskDone, KioskLocked, KioskStart, TurnSideways } from './KioskScreens';
import { useCountdown, useIdle, useWakeLock } from './kioskHooks';
import useOrderCheckout from '@/lib/useOrderCheckout';

// A phone number as the payment gateway wants it, or '' if it isn't one.
const gatewayPhone = (raw) => {
  const digits = String(raw || '').replace(/[^\d+]/g, '');
  return /^\+?\d{10,13}$/.test(digits) ? digits : '';
};

/**
 * The restaurant's self-ordering kiosk (see lib/kiosk.js). One customer after
 * another walks up to it, so everything about an order lives in memory only
 * and is thrown away when the order is paid, abandoned or left untouched.
 *
 * The screen moves through:
 *   checking → locked      this device has no (valid) kiosk key
 *            → offline     the restaurant's system cannot be reached (retries)
 *            → start       "Tap to start", between customers
 *   start → order → done → start
 *
 * While ordering there are two steps: the menu, and then "How would you like
 * your order?" — dine-in (with the table), pickup, or room drop (with the
 * room) — which ends in the payment.
 */
export default function Kiosk() {
  const [phase, setPhase] = useState('checking');
  const [accessKey, setAccessKey] = useState('');
  const [lockReason, setLockReason] = useState('');
  const [menu, setMenu] = useState(null); // { categories, items }, once loaded
  const [menuFailed, setMenuFailed] = useState(false);
  const [payer, setPayer] = useState(null); // the resort's own contact, for the payment window
  const [allergy, setAllergy] = useState('');
  const [notice, setNotice] = useState('');
  // Where an order can be brought: how many tables there are, and the hotel's room numbers.
  const [places, setPlaces] = useState({ tables: 0, rooms: [] });
  const [service, setService] = useState(NO_SERVICE); // what this customer wants done with the order
  const [choosing, setChoosing] = useState(false); // the "how would you like your order?" step is showing
  const [placed, setPlaced] = useState(null); // { orderNumber, total, service } on the "done" screen
  const cart = useCart(null); // never written to the device
  const loadedAt = useRef(Date.now());

  // ----- is this device the kiosk? -----
  useEffect(() => {
    let stopped = false;
    let retry;
    // A set-up link (/dine-in?k=…) wins over a key kept from an earlier set-up.
    const fromLink = new URLSearchParams(window.location.search).get('k') || '';
    const candidate = fromLink || readKioskKey();

    const verify = async () => {
      if (!candidate) {
        setPhase('locked');
        return;
      }
      try {
        const res = await api.get('/order-access', { params: { type: 'kiosk', k: candidate } });
        if (stopped) return;
        if (res.data.valid) {
          saveKioskKey(candidate);
          // The key does not stay in the address bar (or the browser's history).
          if (fromLink) window.history.replaceState(null, '', KIOSK_PATH);
          setAccessKey(candidate);
          setPlaces({ tables: res.data.tables || 0, rooms: res.data.rooms || [] });
          setPhase('start');
        } else {
          if (!fromLink) forgetKioskKey();
          setLockReason(fromLink ? 'link' : 'expired');
          setPhase('locked');
        }
      } catch (err) {
        if (stopped) return;
        if (err?.response) {
          setPhase('locked'); // the API answered and said no
        } else {
          setPhase('offline');
          retry = setTimeout(verify, 8000);
        }
      }
    };
    verify();
    return () => {
      stopped = true;
      clearTimeout(retry);
    };
  }, []);

  // ----- the menu -----
  const loadMenu = useCallback(async () => {
    try {
      const [c, i] = await Promise.all([api.get('/menu/categories'), api.get('/menu/items', { params: { all: 1 } })]);
      const next = { categories: c.data.categories, items: i.data.items.map((dish) => ({ ...dish, price: Number(dish.price) })) };
      setMenu(next);
      setMenuFailed(false);
      return next;
    } catch {
      setMenuFailed(true);
      return null;
    }
  }, []);

  // The tables and rooms are read again for each customer: a table added in
  // Admin, or a room taken out of use, shows without setting the tablet up again.
  const loadPlaces = useCallback(async () => {
    try {
      const res = await api.get('/order-access', { params: { type: 'kiosk', k: accessKey } });
      if (res.data.valid) setPlaces({ tables: res.data.tables || 0, rooms: res.data.rooms || [] });
    } catch {
      // not reachable: keep the ones already known
    }
  }, [accessKey]);

  // Between customers: keep the menu fresh, and pick up a new version of the
  // site once in a while (only when it can actually be reached).
  useEffect(() => {
    if (phase !== 'start') return undefined;
    loadMenu();
    const id = setInterval(async () => {
      const fresh = await loadMenu();
      if (fresh && Date.now() - loadedAt.current > RELOAD_AFTER_MS) {
        try {
          const page = await fetch(window.location.pathname, { cache: 'no-store' });
          if (page.ok) window.location.reload();
        } catch {
          // not reachable: keep running the version that is loaded
        }
      }
    }, MENU_REFRESH_MS);
    return () => clearInterval(id);
  }, [phase, loadMenu]);

  // While someone is ordering: a dish marked sold out in the kitchen shows up within a minute.
  useEffect(() => {
    if (phase !== 'order') return undefined;
    const id = setInterval(loadMenu, MENU_REFRESH_MS);
    return () => clearInterval(id);
  }, [phase, loadMenu]);

  // The resort's own phone and email go to the payment window, so customers are not asked for theirs.
  useEffect(() => {
    if (!accessKey) return;
    api
      .get('/site-info')
      .then((res) => {
        const contact = gatewayPhone(res.data?.info?.phone);
        const email = /^\S+@\S+\.\S+$/.test(res.data?.info?.email || '') ? res.data.info.email : '';
        setPayer(contact || email ? { ...(contact ? { contact } : {}), ...(email ? { email } : {}) } : null);
      })
      .catch(() => setPayer(null));
  }, [accessKey]);

  // ----- payment -----
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const serviceRef = useRef(service);
  serviceRef.current = service;

  // Bring the order in line with a menu that changed under it; says what changed.
  const applyMenu = useCallback((fresh) => {
    const result = reconcileOrder(cartRef.current.items, fresh.items);
    if (result.removed.length === 0 && !result.repriced) return false;
    cartRef.current.restore(result.lines);
    setNotice(menuChangeNotice(result));
    // The message is shown with the order, so the customer is taken back to it before paying.
    setChoosing(false);
    return true;
  }, []);

  const payment = useOrderCheckout({
    messages: {
      startFailed: 'The payment could not be started. Please try again, or order with our staff.',
      windowFailed: 'The payment window could not be opened. Please try again, or order with our staff.',
      backedOut: 'The payment was not completed, so nothing has been ordered yet. Your order is still here.',
    },
    onPaid: (order) => {
      cartRef.current.clear();
      setAllergy('');
      setNotice('');
      // The order-number screen says what happens next: brought to the table or room, or called at the counter.
      setPlaced({ ...order, service: serviceRef.current });
      setService(NO_SERVICE);
      setPhase('done');
    },
    // The server refused the checkout: a dish sold out or a price changed since the menu was read.
    onMenuChanged: async () => {
      const fresh = await loadMenu();
      const explained = fresh ? applyMenu(fresh) : false;
      // Keep a message that already says what changed; otherwise say at least this much.
      if (!explained) setNotice((current) => current || 'The menu has just changed. Please check your order, then pay again.');
    },
    onBackedOut: (message) => setNotice(message),
  });
  const paying = payment.pay.stage !== 'idle';

  // The menu is also re-read every minute during an order (above); apply what changed.
  useEffect(() => {
    if (phase === 'order' && menu && !paying) applyMenu(menu);
    // Only a new menu should trigger this, not every change to the order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu]);

  const begin = () => {
    cart.clear();
    setAllergy('');
    setNotice('');
    setService(NO_SERVICE);
    setChoosing(false);
    setPhase('order');
    loadMenu(); // prices and sold-out dishes as they are this minute
    loadPlaces(); // and the tables and rooms as they are now
    // On the tablet, every new order puts the screen back to full screen in case someone left it.
    if (window.matchMedia?.('(pointer: coarse)').matches && !document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  };

  // Clear everything for the next customer.
  const reset = useCallback(() => {
    payment.cancel();
    cartRef.current.clear();
    setAllergy('');
    setNotice('');
    setService(NO_SERVICE);
    setChoosing(false);
    setPlaced(null);
    setPhase('start');
    // payment.cancel is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // From the order to "how would you like your order?".
  const chooseService = () => {
    if (cart.items.length === 0) return;
    setNotice('');
    setChoosing(true);
  };

  const pay = () => {
    if (!serviceChosen(service) || cart.items.length === 0) return;
    setNotice('');
    // The payment's own panel takes over the screen. If the payment is not
    // completed the customer is back at their order, with the choice kept.
    setChoosing(false);
    payment.start({
      body: {
        orderType: 'kiosk',
        accessKey,
        ...serviceForApi(service),
        items: cart.items.map((line) => ({ menuItemId: line.id, quantity: line.quantity, spiceLevel: line.spiceLevel || undefined, notes: line.notes || undefined })),
        notes: composeOrderNotes({ allergy }) || undefined,
        expectedTotal: cart.total,
      },
      total: cart.total,
      gateway: {
        name: 'Gokulam Restaurant',
        description: 'Order at the kiosk',
        // A shared screen: never offer to remember a card or a phone number.
        remember_customer: false,
        // The resort's own contact goes to the gateway, so customers are not asked for theirs.
        ...(payer ? { prefill: payer, hidden: { contact: Boolean(payer.contact), email: Boolean(payer.email) } } : {}),
        // UPI by QR code first: the customer scans the screen with their own phone.
        config: {
          display: {
            blocks: { scan: { name: 'Scan and pay with any UPI app', instruments: [{ method: 'upi', flows: ['qr'] }] } },
            sequence: ['block.scan'],
            preferences: { show_default_blocks: true },
          },
        },
      },
    });
  };

  // ----- nobody there -----
  // The gateway's payment window has its own time limit, so the kiosk does not
  // pull the screen away from under someone who is paying.
  const idle = useIdle({
    active: phase === 'order' && !['opening', 'waiting', 'confirming'].includes(payment.pay.stage),
    idleSeconds: IDLE_SECONDS,
    warningSeconds: IDLE_WARNING_SECONDS,
    onTimeout: reset,
  });
  const doneLeft = useCountdown({ active: phase === 'done', seconds: DONE_SECONDS, onEnd: reset });

  useWakeLock(phase !== 'locked' && phase !== 'checking');

  const orderable = menu ? menu.items.some((i) => i.is_available !== false) : false;

  return (
    // A touch screen in a public place: no text selection, no pull-to-refresh, no double-tap zoom.
    <div data-kiosk={phase} className="fixed inset-0 touch-manipulation select-none overflow-hidden overscroll-none bg-sand-50 text-ink-900">
      {phase === 'checking' && <KioskConnecting checking />}
      {phase === 'offline' && <KioskConnecting />}
      {phase === 'locked' && <KioskLocked reason={lockReason} />}
      {phase === 'start' && <KioskStart ready={orderable} closed={!orderable && (menu !== null || menuFailed)} onStart={begin} />}
      {phase === 'order' && menu && (
        <KioskOrder
          menu={menu}
          cart={cart}
          allergy={allergy}
          onAllergy={setAllergy}
          notice={notice}
          onDismissNotice={() => setNotice('')}
          onContinue={chooseService}
          paying={paying}
          onStartOver={reset}
        />
      )}
      {/* The step before the payment, over the order (which keeps its place for "Back to my order"). */}
      {phase === 'order' && menu && choosing && (
        <KioskService
          places={places}
          service={service}
          onChange={setService}
          total={cart.total}
          onPay={pay}
          paying={paying}
          onBack={() => setChoosing(false)}
        />
      )}
      {phase === 'done' && placed && <KioskDone order={placed} seconds={doneLeft} onDone={reset} />}

      {phase === 'order' && (
        <KioskPay
          pay={payment.pay}
          onMockPay={payment.mockPay}
          onMockCancel={payment.mockCancel}
          // After "please see our staff" the screen is cleared; after a plain failure the order is still there.
          onDismiss={payment.pay.stage === 'unconfirmed' ? reset : payment.dismiss}
        />
      )}
      {idle.left !== null && <IdleWarning seconds={idle.left} onStay={idle.stay} onStartOver={reset} />}
      {phase !== 'locked' && phase !== 'checking' && <TurnSideways />}
    </div>
  );
}
