'use client';

import { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useModal from '../../lib/useModal';
import { useToast } from '../ui/Toast';
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
  const { isOpen, step, close, hold, goTo } = useBooking();
  const toast = useToast();

  // Closing never drops a held room — say so, since the timer keeps running.
  const requestClose = useCallback(() => {
    close();
    if (hold) toast('Your room is still on hold. Tap Book Now to finish paying.', { tone: 'info', duration: 6000 });
  }, [close, hold, toast]);

  // Focus trap, Escape, scroll lock, and focus back to the button that opened it.
  const panelRef = useModal(isOpen, requestClose);

  // Each step starts at the top, with focus on the panel so its heading is read.
  const firstStep = useRef(true);
  useEffect(() => {
    if (!isOpen) {
      firstStep.current = true;
      return;
    }
    if (firstStep.current) {
      firstStep.current = false; // opening is handled by useModal
      return;
    }
    panelRef.current?.scrollTo({ top: 0 });
    panelRef.current?.focus({ preventScroll: true });
  }, [step, isOpen, panelRef]);

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
            onClick={requestClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Book a room"
            tabIndex={-1}
            className="fixed inset-y-0 right-0 z-[70] flex w-full flex-col overflow-y-auto border-l border-navy-700/60 bg-navy-950 shadow-2xl focus:outline-none sm:max-w-xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-navy-700 px-6 py-4">
              <ol className="flex flex-1 items-start gap-2" aria-label="Booking steps">
                {STEPS.map((s, i) => {
                  const done = i < activeIndex;
                  const current = i === activeIndex;
                  // Earlier steps can be revisited until a room is on hold.
                  const canGoBack = done && !hold;
                  const label = (
                    <>
                      <span className={`block h-1.5 rounded-full transition-colors ${i <= activeIndex ? 'bg-ocean-500' : 'bg-navy-700'}`} />
                      <span className={`mt-1.5 block text-[0.7rem] ${current ? 'font-semibold text-navy-50' : 'text-navy-400'}`}>{s.label}</span>
                    </>
                  );
                  return (
                    <li key={s.key} className="flex-1" aria-current={current ? 'step' : undefined}>
                      {canGoBack ? (
                        <button type="button" onClick={() => goTo(s.key)} className="block w-full rounded text-left hover:opacity-80" aria-label={`Back to ${s.label}`}>
                          {label}
                        </button>
                      ) : (
                        label
                      )}
                    </li>
                  );
                })}
              </ol>
              <button
                type="button" onClick={requestClose} aria-label="Close booking panel"
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-navy-300 hover:bg-navy-800 hover:text-navy-50"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            {hold && step !== 'pay' && (
              <div className="border-b border-navy-700 bg-gold-500/5 px-6 py-2 text-xs text-gold-600">
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
