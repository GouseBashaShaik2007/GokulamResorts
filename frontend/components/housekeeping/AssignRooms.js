'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { errMsg } from '@/lib/bookingUi';
import { JOB_STATUS_STYLE, TASK_STATUS_STYLE } from '@/lib/cleaningStyles';
import { stayoverStatus } from '@/lib/stayovers';
import { useToast } from '@/components/ui/Toast';
import { JobNote, RoomHeader } from './TaskCards';
import { Badge, StayoverEnded, TASK_ROLES, taskStatusLabel } from './shared';

// A task nobody is on yet (and that still has to be done).
const unassigned = (task) => task && !task.assigned_staff_id && task.status !== 'Completed';

/** Whether a job still has a task with nobody on it. */
export const needsSomeone = (job) => TASK_ROLES.some(({ type }) => unassigned(job.tasks?.[type]));

function AssignCard({ job, team, onChanged }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  // A stayover is shown in its own words: its room is occupied, not "Dirty".
  const status = job.reason === 'stayover' ? stayoverStatus(job) : { label: job.status, style: JOB_STATUS_STYLE[job.status] };

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
      <JobNote source={job.source} notes={job.notes} />
      <p className="mt-3">
        <Badge className={status.style}>{status.label}</Badge>
      </p>

      {/* One picker per task the job has: a stayover has no inspection, so no inspector. */}
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
                <Badge className={TASK_STATUS_STYLE[task.status]}>{taskStatusLabel(task.status)}</Badge>
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

// Today's stayovers that are over: which rooms were serviced, and which were
// not and why ("Do not disturb", the guest said no ...).
function StayoversDone({ jobs }) {
  if (jobs.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">
        Stayovers finished today ({jobs.length})
      </h2>
      <ul className="card divide-y divide-sand-300 px-5">
        {jobs.map((job) => (
          <li key={job.id} className="flex items-baseline gap-4 py-3">
            <span className="w-14 flex-none font-serif text-xl font-bold text-ink-900">{job.unit_number}</span>
            <StayoverEnded job={job} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The inspector's view of every room being cleaned: who is on the bedding,
 * the toiletries and the inspection, with a picker to change each. A stayover
 * (the guest is staying) is marked as one and has bedding and toiletries only.
 * `jobs`: open cleaning jobs with their tasks; `team`: active housekeeping
 * staff; `stayoversDone`: today's finished stayovers, listed with how each
 * one ended; `onChanged` reloads them all.
 */
export default function AssignRooms({ jobs, team, stayoversDone = [], onChanged }) {
  if (jobs.length === 0) {
    return (
      <>
        <div className="card mb-8 p-8 text-center">
          <p className="text-lg text-ink-800">Nothing to assign</p>
          <p className="mt-1 text-sm text-ink-400">
            Rooms appear here when a guest checks out, when a manager marks a room dirty, and each morning for the rooms whose guests are staying.
          </p>
        </div>
        <StayoversDone jobs={stayoversDone} />
      </>
    );
  }

  // Rooms still waiting for someone first; each group keeps the server's priority order.
  const groups = [
    { title: 'Needs someone', list: jobs.filter(needsSomeone) },
    { title: 'Assigned', list: jobs.filter((j) => !needsSomeone(j)) },
  ];

  return (
    <>
      {groups.map(({ title, list }) =>
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
      )}
      <StayoversDone jobs={stayoversDone} />
    </>
  );
}
