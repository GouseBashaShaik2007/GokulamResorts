'use client';

import { useId, useState } from 'react';
import api from '@/lib/api';
import { errMsg } from '@/lib/bookingUi';
import { JOB_STATUS_STYLE, PRIORITY_STYLE, TASK_STATUS_STYLE } from '@/lib/cleaningStyles';
import { TASK_CHECKLIST, useChecklist } from '@/lib/cleaningChecklists';
import { STAYOVER_CHECKLIST } from '@/lib/stayovers';
import { useToast } from '@/components/ui/Toast';
import ReportIssue from './ReportIssue';
import SkipStayover from './SkipStayover';
import { Badge, fmtTime, taskStatusLabel } from './shared';

// The cards on a housekeeper's or inspector's screen: one per room.

// Why the room is on the list, said as what it means for the person cleaning it.
const REASON_LABEL = {
  checkout: 'Guest left: full clean',
  manual: 'Touch-up: see the note',
  stayover: 'Daily service, not a full clean',
};

// The buttons a cleaner or inspector presses all day: a symbol, the English
// word and the Telugu one, so the screen works for someone who reads neither
// well. TODO(owner): have a Telugu speaker on the team check the wording.
// Drawn, not typed: symbol characters like ▶ turn into coloured emoji on some phones.
const ICON = {
  play: <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />,
  pause: <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" stroke="none" />,
  tick: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  cross: <path d="M6 6l12 12M18 6L6 18" />,
};

const ACTION = {
  start: { icon: 'play', en: 'Start', te: 'ప్రారంభించు' },
  resume: { icon: 'play', en: 'Resume', te: 'కొనసాగించు' },
  pause: { icon: 'pause', en: 'Pause', te: 'విరామం' },
  complete: { icon: 'tick', en: 'Complete', te: 'పూర్తయింది' },
  approve: { icon: 'tick', en: 'Approve', te: 'ఆమోదించు' },
  reject: { icon: 'cross', en: 'Reject', te: 'తిరస్కరించు' },
};

function ActionLabel({ action }) {
  const a = ACTION[action];
  return (
    <span className="flex items-center justify-center gap-2.5">
      <svg viewBox="0 0 24 24" className="h-6 w-6 flex-none" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICON[a.icon]}
      </svg>
      <span className="text-left leading-tight">
        <span className="block">{a.en}</span>
        <span className="block text-xs font-normal opacity-90" lang="te">{a.te}</span>
      </span>
    </span>
  );
}

// VIP and High rooms carry a coloured band across the top of the card, so
// they are found first on a long list; Normal rooms keep the quiet badge.
const PRIORITY_BAND = { VIP: 'bg-gold-600 text-white', High: 'bg-red-700 text-white' };

