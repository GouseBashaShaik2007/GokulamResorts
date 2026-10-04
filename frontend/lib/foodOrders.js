// Shared rules for food orders: guest ordering, the kitchen display, admin.

export const ORDER_STATUS_LABEL = {
  new: 'New',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  cancelled: 'Cancelled',
};

// The order an order moves through, and the step before each (for undo).
export const NEXT_ORDER_STATUS = { new: 'preparing', preparing: 'ready', ready: 'served' };
export const PREVIOUS_ORDER_STATUS = { preparing: 'new', ready: 'preparing', served: 'ready' };

// Allergies travel in the order's note, marked so the kitchen can show them as
// a warning instead of ordinary text. (There is no separate column for them
// yet; when one is added, only these two functions change.)
const ALLERGY_PREFIX = 'ALLERGY: ';
const SEPARATOR = ' · ';

export function composeOrderNotes({ allergy = '', notes = '' }) {
  const a = allergy.trim();
  const n = notes.trim();
  return [a ? `${ALLERGY_PREFIX}${a}` : '', n].filter(Boolean).join(SEPARATOR);
}

/** { allergy, notes } from a stored order note. */
export function splitOrderNotes(text) {
  const value = String(text || '');
  if (!value.startsWith(ALLERGY_PREFIX)) return { allergy: '', notes: value };
  const rest = value.slice(ALLERGY_PREFIX.length);
  const cut = rest.indexOf(SEPARATOR);
  return cut === -1 ? { allergy: rest, notes: '' } : { allergy: rest.slice(0, cut), notes: rest.slice(cut + SEPARATOR.length) };
}
