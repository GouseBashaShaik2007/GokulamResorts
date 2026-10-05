'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import useModal from '@/lib/useModal';

const ConfirmCtx = createContext(null);

/**
 * In-page replacement for the browser's confirm() and prompt().
 *
 *   const ask = useConfirm();
 *   if (await ask({ title: 'Cancel order #12?', confirmLabel: 'Cancel order', danger: true })) …
 *
 * With `input` it resolves to the typed text (or null if dismissed):
 *
 *   const pin = await ask({ title: 'New PIN', input: { label: 'PIN', type: 'password', validate } });
 *
 * `validate(value)` returns an error message to show, or '' when the value is fine.
 */
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);

  const ask = useCallback((options) => new Promise((resolve) => setRequest({ ...options, resolve })), []);

  const finish = (value) => {
    request?.resolve(value);
    setRequest(null);
  };

  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {request && <ConfirmDialog request={request} onDone={finish} />}
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const ask = useContext(ConfirmCtx);
  if (!ask) throw new Error('useConfirm must be used within ConfirmProvider');
  return ask;
}

function ConfirmDialog({ request, onDone }) {
  const { title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, input } = request;
  const dismissed = input ? null : false;
  const ref = useModal(true, () => onDone(dismissed));
  const [value, setValue] = useState(input?.initial || '');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!input) return onDone(true);
    const problem = input.validate ? input.validate(value) : '';
    if (problem) return setError(problem);
    return onDone(value);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-4" onClick={() => onDone(dismissed)}>
      <form
        ref={ref}
        role={danger ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={body ? 'confirm-body' : undefined}
        tabIndex={-1}
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-sand-300 bg-sand-50 p-6 text-left shadow-2xl focus:outline-none"
      >
        <h2 id="confirm-title" className="font-serif text-xl font-semibold text-ink-900">{title}</h2>
        {body && <p id="confirm-body" className="mt-2 text-sm leading-relaxed text-ink-500">{body}</p>}

        {input && (
          <div className="mt-4">
            <label className="label" htmlFor="confirm-input">{input.label}</label>
            <input
              id="confirm-input"
              data-autofocus
              type={input.type || 'text'}
              inputMode={input.inputMode}
              autoComplete="off"
              placeholder={input.placeholder}
              className="input-field"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError('');
              }}
            />
            {input.hint && !error && <p className="mt-1 text-xs text-ink-400">{input.hint}</p>}
            {error && <p role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={() => onDone(dismissed)} className="btn-outline px-5 py-2 text-sm">
            {cancelLabel}
          </button>
          <button
            type="submit"
            {...(input ? {} : { 'data-autofocus': true })}
            className={
              danger
                ? 'inline-flex items-center justify-center rounded-full bg-red-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2'
                : 'btn-primary px-5 py-2 text-sm'
            }
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
