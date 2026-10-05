'use client';

import { useState } from 'react';
import Chip from '@/components/ui/Chip';
import { useConfirm } from '@/components/ui/Confirm';
import Sheet from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { SKIP_REASONS } from '@/lib/stayovers';

// The choices inside the sheet. Mounted fresh each time the sheet opens, so it always starts empty.
function SkipForm({ task, onSkip, onClose }) {
  const ask = useConfirm();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!reason) return setError('Choose why the room is not being serviced.');
    if (reason === 'other' && note.trim().length < 3) return setError('Say what the reason is.');
    setError('');

    const chosen = SKIP_REASONS.find((r) => r.value === reason);
    // Said back to them before it is saved: the reason picked, or their own words for "Other".
    const why = reason === 'other' ? note.trim().replace(/[.\s]+$/, '') : chosen.label;
    const ok = await ask({
      title: `Close room ${task.unit_number} for today?`,
      body: `Reason: ${why}. Nobody will service this room today: it comes off the bedding list and the toiletry list.`,
      confirmLabel: 'Yes, close it',
    });
    if (!ok) return undefined;

    setSending(true);
    const saved = await onSkip({ reason, ...(reason === 'other' ? { note: note.trim() } : {}) });
    if (saved) {
      toast(`Room ${task.unit_number} closed for today: ${chosen.label.toLowerCase()}.`);
      onClose();
    } else {
      setSending(false);
    }
    return undefined;
  };

  return (
    <form onSubmit={submit} className="space-y-5 p-6 text-left">
      <div>
        <p className="eyebrow">Room {task.unit_number} · Stayover</p>
        <h2 className="mt-1 font-serif text-2xl font-bold text-ink-900">Can&apos;t service this room</h2>
        <p className="mt-1 text-sm text-ink-500">
          Whoever reaches the door first says so here, for both of you. The room is left as it is today.
        </p>
      </div>

      <div role="group" aria-label="Why not" className="grid gap-2">
        {SKIP_REASONS.map((r) => (
          <Chip
            key={r.value}
            pressed={reason === r.value}
            onClick={() => {
              setReason(r.value);
              setError('');
            }}
            className="min-h-[3rem] justify-center"
          >
            {r.label}
          </Chip>
        ))}
      </div>

      {reason === 'other' && (
        <div>
          <label className="label" htmlFor={`skip-note-${task.id}`}>What is the reason?</label>
          <textarea
            id={`skip-note-${task.id}`} rows={3} maxLength={500} className="input-field"
            placeholder="e.g. Guest is unwell and resting" value={note} onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={onClose} disabled={sending} className="flex-1 rounded-xl border border-sand-400 py-3 text-sm font-medium text-ink-700">Cancel</button>
        <button type="submit" disabled={sending} className="flex-1 rounded-xl bg-ocean-500 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {sending ? 'Closing…' : 'Close room for today'}
        </button>
      </div>
    </form>
  );
}

/**
 * "Can't service this room" on a stayover card: Do not disturb, the guest
 * said no, or something else (with a note). Asks once more before closing,
 * because it takes the room off both housekeepers' lists for the day.
 * `task`: the stayover task; `onSkip({ reason, note })` saves it and resolves
 * true when it did. The button and the sheet it opens.
 */
export default function SkipStayover({ task, onSkip, disabled = false }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-sand-400 py-3 text-sm font-semibold text-ink-700 disabled:opacity-50"
      >
        Can&apos;t service this room<span className="sr-only"> ({task.unit_number})</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label={`Can't service room ${task.unit_number}`}>
        {open && <SkipForm task={task} onSkip={onSkip} onClose={() => setOpen(false)} />}
      </Sheet>
    </>
  );
}
