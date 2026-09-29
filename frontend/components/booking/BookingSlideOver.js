'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useBooking } from './BookingContext';
import StayStep from './steps/StayStep';
import RoomStep from './steps/RoomStep';
import GuestStep from './steps/GuestStep';
import PayStep from './steps/PayStep';

const STEPS = [
  { key: 'stay', label: 'Stay' },
  { key: 'room', label: 'Room' },
  { key: 'guest', label: 'Details' },
  { key: 'pay', label: 'Payment' },
];

const STEP_COMPONENT = { stay: StayStep, room: RoomStep, guest: GuestStep, pay: PayStep };

export default function BookingSlideOver() {
  const { isOpen, step, close, hold } = useBooking();
  const panelRef = useRef(null);

  // Lock page scroll while open, restore whatever it was on close.
  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [isOpen]);

  // Esc to close.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  const StepComponent = STEP_COMPONENT[step];
  const activeIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Book a room"
            className="fixed inset-y-0 right-0 z-[70] flex w-full flex-col overflow-y-auto border-l border-navy-700/60 bg-navy-950 shadow-2xl sm:max-w-xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div className="flex items-center gap-2">
                {STEPS.map((s, i) => (
                  <span
                    key={s.key}
                    className={`h-1.5 w-6 rounded-full transition-colors ${
                      i <= activeIndex ? 'bg-gold-500' : 'bg-navy-700'
                    }`}
                    title={s.label}
                  />
                ))}
              </div>
              <button
                type="button" onClick={close} aria-label="Close booking panel"
                className="flex h-8 w-8 items-center justify-center rounded-full text-navy-300 hover:bg-navy-800 hover:text-navy-50"
              >
                ✕
              </button>
            </div>

            {hold && step !== 'pay' && (
              <div className="border-b border-white/10 bg-gold-500/5 px-6 py-2 text-xs text-gold-400">
                You have a room on hold — return to Payment to finish.
              </div>
            )}

            <div className="flex-1 p-6 sm:p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.25 }}
                >
                  <StepComponent />
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
