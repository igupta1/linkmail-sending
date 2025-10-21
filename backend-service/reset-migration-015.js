require('dotenv').config();
const { query } = require('./db');

async function resetMigration() {
  try {
    await query("DELETE FROM schema_migrations WHERE filename = '015_reset_all_templates_to_defaults.sql'");
    console.log('✅ Removed migration record for 015_reset_all_templates_to_defaults.sql');
    console.log('Migration 015 can now be re-run with your updated templates');
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

resetMigration();

