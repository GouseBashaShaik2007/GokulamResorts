import { JOB_STATUS_STYLE, TASK_STATUS_STYLE } from './cleaningStyles';

// Stayovers: the daily service of a room whose guest is staying on — bed made,
// toiletries refilled, toilet cleaned. Two tasks (Bedding and Toiletry), nobody
// inspects it, and the room stays "occupied" throughout. The lists and words
// the housekeeping screens share for them.

// What "done" means for each stayover task: the list a housekeeper ticks off.
// Shorter than the check-out lists in cleaningChecklists.js — the guest's own
// things stay where they are.
//
// TODO(owner): a starting point — edit these to match what the resort does for
// a guest who is staying.
export const STAYOVER_CHECKLIST = {
  Bedding: ['Bed made', 'Room tidied', 'Fresh towels, if the guest asked'],
  Toiletry: ['Soap, shampoo and drinking water refilled', 'Toilet and basin cleaned', 'Bin emptied'],
};

// Why a housekeeper closed a stayover at the door without servicing the room.
// The values are the ones the API accepts; keep in step with SKIP_REASONS in
// backend/src/services/cleaning.service.js.
export const SKIP_REASONS = [
  { value: 'dnd', label: 'Do not disturb' },
  { value: 'refused', label: 'Guest said no' },
  { value: 'other', label: 'Other' },
];

// How a finished stayover ended: `closed_as` from the API, or nothing at all
// when the room was serviced.
const ENDED = {
  serviced: { label: 'Serviced', style: TASK_STATUS_STYLE.Completed },
  dnd: { label: 'Do not disturb', style: TASK_STATUS_STYLE.Paused },
  refused: { label: 'Guest said no', style: TASK_STATUS_STYLE.Paused },
  other: { label: 'Other', style: TASK_STATUS_STYLE.Paused },
  not_done: { label: 'Not done', style: TASK_STATUS_STYLE.Failed },
};

/**
 * Where a stayover stands, as { label, style } for a badge. "Dirty" and
 * "Ready" describe a room waiting for its next guest, so a stayover gets words
 * of its own: To service, Being serviced, then how it ended.
 */
export function stayoverStatus(job) {
  if (job.status === 'Ready') return ENDED[job.closed_as || 'serviced'] || ENDED.other;
  if (job.status === 'Cleaning') return { label: 'Being serviced', style: JOB_STATUS_STYLE.Cleaning };
  return { label: 'To service', style: TASK_STATUS_STYLE.Pending };
}
