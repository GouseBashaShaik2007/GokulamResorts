'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { errMsg } from '@/lib/bookingUi';
import Sheet from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { ISSUE_KINDS } from '@/lib/roomIssues';

const MAX_PHOTO_MB = 5;

// The form inside the sheet. Mounted fresh each time the sheet opens, so it always starts empty.
function ReportForm({ task, onClose }) {
  const toast = useToast();
  const [kind, setKind] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const choosePhoto = (e) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setError(`That photo is larger than ${MAX_PHOTO_MB} MB. Take it again a little further back, or send the report without it.`);
      e.target.value = '';
      setPhoto(null);
      return;
    }
    setError('');
    setPhoto(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!kind) return setError('Choose what kind of problem it is.');
    if (description.trim().length < 3) return setError('Say what the problem is.');
    setSending(true);
    setError('');
    const data = new FormData();
    data.append('roomUnitId', String(task.room_unit_id));
    data.append('kind', kind);
    data.append('description', description.trim());
    if (photo) data.append('photo', photo);
    try {
      await api.post('/staff/issues', data);
      toast(`Reported to the manager: room ${task.unit_number}.`);
      onClose();
    } catch (err) {
      setError(errMsg(err, 'That did not send. Check the connection and try again.'));
      setSending(false);
    }
    return undefined;
  };

  return (
    <form onSubmit={submit} className="space-y-5 p-6 text-left">
      <div>
        <p className="eyebrow">Room {task.unit_number}</p>
        <h2 className="mt-1 font-serif text-2xl font-bold text-ink-900">Report a problem</h2>
        <p className="mt-1 text-sm text-ink-500">It goes to the manager. Carry on with the room; you don&apos;t need to wait.</p>
      </div>

      <fieldset>
        <legend className="label">What is it?</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {ISSUE_KINDS.map((k) => (
            <label
              key={k.value}
              className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-3 text-center text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ocean-400 ${
                kind === k.value ? 'border-ocean-500 bg-ocean-500 text-white' : 'border-sand-400 bg-white text-ink-800'
              }`}
            >
              <input type="radio" name="issue-kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} className="sr-only" />
              {k.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="issue-description">What did you find?</label>
        <textarea
          id="issue-description" rows={3} maxLength={1000} className="input-field"
          placeholder="e.g. Bathroom tap keeps dripping" value={description} onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="issue-photo">Photo (optional)</label>
        {/* On a phone this offers the camera or a photo already taken. */}
        <input id="issue-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} className="block w-full text-sm text-ink-700 file:mr-3 file:rounded-lg file:border-0 file:bg-sand-300 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-ink-900" />
        {photo && <p className="mt-1 text-xs text-ink-400">{photo.name} attached.</p>}
      </div>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={onClose} disabled={sending} className="flex-1 rounded-xl border border-sand-400 py-3 text-sm font-medium text-ink-700">Cancel</button>
        <button type="submit" disabled={sending} className="flex-1 rounded-xl bg-ocean-500 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {sending ? 'Sending…' : 'Send to manager'}
        </button>
      </div>
    </form>
  );
}

/**
 * "Report a problem" on a housekeeper's or inspector's room card: a broken
 * tap, a stain, something a guest left behind. `task`: the room's task (it
 * carries the room's id and number). The button and the sheet it opens.
 */
export default function ReportIssue({ task, className = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-sm font-medium text-ocean-600 underline underline-offset-2 ${className}`}
      >
        Report a problem<span className="sr-only"> in room {task.unit_number}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label={`Report a problem in room ${task.unit_number}`}>
        {open && <ReportForm task={task} onClose={() => setOpen(false)} />}
      </Sheet>
    </>
  );
}
