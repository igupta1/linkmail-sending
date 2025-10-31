// Referral routes for LinkMail backend

const express = require('express');
const { query } = require('../db');
const crypto = require('crypto');

const router = express.Router();

/**
 * Generate a unique referral code
 */
function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * GET /api/referrals/code
 * Get or create a referral code for the authenticated user
 */
router.get('/code', async (req, res) => {
  const userId = req.user.id;
  
  try {
    // Check if user already has a referral code
    const checkSql = `SELECT referral_code FROM user_profiles WHERE user_id = $1`;
    const { rows } = await query(checkSql, [userId]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        error: 'UserNotFound',
        message: 'User profile not found'
      });
    }
    
    let referralCode = rows[0].referral_code;
    
    // Generate a code if user doesn't have one
    if (!referralCode) {
      // Keep generating until we get a unique code
      let isUnique = false;
      while (!isUnique) {
        referralCode = generateReferralCode();
        const uniqueCheckSql = `SELECT user_id FROM user_profiles WHERE referral_code = $1`;
        const { rows: existingRows } = await query(uniqueCheckSql, [referralCode]);
        isUnique = existingRows.length === 0;
      }
      
      // Save the code to user profile
      const updateSql = `UPDATE user_profiles SET referral_code = $1 WHERE user_id = $2`;
      await query(updateSql, [referralCode, userId]);
    }
    
    // Get referral stats
    const statsSql = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count
      FROM referrals
      WHERE referrer_user_id = $1
    `;
    const { rows: statsRows } = await query(statsSql, [userId]);
    const stats = statsRows[0] || { completed_count: 0, pending_count: 0 };
    
    // Get user's current plan
    const planSql = `SELECT plan FROM user_profiles WHERE user_id = $1`;
    const { rows: planRows } = await query(planSql, [userId]);
    const currentPlan = planRows[0]?.plan || 'Premium Tier';
    
    return res.json({
      success: true,
      referralCode,
      referralLink: `https://linkmail.dev/install?ref=${referralCode}`,
      stats: {
        completed: parseInt(stats.completed_count),
        pending: parseInt(stats.pending_count),
        remaining: Math.max(0, 3 - parseInt(stats.completed_count))
      },
      currentPlan,
      hasUnlockedPremiumPlus: currentPlan === 'Premium Plus Tier'
    });
  } catch (error) {
    console.error('Error getting/creating referral code:', error);
    return res.status(500).json({
      error: 'InternalError',
      message: 'Failed to get referral code'
    });
  }
});

/**
 * POST /api/referrals/track-install
 * Track an installation from a referral code
 * Called when extension is installed with a referral code
 */
router.post('/track-install', async (req, res) => {
  const { referralCode } = req.body;
  const installedUserId = req.user?.id; // The user who just installed (may be new)
  
  if (!referralCode) {
    return res.status(400).json({
      error: 'MissingReferralCode',
      message: 'Referral code is required'
    });
  }
  
  try {
    // Find the referrer
    const referrerSql = `SELECT user_id, plan FROM user_profiles WHERE referral_code = $1`;
    const { rows: referrerRows } = await query(referrerSql, [referralCode.toUpperCase()]);
    
    if (referrerRows.length === 0) {
      return res.status(404).json({
        error: 'InvalidReferralCode',
        message: 'Referral code not found'
      });
    }
    
    const referrerUserId = referrerRows[0].user_id;
    const currentPlan = referrerRows[0].plan;
    
    // Check if referrer is trying to refer themselves
    if (installedUserId && referrerUserId === installedUserId) {
      return res.status(400).json({
        error: 'SelfReferral',
        message: 'You cannot use your own referral code'
      });
    }
    
    // Check if this user has already been referred by this code
    if (installedUserId) {
      const existingSql = `
        SELECT id FROM referrals 
        WHERE referrer_user_id = $1 AND referred_user_id = $2
      `;
      const { rows: existingRows } = await query(existingSql, [referrerUserId, installedUserId]);
      
      if (existingRows.length > 0) {
        return res.status(400).json({
          error: 'AlreadyReferred',
          message: 'You have already been counted for this referral'
        });
      }
    }
    
    // Create a new referral record
    const insertSql = `
      INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code, status, completed_at)
      VALUES ($1, $2, $3, 'completed', NOW())
      RETURNING id
    `;
    await query(insertSql, [referrerUserId, installedUserId, referralCode.toUpperCase()]);
    
    // Check if referrer has now completed 3 referrals
    const countSql = `
      SELECT COUNT(*) as count
      FROM referrals
      WHERE referrer_user_id = $1 AND status = 'completed'
    `;
    const { rows: countRows } = await query(countSql, [referrerUserId]);
    const completedReferrals = parseInt(countRows[0].count);
    
    // Upgrade to Premium Plus if they have 3+ referrals and aren't already Premium Plus
    if (completedReferrals >= 3 && currentPlan !== 'Premium Plus Tier') {
      const upgradeSql = `
        UPDATE user_profiles 
        SET plan = 'Premium Plus Tier', updated_at = NOW()
        WHERE user_id = $1
      `;
      await query(upgradeSql, [referrerUserId]);
      
      return res.json({
        success: true,
        message: 'Referral tracked and user upgraded to Premium Plus!',
        completedReferrals,
        upgraded: true
      });
    }
    
    return res.json({
      success: true,
      message: 'Referral tracked successfully',
      completedReferrals,
      remaining: Math.max(0, 3 - completedReferrals),
      upgraded: false
    });
  } catch (error) {
    console.error('Error tracking referral install:', error);
    return res.status(500).json({
      error: 'InternalError',
      message: 'Failed to track referral'
    });
  }
});

/**
 * GET /api/referrals/history
 * Get referral history for the authenticated user
 */
router.get('/history', async (req, res) => {
  const userId = req.user.id;
  
  try {
    const sql = `
      SELECT 
        r.id,
        r.status,
        r.created_at,
        r.completed_at,
        up.user_email as referred_email
      FROM referrals r
      LEFT JOIN user_profiles up ON r.referred_user_id = up.user_id
      WHERE r.referrer_user_id = $1
      ORDER BY r.created_at DESC
    `;
    const { rows } = await query(sql, [userId]);
    
    return res.json({
      success: true,
      referrals: rows
    });
  } catch (error) {
    console.error('Error fetching referral history:', error);
    return res.status(500).json({
      error: 'InternalError',
      message: 'Failed to fetch referral history'
    });
  }
});

module.exports = router;

