// Shared rules for food orders: guest ordering, the kitchen display, admin.

// ---------- where an order is for ----------
//
// An ordering context is { type: 'table', tableId, accessKey } for a table's
// QR code, or { type: 'counter', accessKey } for the one at the restaurant
// counter. (The API and the database call a counter order 'kiosk', its older
// name; ORDER_TYPE_FOR_API is the one place that word is used.)

/** A table number from an address (/order/7), or null if it isn't one. */
export const tableNumber = (raw) => (/^[1-9][0-9]{0,2}$/.test(String(raw ?? '')) ? Number(raw) : null);

export const ORDER_TYPE_FOR_API = { table: 'table', counter: 'kiosk' };

/** How staff read an order's type, from the API's value. */
export const ORDER_TYPE_LABEL = { table: 'Table', kiosk: 'Counter' };

/** The ordering screen for a context: /order/7?k=… or /order?k=… */
export const orderingPath = (ctx) => (ctx.type === 'table' ? `/order/${ctx.tableId}` : '/order');
export const orderingHref = (ctx) => `${orderingPath(ctx)}${ctx.accessKey ? `?k=${encodeURIComponent(ctx.accessKey)}` : ''}`;

/** One order's own page. `token`: the order's private token. The QR key travels along so "Order more" works. */
export const orderHref = (ctx, token) => `${orderingPath(ctx)}/confirmation?${new URLSearchParams({ order: token, k: ctx.accessKey || '' })}`;

/** The name this context's cart and order list are kept under on the device. */
export const orderingKey = (ctx) => (ctx.type === 'table' ? `table-${ctx.tableId}` : 'counter');

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

// How a guest reads each status (staff see ORDER_STATUS_LABEL above), the
// stages an order moves through, and the ones after which nothing changes.
export const GUEST_ORDER_STATUS = { new: 'Received', preparing: 'Preparing', ready: 'Ready', served: 'Served', cancelled: 'Cancelled' };
export const ORDER_STAGES = ['new', 'preparing', 'ready', 'served'];
export const FINAL_ORDER_STATUSES = ['served', 'cancelled'];
