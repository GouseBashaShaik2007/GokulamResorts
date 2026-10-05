// Small pieces shared by the housekeeping screens: the manager's cleaning board and the staff task list.
import { stayoverStatus } from '@/lib/stayovers';

export const PRIORITIES = ['VIP', 'High', 'Normal'];

// A cleaning job's three tasks, the staff role that does each, and the field
// the assign endpoint expects for it. (A stayover has the first two only:
// nobody inspects it.)
export const TASK_ROLES = [
  { type: 'Bedding', role: 'Bedding', field: 'beddingStaffId' },
  { type: 'Toiletry', role: 'Toiletry', field: 'toiletryStaffId' },
  { type: 'Inspection', role: 'Inspector', field: 'inspectorId' },
];

export const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');

// A task's status as the screens word it.
export const taskStatusLabel = (status) => (status === 'InProgress' ? 'In progress' : status === 'Skipped' ? 'Not done' : status);

export function Badge({ className, children }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
}

/**
 * How a finished stayover ended — serviced, do not disturb, the guest said
 * no, other, or not done — with the housekeeper's note and name when the room
 * was closed at the door. `job`: a finished stayover job.
 */
export function StayoverEnded({ job, className = '' }) {
  const ended = stayoverStatus(job);
  return (
    <p className={`text-sm text-ink-700 ${className}`}>
      <Badge className={ended.style}>{ended.label}</Badge>
      {job.closed_note && <span className="ml-2">{job.closed_note}</span>}
      {job.closed_by_name && <span className="ml-2 text-xs text-ink-400">({job.closed_by_name})</span>}
    </p>
  );
}
