// Shared badge colours for the housekeeping admin board and staff screens.
export const JOB_STATUS_STYLE = {
  Dirty: 'bg-red-500/10 text-red-700',
  Cleaning: 'bg-blue-400/10 text-blue-700',
  Inspection: 'bg-gold-500/10 text-gold-600',
  Ready: 'bg-green-500/10 text-green-700',
};
export const TASK_STATUS_STYLE = {
  Pending: 'bg-sand-300 text-ink-700',
  InProgress: 'bg-blue-400/10 text-blue-700',
  Paused: 'bg-orange-400/10 text-orange-700',
  Completed: 'bg-green-500/10 text-green-700',
  Failed: 'bg-red-500/10 text-red-700',
  // A stayover task nobody did: the room was closed for the day without it.
  Skipped: 'bg-sand-300 text-ink-500',
};
export const PRIORITY_STYLE = {
  VIP: 'bg-gold-600 text-white',
  High: 'bg-red-500/20 text-red-700',
  Normal: 'bg-sand-300 text-ink-700',
};
