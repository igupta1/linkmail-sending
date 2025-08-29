/* Simple SQL migration runner.
 * - Looks for .sql files in db/migrations, sorted by filename
 * - Tracks applied migrations in schema_migrations (filename + checksum)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('./index');

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query('SELECT filename, checksum FROM schema_migrations');
  const map = new Map();
  for (const row of rows) map.set(row.filename, row.checksum);
  return map;
}

async function applyMigration(client, filename, sql, checksum) {
  console.log(`\n[db:migrate] Applying: ${filename}`);
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)', [filename, checksum]);
    await client.query('COMMIT');
    console.log(`[db:migrate] Applied: ${filename}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[db:migrate] Failed: ${filename}`);
    throw err;
  }
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('[db:migrate] DATABASE_URL is not set. Aborting.');
    process.exit(1);
  }

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('[db:migrate] No migrations directory found, nothing to do.');
    process.exit(0);
  }

  const allFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (allFiles.length === 0) {
    console.log('[db:migrate] No .sql files found, nothing to do.');
    process.exit(0);
  }

  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    for (const file of allFiles) {
      const abs = path.join(migrationsDir, file);
      const sql = fs.readFileSync(abs, 'utf8');
      const checksum = sha256(sql);

      if (applied.has(file)) {
        const existing = applied.get(file);
        if (existing !== checksum) {
          throw new Error(`Checksum mismatch for migration ${file}. Refusing to proceed.`);
        }
        console.log(`[db:migrate] Skipping already applied: ${file}`);
        continue;
      }

      await applyMigration(client, file, sql, checksum);
    }

    console.log('\n[db:migrate] All migrations are up to date.');
  } catch (err) {
    console.error('[db:migrate] Error:', err.message || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();


