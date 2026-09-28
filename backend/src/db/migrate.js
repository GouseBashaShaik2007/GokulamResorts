/**
 * Applies database changes. Usage: npm run db:migrate
 *
 * 1. Every file in migrations/ not yet recorded in `schema_migrations` runs
 *    once, in name order, each in its own transaction. Use these for one-time
 *    changes (drops, data fixes, constraint swaps).
 * 2. schema.sql then runs every time. It must stay idempotent
 *    (CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT EXISTS).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function migrate() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name        VARCHAR(200) PRIMARY KEY,
       applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
     )`
  );

  const dir = path.join(__dirname, 'migrations');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort() : [];
  const { rows } = await pool.query(`SELECT name FROM schema_migrations`);
  const applied = new Set(rows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    const client = await pool.connect();
    try {
      console.log(`Applying migration ${file} ...`);
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
      await client.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  console.log('Applying schema.sql ...');
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  console.log('Migration complete.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
