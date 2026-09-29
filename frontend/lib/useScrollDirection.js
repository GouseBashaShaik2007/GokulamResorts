'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Tracks whether a "hide on scroll down, show on scroll up" element should
 * currently be visible.
 *
 * Default (`revealAfter: 0`): always visible near the top of the page; after
 * that, hides on downward scroll and reappears on upward scroll or after a
 * short idle pause.
 *
 * `revealAfter > 0`: the opposite starting state — hidden until the user has
 * scrolled past that many pixels (e.g. past the Hero, which already has its
 * own prominent booking CTA), then the same hide-on-down/show-on-up applies;
 * scrolling back above the threshold hides it again.
 */
export default function useScrollDirection({ threshold = 120, idleMs = 250, revealAfter = 0 } = {}) {
  const [visible, setVisible] = useState(revealAfter === 0);
  const lastY = useRef(0);
  const idleTimer = useRef(null);
  const ticking = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;

    const evaluate = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      const nearTop = y < (revealAfter || threshold);

      if (revealAfter > 0) {
        if (nearTop) {
          setVisible(false);
        } else if (delta > 8) {
          setVisible(false);
        } else if (delta < -8) {
          setVisible(true);
        }
      } else if (nearTop) {
        setVisible(true);
      } else if (delta > 8) {
        setVisible(false);
      } else if (delta < -8) {
        setVisible(true);
      }

      lastY.current = y;
      ticking.current = false;

      if (revealAfter === 0) {
        clearTimeout(idleTimer.current);
        idleTimer.current = setTimeout(() => setVisible(true), idleMs);
      }
    };

    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(evaluate);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(idleTimer.current);
    };
  }, [threshold, idleMs, revealAfter]);

  return visible;
}
