// Quick script to check referrals for a user
require('dotenv').config();
const { query } = require('./db');

async function checkReferrals() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const referralCode = 'D8106561'; // Your referral code
  
  try {
    // Find your user ID
    const userSql = `SELECT user_id FROM user_profiles WHERE referral_code = $1`;
    const { rows: userRows } = await query(userSql, [referralCode]);
    
    if (userRows.length === 0) {
      console.log('❌ Referral code not found in database');
      console.log('You may need to log into the web client first to generate your code');
      process.exit(0);
    }
    
    const userId = userRows[0].user_id;
    console.log('✅ Found user ID:', userId);
    
    // Check referrals
    const referralsSql = `
      SELECT 
        r.id,
        r.referred_user_id,
        r.status,
        r.created_at,
        r.completed_at,
        up.user_email
      FROM referrals r
      LEFT JOIN user_profiles up ON r.referred_user_id = up.user_id
      WHERE r.referrer_user_id = $1
      ORDER BY r.created_at DESC
    `;
    const { rows: referrals } = await query(referralsSql, [userId]);
    
    console.log('\n📊 Your Referrals:');
    console.log('Total:', referrals.length);
    
    if (referrals.length > 0) {
      console.log('\nDetails:');
      referrals.forEach((ref, idx) => {
        console.log(`\n${idx + 1}. Email: ${ref.user_email || 'N/A'}`);
        console.log(`   Status: ${ref.status}`);
        console.log(`   Completed: ${ref.completed_at}`);
      });
    } else {
      console.log('No referrals yet.');
    }
    
    // Check your plan
    const planSql = `SELECT plan FROM user_profiles WHERE user_id = $1`;
    const { rows: planRows } = await query(planSql, [userId]);
    console.log('\n📦 Your Plan:', planRows[0]?.plan || 'Unknown');
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

checkReferrals();

