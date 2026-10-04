'use client';

import { useState } from 'react';
import { JOB_STATUS_STYLE, PRIORITY_STYLE, TASK_STATUS_STYLE } from '@/lib/cleaningStyles';
import { TASK_CHECKLIST, useChecklist } from '@/lib/cleaningChecklists';
import { Badge, fmtTime } from './shared';

// The cards on a housekeeper's or inspector's screen: one per room.

// Why the room is on the list, said as what it means for the person cleaning it.
const REASON_LABEL = { checkout: 'Guest left: full clean', manual: 'Touch-up: see the note' };

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

function RoomHeader({ task }) {
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
          <p className="font-serif text-3xl font-bold text-navy-50">{task.unit_number}</p>
          <p className="text-xs text-navy-400">
            {task.room_type}
            {task.floor ? ` · Floor ${task.floor}` : ''} · {REASON_LABEL[task.job_reason]}
          </p>
        </div>
        {!band && <Badge className={PRIORITY_STYLE[task.priority]}>{task.priority}</Badge>}
      </div>
    </>
  );
}

// Bedding / toiletry: Start → Pause ⇄ Resume → tick the checklist → Complete
export function CleaningTaskCard({ task, onAction, busy }) {
  const big = 'flex-1 rounded-xl py-3 text-base font-semibold disabled:opacity-50';
  const checklist = TASK_CHECKLIST[task.type] || [];
  const [ticked, toggle, clearTicks] = useChecklist(task.id);
  const allDone = checklist.every((item) => ticked.includes(item));

  const complete = async () => {
    if (await onAction(task, 'complete')) clearTicks();
  };

  return (
    <div className="card p-5">
      <RoomHeader task={task} />
      {task.job_notes && <p className="mt-2 text-sm italic text-navy-300">Note: {task.job_notes}</p>}
      {task.failure_reason && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700">
          <span className="font-semibold">Redo — inspector said:</span> {task.failure_reason}
        </p>
      )}
      <div className="mt-3 flex items-center gap-2 text-xs text-navy-400">
        <Badge className={TASK_STATUS_STYLE[task.status]}>{task.status === 'InProgress' ? 'In progress' : task.status}</Badge>
        {task.start_time && <span>Started {fmtTime(task.start_time)}</span>}
      </div>

      {/* The standard for this task: every line ticked before it can be completed. */}
      {task.status === 'InProgress' && checklist.length > 0 && (
        <fieldset className="mt-4">
          <legend className="text-xs font-semibold uppercase tracking-wider text-navy-400">
            Checklist ({checklist.filter((item) => ticked.includes(item)).length} of {checklist.length})
          </legend>
          <div className="mt-2 space-y-2">
            {checklist.map((item) => (
              <label
                key={item}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-base ${ticked.includes(item) ? 'border-green-700/50 bg-green-500/10 text-navy-50' : 'border-navy-600 text-navy-100'}`}
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
        <p className="mt-2 text-center text-xs text-navy-400">Tick every line of the checklist to complete this room.</p>
      )}
    </div>
  );
}

export function InspectionCard({ task, onAction, busy }) {
  const [rejecting, setRejecting] = useState(false);
  const [failed, setFailed] = useState([]);
  const [reason, setReason] = useState('');
  const ready = task.job_status === 'Inspection';

  const toggleFailed = (type) => setFailed((f) => (f.includes(type) ? f.filter((t) => t !== type) : [...f, type]));

  const submitReject = async () => {
    const ok = await onAction(task, 'reject', { failedTasks: failed, failureReason: reason });
    if (ok) {
      setRejecting(false);
      setFailed([]);
      setReason('');
    }
  };

  return (
    <div className={`card p-5 ${ready ? 'border-gold-500/60' : 'opacity-75'}`}>
      <RoomHeader task={task} />
      {task.job_notes && <p className="mt-2 text-sm italic text-navy-300">Note: {task.job_notes}</p>}

      <div className="mt-3 space-y-1.5">
        {(task.cleaning_tasks || []).map((c) => (
          <div key={c.id} className="flex items-center justify-between text-sm">
            <span className="text-navy-300">
              {c.type} <span className="text-navy-500">· {c.assigned_staff_name || 'unassigned'}</span>
            </span>
            <span className="flex items-center gap-2">
              {c.end_time && <span className="text-xs text-navy-400">{fmtTime(c.start_time)}–{fmtTime(c.end_time)}</span>}
              <Badge className={TASK_STATUS_STYLE[c.status]}>{c.status === 'InProgress' ? 'In progress' : c.status}</Badge>
            </span>
          </div>
        ))}
      </div>

      {!ready && (
        <p className="mt-4 text-sm text-navy-400">
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

      {ready && rejecting && (
        <div className="mt-4 space-y-3 rounded-xl border border-red-500/40 bg-red-500/5 p-4">
          <p className="text-sm font-medium text-navy-100">Which task failed?</p>
          <div className="flex gap-3">
            {['Bedding', 'Toiletry'].map((type) => (
              <label key={type} className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border py-3 text-sm ${failed.includes(type) ? 'border-red-400 bg-red-500/10 text-red-800' : 'border-navy-600 text-navy-200'}`}>
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
                  className="rounded-full border border-navy-600 px-3 py-1 text-xs text-navy-200 hover:border-red-400"
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
          <div className="flex gap-3">
            <button onClick={() => setRejecting(false)} className="flex-1 rounded-xl border border-navy-600 py-3 text-sm text-navy-200">
              Cancel
            </button>
            <button
              disabled={busy || failed.length === 0 || reason.trim().length < 3}
              onClick={submitReject}
              className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Send back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
