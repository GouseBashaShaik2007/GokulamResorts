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

// What a diner is told about a dish (set per dish in Admin → Menu). The values
// are the ones the API accepts; keep this list in step with ALLERGENS in
// backend/src/routes/admin.routes.js.
export const ALLERGENS = [
  { value: 'nuts', label: 'Nuts' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'gluten', label: 'Gluten' },
  { value: 'egg', label: 'Egg' },
  { value: 'shellfish', label: 'Shellfish' },
  { value: 'fish', label: 'Fish' },
  { value: 'soy', label: 'Soy' },
];

// A dish's usual heat: spice_rating 0 (not set / not spicy) to 3.
export const SPICE_RATING_LABEL = ['', 'Mild', 'Medium', 'Hot'];

/** "Nuts, Dairy" for a dish's allergens, in the order above; '' when none are listed. */
export function allergenText(item) {
  const listed = item?.allergens || [];
  return ALLERGENS.filter((a) => listed.includes(a.value)).map((a) => a.label).join(', ');
}
