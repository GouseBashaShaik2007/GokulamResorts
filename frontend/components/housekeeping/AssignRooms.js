'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { errMsg } from '@/lib/bookingUi';
import { JOB_STATUS_STYLE, TASK_STATUS_STYLE } from '@/lib/cleaningStyles';
import { useToast } from '@/components/ui/Toast';
import { RoomHeader } from './TaskCards';
import { Badge, TASK_ROLES } from './shared';

// A task nobody is on yet (and that still has to be done).
const unassigned = (task) => task && !task.assigned_staff_id && task.status !== 'Completed';

/** Whether a job still has a task with nobody on it. */
export const needsSomeone = (job) => TASK_ROLES.some(({ type }) => unassigned(job.tasks?.[type]));

function AssignCard({ job, team, onChanged }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const assign = async (field, value) => {
    setBusy(true);
    try {
      await api.put(`/staff/jobs/${job.id}/assign`, { [field]: value ? Number(value) : null });
    } catch (err) {
      toast(errMsg(err, 'That did not save. Please try again.'), { tone: 'error', duration: 6000 });
    } finally {
      await onChanged();
      setBusy(false);
    }
  };

  return (
    <div className="card p-5">
      <RoomHeader task={{ ...job, job_reason: job.reason }} />
      {job.notes && <p className="mt-2 text-sm italic text-ink-500">Note: {job.notes}</p>}
      <p className="mt-3">
        <Badge className={JOB_STATUS_STYLE[job.status]}>{job.status}</Badge>
      </p>

      <div className="mt-4 space-y-3">
        {TASK_ROLES.map(({ type, role, field }) => {
          const task = job.tasks?.[type];
          if (!task) return null;
          const people = team.filter((s) => s.role === role);
          // Someone since deactivated keeps their place until the task is given to another.
          const gone = task.assigned_staff_id && !people.some((s) => s.id === task.assigned_staff_id);
          return (
            <div key={type}>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={`assign-${job.id}-${type}`} className="text-sm font-medium text-ink-700">{type}</label>
                <Badge className={TASK_STATUS_STYLE[task.status]}>{task.status === 'InProgress' ? 'In progress' : task.status}</Badge>
              </div>
              <select
                id={`assign-${job.id}-${type}`}
                className="input-field mt-1 py-3 text-base"
                value={task.assigned_staff_id || ''}
                disabled={busy || task.status === 'Completed'}
                onChange={(e) => assign(field, e.target.value)}
              >
                <option value="">{people.length === 0 ? 'No one with this role' : 'Nobody yet'}</option>
                {gone && <option value={task.assigned_staff_id}>{task.assigned_staff_name}</option>}
                {people.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The inspector's view of every room being cleaned: who is on the bedding,
 * the toiletries and the inspection, with a picker to change each. `jobs`:
 * open cleaning jobs with their tasks; `team`: active housekeeping staff;
 * `onChanged` reloads both.
 */
export default function AssignRooms({ jobs, team, onChanged }) {
  if (jobs.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-lg text-ink-800">Nothing to assign</p>
        <p className="mt-1 text-sm text-ink-400">Rooms appear here when a guest checks out or a manager marks a room dirty.</p>
      </div>
    );
  }

  // Rooms still waiting for someone first; each group keeps the server's priority order.
  const groups = [
    { title: 'Needs someone', list: jobs.filter(needsSomeone) },
    { title: 'Assigned', list: jobs.filter((j) => !needsSomeone(j)) },
  ];

  return groups.map(({ title, list }) =>
    list.length === 0 ? null : (
      <section key={title} className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">
          {title} ({list.length})
        </h2>
        <div className="space-y-4">
          {list.map((job) => <AssignCard key={job.id} job={job} team={team} onChanged={onChanged} />)}
        </div>
      </section>
    )
  );
}
