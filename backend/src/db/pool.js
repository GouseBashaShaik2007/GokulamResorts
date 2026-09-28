const { Pool, types } = require('pg');

// Return DATE columns as 'YYYY-MM-DD' strings. The default (a JS Date at the
// server's local midnight) shifts booking dates when the server's timezone
// differs from the resort's.
types.setTypeParser(1082, (value) => value);

// A single shared connection pool for the whole app.
// Uses DATABASE_URL if present, otherwise falls back to discrete PG* vars
// which `pg` reads automatically from process.env.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  // Unexpected errors on idle clients — log and let the process supervisor restart if needed.
  console.error('Unexpected PostgreSQL pool error:', err);
});

/**
 * Run a query using the shared pool.
 * @param {string} text
 * @param {any[]} params
 */
function query(text, params) {
  return pool.query(text, params);
}

/**
 * Run a set of queries inside a single transaction.
 * `fn` receives a connected client and must use it for every query.
 * @param {(client: import('pg').PoolClient) => Promise<any>} fn
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