export function RoomHeader({ task }) {
  const band = PRIORITY_BAND[task.priority];
  return (
    <>
      {band && (
        <p className={`-mx-5 -mt-5 mb-4 rounded-t-2xl px-5 py-2 text-sm font-bold uppercase tracking-wider ${band}`}>
          {task.priority === 'VIP' ? 'VIP room — do this first' : 'High priority'}
        </p>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-serif text-3xl font-bold text-ink-900">{task.unit_number}</p>
          <p className="text-xs text-ink-400">
            {task.room_type}
            {task.floor ? ` · Floor ${task.floor}` : ''} · {REASON_LABEL[task.job_reason]}
          </p>
          {/* The guest's things are in the room: nobody should mistake this for an empty one. */}
          {task.job_reason === 'stayover' && (
            <p className="mt-2 inline-block rounded-full bg-ocean-50 px-3 py-1 text-sm font-semibold text-ocean-700">
              Stayover · guest is staying
            </p>
          )}
        </div>
        {!band && <Badge className={PRIORITY_STYLE[task.priority]}>{task.priority}</Badge>}
      </div>
    </>
  );
}

/**
 * The note on a job. On a job raised because check-out time passed with the
 * guest still checked in (`source` 'late') it is a warning, and is shown so
 * that it cannot be missed; the note goes once the guest has been checked out.
 */
export function JobNote({ source, notes }) {
  if (!notes) return null;
  if (source === 'late') {
    return (
      <p className="mt-3 rounded-lg border-2 border-gold-500 bg-gold-50 px-3 py-2.5 text-sm font-semibold text-ink-900">
        <span className="block text-xs font-bold uppercase tracking-wider text-gold-700">Late check-out</span>
        {notes}
      </p>
    );
  }
  return <p className="mt-2 text-sm italic text-ink-500">Note: {notes}</p>;
}

// "See photo" on a room the inspector sent back with a photo of what is wrong.
function RejectionPhotoLink({ task }) {
  const toast = useToast();

  const open = async () => {
    // Opened first, inside the tap, so the browser doesn't block it as a pop-up.
    const tab = window.open('', '_blank');
    try {
      const res = await api.get(`/staff/tasks/${task.id}/rejection-photo-url`);
      if (tab) tab.location = res.data.url;
      else window.location.assign(res.data.url);
    } catch (err) {
      tab?.close();
      toast(errMsg(err, 'Could not open the photo'), { tone: 'error' });
    }
  };

  return (
    <button type="button" onClick={open} className="mt-1.5 block font-semibold underline underline-offset-2">
      See photo<span className="sr-only"> of what the inspector found in room {task.unit_number}</span>
    </button>
  );
}

// Bedding / toiletry: Start → Pause ⇄ Resume → tick the checklist → Complete.
// A stayover has its own shorter checklist, and can be closed at the door
// without being serviced ("Can't service this room").
export function CleaningTaskCard({ task, onAction, busy }) {
  const big = 'flex-1 rounded-xl py-3 text-base font-semibold disabled:opacity-50';
  const stayover = task.job_reason === 'stayover';
  const checklist = (stayover ? STAYOVER_CHECKLIST : TASK_CHECKLIST)[task.type] || [];
  const [ticked, toggle, clearTicks] = useChecklist(task.id);
  const allDone = checklist.every((item) => ticked.includes(item));

  const complete = async () => {
    if (await onAction(task, 'complete')) clearTicks();
  };

  const skip = async (body) => {
    const saved = await onAction(task, 'skip', body);
    if (saved) clearTicks();
    return saved;
  };

  return (
    <div className="card p-5">
      <RoomHeader task={task} />
      <JobNote source={task.job_source} notes={task.job_notes} />
      {task.failure_reason && (
        <div className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700">
          <p>
            <span className="font-semibold">Redo — inspector said:</span> {task.failure_reason}
          </p>
          {task.rejection_has_photo && <RejectionPhotoLink task={task} />}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2 text-xs text-ink-400">
        <Badge className={TASK_STATUS_STYLE[task.status]}>{taskStatusLabel(task.status)}</Badge>
        {task.start_time && <span>Started {fmtTime(task.start_time)}</span>}
      </div>

      {/* The standard for this task: every line ticked before it can be completed. */}
      {task.status === 'InProgress' && checklist.length > 0 && (
        <fieldset className="mt-4">
          <legend className="text-xs font-semibold uppercase tracking-wider text-ink-400">
            Checklist ({checklist.filter((item) => ticked.includes(item)).length} of {checklist.length})
          </legend>
          <div className="mt-2 space-y-2">
            {checklist.map((item) => (
              <label
                key={item}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-base ${ticked.includes(item) ? 'border-green-700/50 bg-green-500/10 text-ink-900' : 'border-sand-400 text-ink-800'}`}
              >
                <input type="checkbox" className="h-5 w-5 accent-green-700" checked={ticked.includes(item)} onChange={() => toggle(item)} />
                {item}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="mt-4 flex gap-3">
        {task.status === 'Pending' && (
          <button disabled={busy} onClick={() => onAction(task, 'start')} className={`${big} bg-ocean-500 text-white`}>
            <ActionLabel action="start" />
          </button>
        )}
        {task.status === 'InProgress' && (
          <>
            <button disabled={busy} onClick={() => onAction(task, 'pause')} className={`${big} border border-orange-400/60 text-orange-700`}>
              <ActionLabel action="pause" />
            </button>
            <button disabled={busy || !allDone} onClick={complete} className={`${big} bg-green-700 text-white`}>
              <ActionLabel action="complete" />
            </button>
          </>
        )}
        {task.status === 'Paused' && (
          <button disabled={busy} onClick={() => onAction(task, 'start')} className={`${big} bg-ocean-500 text-white`}>
            <ActionLabel action="resume" />
          </button>
        )}
      </div>
      {task.status === 'InProgress' && !allDone && (
        <p className="mt-2 text-center text-xs text-ink-400">Tick every line of the checklist to complete this room.</p>
      )}
      {/* "Do not disturb" on the door, or the guest said no: the room is left for today. */}
      {stayover && (
        <div className="mt-3">
          <SkipStayover task={task} onSkip={skip} disabled={busy} />
        </div>
      )}
      {/* A broken tap, a stain, something left behind: straight to the manager. */}
      <div className="mt-4 border-t border-sand-300 pt-3 text-center">
        <ReportIssue task={task} />
      </div>
    </div>
  );
}

const MAX_PHOTO_MB = 5;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Sending a room back: which task failed, and what needs fixing. Used by the
 * inspector's card and the manager's board. `onSubmit({ failedTasks, failureReason })`
 * saves it; `onCancel` closes the form.
 * `withPhoto` adds an optional photo of what is wrong (the inspector's card):
 * `onSubmit` then also gets `photo`, a File, when one was taken.
 */
export function RejectForm({ busy, withPhoto = false, onSubmit, onCancel }) {
  const [failed, setFailed] = useState([]);
  const [reason, setReason] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const photoId = useId();

  const toggleFailed = (type) => setFailed((f) => (f.includes(type) ? f.filter((t) => t !== type) : [...f, type]));

  const choosePhoto = (e) => {
    const file = e.target.files?.[0] || null;
    let problem = '';
    if (file && !PHOTO_TYPES.includes(file.type)) problem = 'That file is not a photo this app can take. Use the camera, or a JPG or PNG picture.';
    else if (file && file.size > MAX_PHOTO_MB * 1024 * 1024) problem = `That photo is larger than ${MAX_PHOTO_MB} MB. Take it again a little further back, or send the room back without it.`;
    if (problem) e.target.value = '';
    setPhotoError(problem);
    setPhoto(problem ? null : file);
  };

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-red-500/40 bg-red-500/5 p-4">
      <p className="text-sm font-medium text-ink-800">Which task failed?</p>
      <div className="flex gap-3">
        {['Bedding', 'Toiletry'].map((type) => (
          <label key={type} className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border py-3 text-sm ${failed.includes(type) ? 'border-red-400 bg-red-500/10 text-red-800' : 'border-sand-400 text-ink-700'}`}>
            <input type="checkbox" className="accent-red-400" checked={failed.includes(type)} onChange={() => toggleFailed(type)} />
            {type}
          </label>
        ))}
      </div>
      {/* The cleaner's own checklist, so the note can name exactly what was missed. */}
      {failed.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {failed.flatMap((type) => TASK_CHECKLIST[type] || []).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setReason((r) => (r.trim() ? `${r.trim()}, ${item.toLowerCase()}` : item))}
              className="rounded-full border border-sand-400 px-3 py-1 text-xs text-ink-700 hover:border-red-400"
            >
              + {item}
            </button>
          ))}
        </div>
      )}
      <textarea
        rows={3}
        className="input-field text-sm"
        aria-label="What needs fixing"
        placeholder="What needs fixing? (required)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {withPhoto && (
        <div>
          <label className="label" htmlFor={photoId}>Photo of what is wrong (optional)</label>
          {/* On a phone this opens the camera. The housekeeper redoing the room can open the photo. */}
          <input
            id={photoId}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={choosePhoto}
            className="block w-full text-sm text-ink-700 file:mr-3 file:rounded-lg file:border-0 file:bg-sand-300 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-ink-900"
          />
          {photo && <p className="mt-1 text-xs text-ink-500">Photo attached. The housekeeper will be able to see it.</p>}
          {photoError && <p role="alert" className="mt-1 text-sm text-red-700">{photoError}</p>}
        </div>
      )}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-sand-400 py-3 text-sm text-ink-700">
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || failed.length === 0 || reason.trim().length < 3}
          onClick={() => onSubmit({ failedTasks: failed, failureReason: reason, ...(photo ? { photo } : {}) })}
          className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Send back
        </button>
      </div>
    </div>
  );
}

