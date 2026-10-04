'use client';

import useModal from '../../../lib/useModal';

// Small pieces shared by the booking detail panel's sections and forms.

export const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
];

export const btn = 'rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50';

export function Section({ title, children, right }) {
  return (
    <section className="border-t border-navy-800 py-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-navy-400">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Row({ label, children, strong }) {
  return (
    <div className="flex justify-between gap-4 py-0.5 text-sm">
      <span className="text-navy-400">{label}</span>
      <span className={strong ? 'font-semibold text-navy-50' : 'text-navy-100'}>{children}</span>
    </div>
  );
}

/** The slide-over frame the booking opens in. */
export function Shell({ children, onClose }) {
  const ref = useModal(true, onClose); // focus trap, Escape, scroll lock, focus return
  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/60" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Booking details"
        tabIndex={-1}
        className="h-full w-full max-w-xl overflow-y-auto bg-navy-900 shadow-2xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
