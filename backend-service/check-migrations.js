require('dotenv').config();
const { query } = require('./db');

async function checkMigrations() {
  try {
    const result = await query("SELECT filename, applied_at FROM schema_migrations WHERE filename LIKE '014%' OR filename LIKE '015%' ORDER BY applied_at DESC");
    console.log('Applied migrations:');
    result.rows.forEach(m => console.log('  -', m.filename, 'at', m.applied_at));
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

checkMigrations();

