'use client';

import { useState } from 'react';
import api from '../../../lib/api';
import { useConfirm } from '@/components/ui/Confirm';
import { errMsg } from '../../../lib/bookingUi';
import { JOB_STATUS_STYLE, PRIORITY_STYLE, TASK_STATUS_STYLE } from '../../../lib/cleaningStyles';
import { RejectForm } from '../../housekeeping/TaskCards';
import { Badge, PRIORITIES, TASK_ROLES, fmtTime } from '../../housekeeping/shared';

/**
 * One room's cleaning job: its priority, and who does each of its three tasks.
 * The manager can also decide it in the inspector's place: approve or send
 * back a cleaned room, or mark a room ready that was never cleaned in the app.
 */
export default function JobCard({ job, staff, onChanged, onError }) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const ask = useConfirm();
  const finished = job.status === 'Ready';
  const cleaned = job.status === 'Inspection';

  const assign = async (field, value) => {
    setBusy(true);
    try {
      await api.put(`/admin/cleaning/jobs/${job.id}/assign`, { [field]: value ? Number(value) : null });
      onChanged();
    } catch (err) {
      onError(errMsg(err, 'Could not assign staff'));
    } finally {
      setBusy(false);
    }
  };

  const setPriority = async (priority) => {
    try {
      await api.patch(`/admin/cleaning/jobs/${job.id}/priority`, { priority });
      onChanged();
    } catch (err) {
      onError(errMsg(err, 'Could not change priority'));
    }
  };

  // approve | reject, as the manager. Resolves true when it saved.
  const decide = async (action, body, failMessage) => {
    setBusy(true);
    try {
      await api.post(`/admin/cleaning/jobs/${job.id}/${action}`, body);
      return true;
    } catch (err) {
      onError(errMsg(err, failMessage));
      return false;
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  const reject = async (body) => {
    if (await decide('reject', body, 'Could not send the room back')) setRejecting(false);
  };

  const markReady = async () => {
    const ok = await ask({
      title: `Mark room ${job.unit_number} ready?`,
      body: 'Cleaning has not finished and nobody has inspected this room. It becomes ready for guests straight away and leaves the housekeepers’ lists.',
      confirmLabel: 'Mark ready',
      danger: true,
    });
    if (ok) decide('approve', { force: true }, 'Could not mark the room ready');
  };

  const rejection = job.last_inspection?.result === 'rejected' && job.status === 'Cleaning' ? job.last_inspection : null;

  return (
    <div className={`card p-5 ${finished ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-serif text-xl font-bold text-ink-900">Room {job.unit_number}</p>
          <p className="text-xs text-ink-400">
            {job.room_type} · {job.reason === 'manual' ? 'Marked dirty' : job.source === 'nightly' ? 'Checkout (11 PM safety net)' : 'Checkout'} ·{' '}
            {String(job.job_date).slice(0, 10)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {finished ? (
            <Badge className={PRIORITY_STYLE[job.priority]}>{job.priority}</Badge>
          ) : (
            // The caret says "this can be changed" — without it the control reads as a plain label.
            <span className="relative inline-flex items-center">
              <select
                value={job.priority}
                onChange={(e) => setPriority(e.target.value)}
                className={`appearance-none rounded-full border border-sand-400 py-0.5 pl-2.5 pr-6 text-xs font-medium ${PRIORITY_STYLE[job.priority]}`}
                aria-label="Priority"
              >
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <span className="pointer-events-none absolute right-2 text-[10px]" aria-hidden="true">▾</span>
            </span>
          )}
          <Badge className={JOB_STATUS_STYLE[job.status]}>{job.status}</Badge>
        </div>
      </div>

      {job.notes && <p className="mt-2 text-xs italic text-ink-500">Note: {job.notes}</p>}
      {rejection && (
        <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700">
          Rejected ({rejection.failed_tasks.join(' + ')}): {rejection.failure_reason}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {TASK_ROLES.map(({ type, role, field }) => {
          const task = job.tasks?.[type];
          if (!task) return null;
          const options = staff.filter((s) => s.role === role && (s.is_active || s.id === task.assigned_staff_id));
          return (
            <div key={type} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2 text-sm">
              <span className="text-ink-500">{type}</span>
              <select
                className="input-field py-1.5 text-sm"
                aria-label={`${type}: assigned to`}
                value={task.assigned_staff_id || ''}
                disabled={busy || finished || task.status === 'Completed'}
                onChange={(e) => assign(field, e.target.value)}
              >
                <option value="">— Unassigned —</option>
                {options.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <span className="flex flex-col items-end gap-0.5">
                <Badge className={TASK_STATUS_STYLE[task.status]}>{task.status}</Badge>
                {(task.start_time || task.end_time) && (
                  <span className="text-[10px] text-ink-400">
                    {fmtTime(task.start_time)} → {fmtTime(task.end_time)}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {cleaned && !rejecting && (
        <div className="mt-4 flex gap-2 border-t border-sand-300 pt-4">
          <button type="button" disabled={busy} onClick={() => setRejecting(true)} className="flex-1 rounded-xl border border-red-500/60 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
            Send back
          </button>
          <button type="button" disabled={busy} onClick={() => decide('approve', {}, 'Could not approve the room')} className="flex-1 rounded-xl bg-green-700 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Approve: room ready
          </button>
        </div>
      )}
      {cleaned && rejecting && <RejectForm busy={busy} onSubmit={reject} onCancel={() => setRejecting(false)} />}
      {!finished && !cleaned && (
        <p className="mt-4 border-t border-sand-300 pt-3 text-right">
          <button type="button" disabled={busy} onClick={markReady} className="text-xs text-ink-500 underline disabled:opacity-50">
            Mark ready without inspection…
          </button>
        </p>
      )}
    </div>
  );
}
