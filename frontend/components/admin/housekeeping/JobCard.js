'use client';

import { useState } from 'react';
import api, { withAdminAuth } from '../../../lib/api';
import { errMsg } from '../../../lib/bookingUi';
import { JOB_STATUS_STYLE, PRIORITY_STYLE, TASK_STATUS_STYLE } from '../../../lib/cleaningStyles';
import { Badge, PRIORITIES, TASK_ROLES, fmtTime } from '../../housekeeping/shared';

/** One room's cleaning job: its priority, and who does each of its three tasks. */
export default function JobCard({ job, staff, onChanged, onError }) {
  const [busy, setBusy] = useState(false);
  const finished = job.status === 'Ready';

  const assign = async (field, value) => {
    setBusy(true);
    try {
      await api.put(`/admin/cleaning/jobs/${job.id}/assign`, { [field]: value ? Number(value) : null }, withAdminAuth());
      onChanged();
    } catch (err) {
      onError(errMsg(err, 'Could not assign staff'));
    } finally {
      setBusy(false);
    }
  };

  const setPriority = async (priority) => {
    try {
      await api.patch(`/admin/cleaning/jobs/${job.id}/priority`, { priority }, withAdminAuth());
      onChanged();
    } catch (err) {
      onError(errMsg(err, 'Could not change priority'));
    }
  };

  const rejection = job.last_inspection?.result === 'rejected' && job.status === 'Cleaning' ? job.last_inspection : null;

  return (
    <div className={`card p-5 ${finished ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-serif text-xl font-bold text-navy-50">Room {job.unit_number}</p>
          <p className="text-xs text-navy-400">
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
                className={`appearance-none rounded-full border border-navy-600 py-0.5 pl-2.5 pr-6 text-xs font-medium ${PRIORITY_STYLE[job.priority]}`}
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

      {job.notes && <p className="mt-2 text-xs italic text-navy-300">Note: {job.notes}</p>}
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
              <span className="text-navy-300">{type}</span>
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
                  <span className="text-[10px] text-navy-400">
                    {fmtTime(task.start_time)} → {fmtTime(task.end_time)}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
