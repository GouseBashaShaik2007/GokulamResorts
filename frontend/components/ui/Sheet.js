'use client';

import { AnimatePresence, motion } from 'framer-motion';
import useModal from '@/lib/useModal';

/**
 * A panel that slides up from the bottom on phones and in from the right on
 * larger screens. Traps focus, closes on Escape or a tap outside, and returns
 * focus to whatever opened it. `label` names it for screen readers.
 */
export default function Sheet({ open, onClose, label, children }) {
  const ref = useModal(open, onClose); // focus trap, Escape, scroll lock, focus return

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[65] bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            className="fixed inset-x-0 bottom-0 z-[70] max-h-[88vh] overflow-y-auto rounded-t-3xl bg-navy-950 shadow-2xl focus:outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:max-w-md sm:rounded-none"
            initial={{ y: '100%', x: 0 }}
            animate={{ y: 0, x: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-navy-700 sm:hidden" aria-hidden="true" />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
