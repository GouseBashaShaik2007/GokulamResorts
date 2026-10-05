'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastCtx = createContext(null);

const TONE = {
  success: 'border-green-700/30 bg-green-50 text-green-900',
  error: 'border-red-700/30 bg-red-50 text-red-900',
  info: 'border-sand-300 bg-sand-50 text-ink-900',
};

/**
 * Short confirmations that an action worked (or didn't), shown at the bottom
 * of the screen and read out by screen readers.
 *
 *   const toast = useToast();
 *   toast('Saved');                              // success
 *   toast('Could not save', { tone: 'error' });
 *   toast('Added to your order', { action: { label: 'Undo', onClick } });
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (message, { tone = 'success', action, duration = 4000 } = {}) => {
      const id = nextId.current;
      nextId.current += 1;
      // Keep at most three on screen; the oldest drops off.
      setToasts((list) => [...list.slice(-2), { id, message, tone, action }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[95] flex flex-col items-center gap-2 px-4 pb-6"
        style={{ paddingBottom: 'calc(var(--booking-bar-space, 0px) + 1.5rem)' }}
      >
        {/* Polite for confirmations; errors interrupt. */}
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-2">
          {toasts.filter((t) => t.tone !== 'error').map((t) => <ToastItem key={t.id} toast={t} onDismiss={dismiss} />)}
        </div>
        <div role="alert" className="flex flex-col items-center gap-2">
          {toasts.filter((t) => t.tone === 'error').map((t) => <ToastItem key={t.id} toast={t} onDismiss={dismiss} />)}
        </div>
      </div>
    </ToastCtx.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  return (
    <div className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${TONE[toast.tone] || TONE.info}`}>
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action.onClick();
            onDismiss(toast.id);
          }}
          className="rounded font-semibold underline underline-offset-2"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}

export function useToast() {
  const toast = useContext(ToastCtx);
  if (!toast) throw new Error('useToast must be used within ToastProvider');
  return toast;
}
