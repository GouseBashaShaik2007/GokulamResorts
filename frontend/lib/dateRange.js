// Pure date-math helpers for the calendar UI. Dates are handled as local
// midnight JS Date objects for grid building, and as YYYY-MM-DD strings
// (matching the rest of the app, see lib/bookingUi.js) at the API boundary.

export function fromISO(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isSameDay(a, b) {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isBefore(a, b) {
  return a.getTime() < b.getTime();
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

export function addDaysToDate(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export { WEEKDAY_LABELS };

/**
 * A 6x7 grid of {date, inMonth} for the given month, Sunday-first, padded
 * with the tail of the previous month and the head of the next so every row
 * is complete.
 */
export function buildMonthGrid(monthStart) {
  const firstWeekday = monthStart.getDay(); // 0=Sun
  const gridStart = addDaysToDate(monthStart, -firstWeekday);
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = addDaysToDate(gridStart, i);
    cells.push({ date, inMonth: date.getMonth() === monthStart.getMonth() });
  }
  return cells;
}

export function formatMonthLabel(date) {
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function formatShort(date) {
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// "Wed, 14 Oct → Fri, 16 Oct" from two YYYY-MM-DD strings.
export function formatRange(checkInISO, checkOutISO) {
  return `${formatShort(fromISO(checkInISO))} → ${formatShort(fromISO(checkOutISO))}`;
}
