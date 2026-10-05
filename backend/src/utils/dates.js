// Resort-local calendar helpers. Booking dates are plain DATEs in the resort's
// timezone, so "today" must come from there, not from the server clock's zone.
const { query } = require('../db/pool');

const TIMEZONE = process.env.RESORT_TIMEZONE || process.env.CLEANING_TIMEZONE || 'Asia/Kolkata';

// Resort-local today as YYYY-MM-DD. Pass a transaction client to stay inside it.
async function localToday(client = { query }) {
  const { rows } = await client.query(`SELECT (now() AT TIME ZONE $1)::date::text AS d`, [TIMEZONE]);
  return rows[0].d;
}

// The hour of the day at the resort right now, 0-23: for work that starts
// "at 9" or "at 11" whatever zone the server's own clock is in.
async function localHour(client = { query }) {
  const { rows } = await client.query(`SELECT extract(hour FROM now() AT TIME ZONE $1)::int AS h`, [TIMEZONE]);
  return rows[0].h;
}

// pg returns DATE columns as JS Dates at local midnight; normalise to YYYY-MM-DD.
function isoDate(value) {
  if (!value) return value;
  if (typeof value === 'string') return value.slice(0, 10);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

module.exports = { TIMEZONE, localToday, localHour, isoDate, addDays };
