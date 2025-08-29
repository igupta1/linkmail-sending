const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn('[db] DATABASE_URL is not set. Database features will be unavailable until this is configured.');
}

const shouldUseSSL =
  (process.env.PGSSLMODE && process.env.PGSSLMODE.toLowerCase() === 'require') ||
  (databaseUrl && /neon\.tech/.test(databaseUrl));

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: shouldUseSSL ? { rejectUnauthorized: false } : undefined
});

async function query(text, params) {
  const startTime = Date.now();
  const result = await pool.query(text, params);
  const durationMs = Date.now() - startTime;
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[db] query executed in ${durationMs}ms`, { rows: result.rowCount });
  }
  return result;
}

async function getClient() {
  return await pool.connect();
}

module.exports = {
  pool,
  query,
  getClient
};


