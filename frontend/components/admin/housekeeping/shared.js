// Small pieces shared by the housekeeping admin screens.

export const PRIORITIES = ['VIP', 'High', 'Normal'];

// A cleaning job's three tasks, the staff role that does each, and the field
// the assign endpoint expects for it.
export const TASK_ROLES = [
  { type: 'Bedding', role: 'Bedding', field: 'beddingStaffId' },
  { type: 'Toiletry', role: 'Toiletry', field: 'toiletryStaffId' },
  { type: 'Inspection', role: 'Inspector', field: 'inspectorId' },
];

export const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');

export function Badge({ className, children }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
}
