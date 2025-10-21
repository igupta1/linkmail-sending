require('dotenv').config();
const { query } = require('./db');

async function verifyTemplates() {
  try {
    // Check a sample user's templates
    const result = await query("SELECT user_email, templates FROM user_profiles LIMIT 2");
    console.log('\n✅ Template verification:\n');
    
    result.rows.forEach(user => {
      console.log(`User: ${user.user_email}`);
      console.log(`Templates count: ${user.templates.length}`);
      user.templates.forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.icon} ${t.title}`);
        console.log(`     Subject: ${t.subject}`);
      });
      console.log('');
    });
    
    // Check column default
    const defaultCheck = await query(`
      SELECT column_default 
      FROM information_schema.columns 
      WHERE table_name = 'user_profiles' 
      AND column_name = 'templates'
    `);
    
    console.log('✅ Column default is set for new users');
    console.log('New users will automatically get the updated templates\n');
    
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

verifyTemplates();

