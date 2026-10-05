'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const TOUCH_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];

/**
 * Notices that nobody is using the screen. After `idleSeconds` without a touch
 * a warning starts counting down from `warningSeconds`; a touch anywhere but on
 * the warning itself (mark it with data-idle-warning) cancels it, and if it
 * runs out `onTimeout()` is called.
 *
 * Returns { left, stay }: the seconds left on the warning (null while there is
 * none), and a function for the warning's own "I'm still here" button.
 * (Measured against the clock, not by counting ticks, so a tablet that
 * throttles timers while dimmed still clears on time.)
 */
export function useIdle({ active, idleSeconds, warningSeconds, onTimeout }) {
  const [left, setLeft] = useState(null);
  const lastTouch = useRef(0);
  const timeout = useRef(onTimeout);
  timeout.current = onTimeout;

  useEffect(() => {
    if (!active) {
      setLeft(null);
      return undefined;
    }
    lastTouch.current = Date.now();
    const touched = (event) => {
      // The warning's buttons decide for themselves; a touch on them must not
      // make the warning vanish before the tap has landed.
      if (event.target?.closest?.('[data-idle-warning]')) return;
      lastTouch.current = Date.now();
      setLeft(null);
    };
    TOUCH_EVENTS.forEach((name) => window.addEventListener(name, touched, { capture: true, passive: true }));

    const tick = setInterval(() => {
      const quiet = (Date.now() - lastTouch.current) / 1000;
      if (quiet < idleSeconds) return;
      const remaining = Math.ceil(idleSeconds + warningSeconds - quiet);
      if (remaining > 0) {
        setLeft(remaining);
      } else {
        lastTouch.current = Date.now();
        setLeft(null);
        timeout.current();
      }
    }, 500);

    return () => {
      TOUCH_EVENTS.forEach((name) => window.removeEventListener(name, touched, { capture: true }));
      clearInterval(tick);
    };
  }, [active, idleSeconds, warningSeconds]);

  const stay = useCallback(() => {
    lastTouch.current = Date.now();
    setLeft(null);
  }, []);

  return { left, stay };
}

/** Counts down from `seconds` while `active`, then calls `onEnd()`. Returns the seconds left. */
export function useCountdown({ active, seconds, onEnd }) {
  const [left, setLeft] = useState(seconds);
  const end = useRef(onEnd);
  end.current = onEnd;

  useEffect(() => {
    if (!active) return undefined;
    const started = Date.now();
    setLeft(seconds);
    const tick = setInterval(() => {
      const remaining = Math.ceil(seconds - (Date.now() - started) / 1000);
      if (remaining > 0) {
        setLeft(remaining);
      } else {
        clearInterval(tick);
        end.current();
      }
    }, 500);
    return () => clearInterval(tick);
  }, [active, seconds]);

  return left;
}

/**
 * Keeps the tablet's screen on while the kiosk is showing. The browser drops
 * the lock whenever the page is hidden, so it is asked for again each time
 * the page comes back. Browsers without the feature simply follow the
 * tablet's own sleep setting.
 */
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return undefined;
    let stopped = false;
    let lock = null;
    const request = async () => {
      try {
        const next = await navigator.wakeLock.request('screen');
        if (stopped) next.release().catch(() => {});
        else lock = next;
      } catch {
        // refused (battery saver, page not visible): try again when the page is next shown
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && request();
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
