require('dotenv').config();
const { query } = require('./db');

async function resetMigration() {
  try {
    // Delete the migration record for 014 so it can re-run
    await query("DELETE FROM schema_migrations WHERE filename = '014_add_default_templates.sql'");
    console.log('✅ Removed migration record for 014_add_default_templates.sql');
    console.log('Migration 014 can now be re-run with your updated templates');
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

resetMigration();

