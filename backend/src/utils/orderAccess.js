// Food ordering is for people at the resort. Every ordering link printed as a
// QR code (one per table, one for the counter) carries a short key, and an
// order is only accepted with the key that matches its table. The page still
// lives on the public site, but an address typed or guessed from home has no key.
//
// Keys are derived from a server secret, so nothing is stored: the admin QR
// page asks for them, and they can all be replaced at once by changing
// ORDER_LINK_SECRET (old printed codes then stop working).
const crypto = require('crypto');
const { query } = require('../db/pool');

const secret = () => process.env.ORDER_LINK_SECRET || process.env.JWT_SECRET;

function keyFor(scope) {
  return crypto.createHmac('sha256', secret()).update(`order-link:${scope}`).digest('base64url').slice(0, 12);
}

const tableKey = (tableNumber) => keyFor(`table:${Number(tableNumber)}`);
const counterKey = () => keyFor('counter');

function matches(expected, given) {
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// How many tables have a QR code (Admin -> QR Codes).
async function tableCount() {
  const { rows } = await query('SELECT table_count FROM resort_settings WHERE id = 1');
  return rows[0]?.table_count || 0;
}

/** True when `key` is the one printed on that table's card and the table exists. */
async function isValidTableKey(tableNumber, key) {
  const n = Number(tableNumber);
  if (!Number.isInteger(n) || n < 1 || n > (await tableCount())) return false;
  return matches(tableKey(n), key);
}

const isValidCounterKey = (key) => matches(counterKey(), key);

module.exports = { tableKey, counterKey, tableCount, isValidTableKey, isValidCounterKey };
