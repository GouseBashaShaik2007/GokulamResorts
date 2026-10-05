'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open modals, innermost last. Only the top one answers Escape and traps Tab,
// so a confirm dialog opened from inside a panel closes on its own.
const stack = [];

/**
 * The behaviour every modal surface needs (booking panel, menu sheets,
 * lightbox, admin panels, confirm dialogs):
 *  - focus moves into it on open and back to the trigger on close
 *  - Tab and Shift+Tab stay inside it
 *  - Escape closes it
 *  - the page behind doesn't scroll
 *
 * Returns a ref for the dialog element. Give that element role="dialog",
 * aria-modal="true" and tabIndex={-1}. Mark the control that should receive
 * focus first with data-autofocus (otherwise the dialog itself is focused).
 */
export default function useModal(open, onClose, { lockScroll = true } = {}) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const node = ref.current;
    const trigger = document.activeElement;
    const token = {};
    stack.push(token);
    const isTop = () => stack[stack.length - 1] === token;

    if (node && !node.contains(document.activeElement)) {
      (node.querySelector('[data-autofocus]') || node).focus({ preventScroll: true });
    }

    const onKey = (e) => {
      if (!isTop() || !node) return;

      if (e.key === 'Escape') {
        // An open popover inside the dialog (the date picker) takes Escape first.
        if (node.querySelector('[data-popover-open="true"]')) return;
        e.stopPropagation();
        closeRef.current?.();
        return;
      }

      if (e.key !== 'Tab') return;
      const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !node.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !node.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);

    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    if (lockScroll) root.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey, true);
      stack.splice(stack.indexOf(token), 1);
      if (lockScroll) root.style.overflow = previousOverflow;
      if (trigger && typeof trigger.focus === 'function' && document.contains(trigger)) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, [open, lockScroll]);

  return ref;
}