export function InspectionCard({ task, onAction, busy }) {
  const [rejecting, setRejecting] = useState(false);
  const ready = task.job_status === 'Inspection';

  const submitReject = async ({ failedTasks, failureReason, photo }) => {
    let body = { failedTasks, failureReason };
    if (photo) {
      // A photo cannot travel as JSON, so the same fields go as a form.
      body = new FormData();
      failedTasks.forEach((type) => body.append('failedTasks', type));
      body.append('failureReason', failureReason);
      body.append('photo', photo);
    }
    if (await onAction(task, 'reject', body)) setRejecting(false);
  };

  return (
    <div className={`card p-5 ${ready ? 'border-gold-500/60' : 'opacity-75'}`}>
      <RoomHeader task={task} />
      <JobNote source={task.job_source} notes={task.job_notes} />

      <div className="mt-3 space-y-1.5">
        {(task.cleaning_tasks || []).map((c) => (
          <div key={c.id} className="flex items-center justify-between text-sm">
            <span className="text-ink-500">
              {c.type} <span className="text-ink-300">· {c.assigned_staff_name || 'unassigned'}</span>
            </span>
            <span className="flex items-center gap-2">
              {c.end_time && <span className="text-xs text-ink-400">{fmtTime(c.start_time)}–{fmtTime(c.end_time)}</span>}
              <Badge className={TASK_STATUS_STYLE[c.status]}>{taskStatusLabel(c.status)}</Badge>
            </span>
          </div>
        ))}
      </div>

      {!ready && (
        <p className="mt-4 text-sm text-ink-400">
          <Badge className={JOB_STATUS_STYLE[task.job_status]}>{task.job_status}</Badge>
          <span className="ml-2">Waiting for cleaning to finish</span>
        </p>
      )}

      {ready && !rejecting && (
        <div className="mt-4 flex gap-3">
          <button disabled={busy} onClick={() => setRejecting(true)} className="flex-1 rounded-xl border border-red-500/60 py-3 font-semibold text-red-700 disabled:opacity-50">
            <ActionLabel action="reject" />
          </button>
          <button disabled={busy} onClick={() => onAction(task, 'approve')} className="flex-1 rounded-xl bg-green-700 py-3 font-semibold text-white disabled:opacity-50">
            <ActionLabel action="approve" />
          </button>
        </div>
      )}

      {ready && rejecting && <RejectForm busy={busy} withPhoto onSubmit={submitReject} onCancel={() => setRejecting(false)} />}
      {/* Rejecting is for cleaning that needs redoing; this is for what cleaning can't fix. */}
      {ready && (
        <div className="mt-4 border-t border-sand-300 pt-3 text-center">
          <ReportIssue task={task} />
        </div>
      )}
    </div>
  );
}
