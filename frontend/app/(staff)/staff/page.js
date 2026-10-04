'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api, { TOKEN_KEYS, withStaffAuth } from '@/lib/api';
import useCleaningSocket, { LiveBadge } from '@/lib/useCleaningSocket';
import { errMsg } from '@/lib/bookingUi';
import { useToast } from '@/components/ui/Toast';
import { JOB_STATUS_STYLE, PRIORITY_STYLE, TASK_STATUS_STYLE } from '@/lib/cleaningStyles';
import { TASK_CHECKLIST, useChecklist } from '@/lib/cleaningChecklists';
import StaffSkeleton from '../_components/StaffSkeleton';
import { clearSignedIn } from '../_lib/session';

const TOKEN_KEY = TOKEN_KEYS.staff;
const STAFF_KEY = 'gokulam_staff_profile';

const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');
const REASON_LABEL = { checkout: 'Checkout clean', manual: 'Marked dirty' };

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

function Badge({ className, children }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
}

function RoomHeader({ task }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="font-serif text-3xl font-bold text-navy-50">{task.unit_number}</p>
        <p className="text-xs text-navy-400">
          {task.room_type}
          {task.floor ? ` · Floor ${task.floor}` : ''} · {REASON_LABEL[task.job_reason]}
        </p>
      </div>
      <Badge className={PRIORITY_STYLE[task.priority]}>{task.priority}</Badge>
    </div>
  );
}

// Bedding / toiletry: Start → Pause ⇄ Resume → tick the checklist → Complete
function CleaningTaskCard({ task, onAction, busy }) {
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

function InspectionCard({ task, onAction, busy }) {
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

function TaskBoard({ staff, onLogout }) {
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState(null); // the task being saved
  const [error, setError] = useState('');
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const res = await api.get('/staff/tasks', withStaffAuth());
      setTasks(res.data.tasks);
      setLoaded(true);
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) onLogout();
      else setError('Could not load your tasks.');
    }
  }, [onLogout]);

  useEffect(() => {
    load();
  }, [load]);
  const live = useCleaningSocket(TOKEN_KEY, load);

  const act = async (task, action, body) => {
    setBusyId(task.id);
    setError('');
    try {
      await api.post(`/staff/tasks/${task.id}/${action}`, body || {}, withStaffAuth());
      await load();
      return true;
    } catch (err) {
      // Shown over whatever card they are on — the top of the list may be scrolled away.
      toast(errMsg(err, 'That did not save. Please try again.'), { tone: 'error', duration: 6000 });
      load();
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const isInspector = staff.role === 'Inspector';
  // Inspectors: rooms ready to inspect first; each group keeps the server's priority order.
  const groups = isInspector
    ? [
        ['Ready to inspect', tasks.filter((t) => t.job_status === 'Inspection')],
        ['Being cleaned', tasks.filter((t) => t.job_status !== 'Inspection')],
      ]
    : [['My rooms', tasks]];

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">{staff.role === 'Inspector' ? 'Inspector' : `${staff.role} team`}</p>
          <h1 className="font-serif text-2xl font-bold text-navy-50">Hi, {staff.name.split(' ')[0]}</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <LiveBadge live={live} />
          <button onClick={onLogout} className="text-xs text-navy-300 underline">Log out</button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loaded && tasks.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-lg text-navy-100">All clear ✨</p>
          <p className="mt-1 text-sm text-navy-400">No rooms assigned to you right now.</p>
        </div>
      )}

      {groups.map(([title, list]) =>
        list.length === 0 ? null : (
          <section key={title} className="mb-8">
            {isInspector && (
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-navy-300">
                {title} ({list.length})
              </h2>
            )}
            <div className="space-y-4">
              {list.map((task) =>
                isInspector ? (
                  <InspectionCard key={task.id} task={task} onAction={act} busy={busyId === task.id} />
                ) : (
                  <CleaningTaskCard key={task.id} task={task} onAction={act} busy={busyId === task.id} />
                )
              )}
            </div>
          </section>
        )
      )}
    </div>
  );
}

export default function StaffPage() {
  const router = useRouter();
  const [staff, setStaff] = useState(null);

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(STAFF_KEY);
    clearSignedIn('staff');
    router.replace('/staff/login');
  }, [router]);

  useEffect(() => {
    // middleware.js already redirected here if the session cookie was
    // missing; this covers a token that expired without a full navigation,
    // plus the FrontDesk role landing on the wrong board.
    try {
      if (!window.localStorage.getItem(TOKEN_KEY)) {
        logout();
        return;
      }
      const profile = JSON.parse(window.localStorage.getItem(STAFF_KEY) || 'null');
      if (profile?.role === 'FrontDesk') {
        router.replace('/frontdesk');
        return;
      }
      setStaff(profile);
    } catch {
      logout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!staff) return <StaffSkeleton />;
  return <TaskBoard staff={staff} onLogout={logout} />;
}
