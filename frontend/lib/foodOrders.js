// Shared rules for food orders: guest ordering, the kitchen display, admin.

// ---------- where an order is for ----------
//
// An ordering context says which QR code opened the page:
//   { type: 'table', tableId, accessKey }   a table's
//   { type: 'room', roomId, accessKey }     a hotel room's — the food is brought to the room
//   { type: 'counter', accessKey }          the one at the restaurant counter
// The fourth kind of order, 'kiosk', never comes from these screens: the
// restaurant's kiosk tablet has its own (see lib/kiosk.js).

/** A table number from an address (/order/7), or null if it isn't one. */
export const tableNumber = (raw) => (/^[1-9][0-9]{0,2}$/.test(String(raw ?? '')) ? Number(raw) : null);

/** A room number from an address (/order/room/101, /order/room/V1), or null if it cannot be one. */
export const roomNumber = (raw) => (/^[A-Za-z0-9-]{1,20}$/.test(String(raw ?? '')) ? String(raw).toUpperCase() : null);

export const ORDER_TYPE_FOR_API = { table: 'table', counter: 'counter', room: 'room' };

/** How staff read an order's type, from the API's value. */
export const ORDER_TYPE_LABEL = { table: 'Table', room: 'Room', counter: 'Counter', kiosk: 'Kiosk' };

/**
 * Who an order is for, as staff say it: "Table 7", "Room 101", the name a
 * counter order was placed under, or — for the kiosk, which takes no names —
 * "Order 47", the number the customer is waiting to hear.
 */
export const orderTitle = (order) => {
  if (order.table_number) return `Table ${order.table_number}`;
  if (order.room_number) return `Room ${order.room_number}`;
  return order.customer_name || `Order ${order.id}`;
};

/** Paid through the payment gateway (on the kiosk, or a room's "pay now"), as opposed to in person. */
export const paidOnline = (order) => order.payment_method === 'online';

/** The ordering screen for a context: /order/7?k=…, /order/room/101?k=… or /order?k=… */
export const orderingPath = (ctx) => (ctx.type === 'table' ? `/order/${ctx.tableId}` : ctx.type === 'room' ? `/order/room/${ctx.roomId}` : '/order');
export const orderingHref = (ctx) => `${orderingPath(ctx)}${ctx.accessKey ? `?k=${encodeURIComponent(ctx.accessKey)}` : ''}`;

/** One order's own page. `token`: the order's private token. The QR key travels along so "Order more" works. */
export const orderHref = (ctx, token) => `${orderingPath(ctx)}/confirmation?${new URLSearchParams({ order: token, k: ctx.accessKey || '' })}`;

/** The name this context's cart and order list are kept under on the device. */
export const orderingKey = (ctx) => (ctx.type === 'table' ? `table-${ctx.tableId}` : ctx.type === 'room' ? `room-${ctx.roomId}` : 'counter');

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
/** One stage of an order in the guest's words. A room's order is brought to the door, so its last two stages read differently. */
export const guestStatusLabel = (order, stage = order.status) =>
  order.room_number && stage === 'ready' ? 'On its way' : order.room_number && stage === 'served' ? 'Delivered' : GUEST_ORDER_STATUS[stage] || stage;
export const ORDER_STAGES = ['new', 'preparing', 'ready', 'served'];
export const FINAL_ORDER_STATUSES = ['served', 'cancelled'];
