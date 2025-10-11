// User routes for LinkMail backend

const express = require('express');
const { getUserSession, setUserSession, deleteUserSession } = require('../store');
const { query } = require('../db');
const { body, validationResult } = require('express-validator');
const { canonicalizeLinkedInProfile } = require('../utils/linkedin-utils');

const router = express.Router();

/**
 * GET /api/user/profile
 * Get user profile information (merges session + database data)
 */
router.get('/profile', async (req, res) => {
  const userId = req.user.id;
  
  try {
    const userSession = await getUserSession(userId);
    if (!userSession) {
      return res.status(401).json({
        error: 'Session not found',
        message: 'Please sign in again'
      });
    }

    // Update last accessed time
    userSession.lastAccessed = new Date();
    await setUserSession(userId, userSession);

    // Try to fetch additional data from user_profiles table
    let firstName = null;
    let lastName = null;
    try {
      const sql = `SELECT first_name, last_name FROM user_profiles WHERE user_id = $1`;
      console.log('[UserRoute] Querying user_profiles for userId:', userId);
      const { rows } = await query(sql, [userId]);
      console.log('[UserRoute] Query result - rows found:', rows.length);
      if (rows.length > 0) {
        firstName = rows[0].first_name;
        lastName = rows[0].last_name;
        console.log('[UserRoute] Found in database - firstName:', firstName, 'lastName:', lastName);
      } else {
        console.warn('[UserRoute] No user_profiles record found for userId:', userId);
      }
    } catch (dbError) {
      console.error('[UserRoute] Database query error:', dbError?.message || dbError);
    }

    // Construct full name from first/last if session name is missing
    let fullName = userSession.name;
    if (!fullName && (firstName || lastName)) {
      fullName = `${firstName || ''} ${lastName || ''}`.trim();
    }

    // Return user profile data (excluding sensitive information)
    const userResponse = {
      success: true,
      user: {
        id: userSession.id,
        email: userSession.email,
        name: fullName || userSession.name,
        firstName: firstName,
        lastName: lastName,
        picture: userSession.picture,
        createdAt: userSession.createdAt,
        lastAccessed: userSession.lastAccessed,
        emailsSent: userSession.emailHistory ? userSession.emailHistory.length : 0
      }
    };
    console.log('[UserRoute] Returning user profile response:', JSON.stringify(userResponse.user, null, 2));
    res.json(userResponse);

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      error: 'Failed to fetch user profile',
      message: 'An error occurred while retrieving your profile'
    });
  }
});

/**
 * PUT /api/user/profile
 * Update user profile information (name only for now)
 */
router.put('/profile', async (req, res) => {
  const userId = req.user.id;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      error: 'Invalid name',
      message: 'Name must be a non-empty string'
    });
  }

  try {
    const userSession = await getUserSession(userId);
    if (!userSession) {
      return res.status(401).json({
        error: 'Session not found',
        message: 'Please sign in again'
      });
    }

    // Update user name
    userSession.name = name.trim();
    userSession.lastAccessed = new Date();
    await setUserSession(userId, userSession);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: userSession.id,
        email: userSession.email,
        name: userSession.name,
        picture: userSession.picture
      }
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: 'An error occurred while updating your profile'
    });
  }
});

/**
 * GET /api/user/stats
 * Get user statistics
 */
router.get('/stats', async (req, res) => {
  const userId = req.user.id;
  
  try {
    const userSession = await getUserSession(userId);
    if (!userSession) {
      return res.status(401).json({
        error: 'Session not found',
        message: 'Please sign in again'
      });
    }

    const emailHistory = userSession.emailHistory || [];
    
    // Calculate statistics
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const stats = {
      totalEmails: emailHistory.length,
      emailsToday: emailHistory.filter(email => 
        new Date(email.sentAt) >= today
      ).length,
      emailsThisWeek: emailHistory.filter(email => 
        new Date(email.sentAt) >= thisWeek
      ).length,
      emailsThisMonth: emailHistory.filter(email => 
        new Date(email.sentAt) >= thisMonth
      ).length,
      accountCreated: userSession.createdAt,
      lastEmailSent: emailHistory.length > 0 
        ? emailHistory.reduce((latest, email) => 
            new Date(email.sentAt) > new Date(latest.sentAt) ? email : latest
          ).sentAt 
        : null
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: 'An error occurred while retrieving your statistics'
    });
  }
});

/**
 * DELETE /api/user/account
 * Delete user account and all associated data
 */
router.delete('/account', async (req, res) => {
  const userId = req.user.id;
  
  try {
    const userSession = await getUserSession(userId);
    if (!userSession) {
      return res.status(401).json({
        error: 'Session not found',
        message: 'Please sign in again'
      });
    }

    // Remove user session and all data
    await deleteUserSession(userId);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting user account:', error);
    res.status(500).json({
      error: 'Failed to delete account',
      message: 'An error occurred while deleting your account'
    });
  }
});

module.exports = router;

/**
 * GET /api/user/bio
 * Fetch persisted user bio/profile data from Postgres
 */
router.get('/bio', async (req, res) => {
  const userId = req.user.id;
  try {
    const sql = `
      SELECT user_id,
             first_name,
             last_name,
             linkedin_url,
             experiences,
             skills,
             templates,
             contacted_linkedins,
             school,
             preferences,
             created_at,
             updated_at
      FROM user_profiles
      WHERE user_id = $1
    `;
    const { rows } = await query(sql, [userId]);
    if (rows.length === 0) {
      return res.json({
        success: true,
        profile: null
      });
    }
    return res.json({ success: true, profile: rows[0] });
  } catch (error) {
    console.error('Error fetching user bio:', error);
    return res.status(500).json({ error: 'FailedToFetchBio', message: 'Could not fetch user bio' });
  }
});

/**
 * PUT /api/user/bio
 * Create or update persisted user bio/profile data
 */
router.put('/bio', [
  body('firstName').optional().isString().trim(),
  body('lastName').optional().isString().trim(),
  body('linkedinUrl').optional().isString().trim(),
  body('experiences').optional().isArray(),
  body('skills').optional().isArray(),
  body('templates').optional().isArray(),
  body('school').optional().isString().trim(),
  body('preferences').optional().custom((value) => {
    if (value === null || value === undefined) return true;
    return typeof value === 'object' && value !== null;
  }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('Validation errors:', errors.array());
    return res.status(400).json({ error: 'ValidationFailed', details: errors.array() });
  }

  const userId = req.user.id;
  const { firstName, lastName, linkedinUrl, experiences, skills, templates, school, preferences } = req.body;
  
  // CRITICAL DEBUG: Log the raw request body to see what's being sent
  console.log('=== [UserRoute PUT /bio] RAW REQUEST BODY ===');
  console.log('userId:', userId);
  console.log('req.body:', JSON.stringify(req.body, null, 2));
  console.log('templates field:', templates);
  if (Array.isArray(templates) && templates.length > 0) {
    console.log('First template:', JSON.stringify(templates[0], null, 2));
  }
  console.log('========================================');

  // Build dynamic update query - only include fields that are provided
  const updateFields = [];
  const insertFields = ['user_id'];
  const insertValues = [userId];
  const insertPlaceholders = ['$1'];
  let paramIndex = 2;

  // Handle string fields
  if (typeof firstName === 'string' && firstName.trim().length > 0) {
    const value = firstName.trim();
    updateFields.push(`first_name = $${paramIndex}`);
    insertFields.push('first_name');
    insertValues.push(value);
    insertPlaceholders.push(`$${paramIndex}`);
    paramIndex++;
  }

  if (typeof lastName === 'string' && lastName.trim().length > 0) {
    const value = lastName.trim();
    updateFields.push(`last_name = $${paramIndex}`);
    insertFields.push('last_name');
    insertValues.push(value);
    insertPlaceholders.push(`$${paramIndex}`);
    paramIndex++;
  }

  if (typeof linkedinUrl === 'string' && linkedinUrl.trim().length > 0) {
    const value = linkedinUrl.trim();
    updateFields.push(`linkedin_url = $${paramIndex}`);
    insertFields.push('linkedin_url');
    insertValues.push(value);
    insertPlaceholders.push(`$${paramIndex}`);
    paramIndex++;
  }

  if (typeof school === 'string' && school.trim().length > 0) {
    const value = school.trim();
    updateFields.push(`school = $${paramIndex}`);
    insertFields.push('school');
    insertValues.push(value);
    insertPlaceholders.push(`$${paramIndex}`);
    paramIndex++;
  }

  if (typeof preferences === 'object' && preferences !== null) {
    const value = JSON.stringify(preferences);
    updateFields.push(`preferences = $${paramIndex}::jsonb`);
    insertFields.push('preferences');
    insertValues.push(value);
    insertPlaceholders.push(`$${paramIndex}::jsonb`);
    paramIndex++;
  }

  // Handle array/object fields
  if (Array.isArray(experiences)) {
    const value = JSON.stringify(experiences);
    updateFields.push(`experiences = $${paramIndex}::jsonb`);
    insertFields.push('experiences');
    insertValues.push(value);
    insertPlaceholders.push(`$${paramIndex}::jsonb`);
    paramIndex++;
  }

  if (Array.isArray(skills)) {
    updateFields.push(`skills = $${paramIndex}::text[]`);
    insertFields.push('skills');
    insertValues.push(skills);
    insertPlaceholders.push(`$${paramIndex}::text[]`);
    paramIndex++;
  }

  if (Array.isArray(templates)) {
    // Debug logging
    console.log('[UserRoute] Received templates array:', JSON.stringify(templates, null, 2));
    
    const mappedTemplates = templates.map(t => {
      // Handle file field - support both string URL and object with {url, name, size}
      let fileValue = null;
      
      if (t.file) {
        if (typeof t.file === 'object' && t.file !== null) {
          // New format: object with url, name, size
          // Validate it has the required url field
          if (t.file.url && typeof t.file.url === 'string' && t.file.url.trim().length > 0) {
            fileValue = {
              url: t.file.url.trim(),
              name: t.file.name || 'Attachment',
              size: typeof t.file.size === 'number' ? t.file.size : 0
            };
          }
        } else if (typeof t.file === 'string' && t.file.trim().length > 0) {
          // Old format: just a URL string - keep as string for backward compatibility
          fileValue = t.file.trim();
        }
      } else if (typeof t.fileUrl === 'string' && t.fileUrl.trim().length > 0) {
        // Legacy fileUrl field
        fileValue = t.fileUrl.trim();
      }
      
      console.log(`[UserRoute] Template "${t.title || 'Untitled'}":`, {
        hasFile: !!t.file,
        fileType: typeof t.file,
        fileValue: t.file,
        hasFileUrl: !!t.fileUrl,
        finalFileValue: fileValue
      });
      
      return {
        icon: typeof t.icon === 'string' && t.icon.trim().length > 0 ? t.icon.trim() : '📝',
        title: t.title || t.name || '',
        body: t.body || t.content || '',
        subject: t.subject || t.title || t.name || 'Subject Line',
        file: fileValue,
        strict_template: typeof t.strict_template === 'boolean' ? t.strict_template : false
      };
    });
    
    console.log('[UserRoute] Mapped templates:', JSON.stringify(mappedTemplates, null, 2));
    
    const value = JSON.stringify(mappedTemplates);
    updateFields.push(`templates = $${paramIndex}::jsonb`);
    insertFields.push('templates');
    insertValues.push(value);
    insertPlaceholders.push(`$${paramIndex}::jsonb`);
    paramIndex++;
  }

  // Add updated_at to update fields
  if (updateFields.length > 0) {
    updateFields.push('updated_at = NOW()');
  }

  try {
    const upsertSql = `
      INSERT INTO user_profiles (${insertFields.join(', ')})
      VALUES (${insertPlaceholders.join(', ')})
      ON CONFLICT (user_id)
      DO UPDATE SET
        ${updateFields.join(', ')}
      RETURNING user_id, first_name, last_name, linkedin_url, experiences, skills, templates, contacted_linkedins, school, preferences, created_at, updated_at
    `;
    const { rows } = await query(upsertSql, insertValues);
    return res.json({ success: true, profile: rows[0] });
  } catch (error) {
    console.error('Error upserting user bio:', error);
    return res.status(500).json({ error: 'FailedToSaveBio', message: 'Could not save user bio' });
  }
});

/**
 * POST /api/user/contacted
 * Append a contacted LinkedIn profile URL to the user's list
 */
router.post('/contacted', [
  body('linkedinUrl').isString().trim().notEmpty().withMessage('linkedinUrl is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'ValidationFailed', details: errors.array() });
  }
  const userId = req.user.id;
  const { linkedinUrl } = req.body;
  
  // Canonicalize the LinkedIn URL to match format stored in contacts table
  const canonicalUrl = canonicalizeLinkedInProfile(linkedinUrl);
  const normalizedUrl = (canonicalUrl || linkedinUrl).toLowerCase();
  
  console.log(`Adding contacted LinkedIn URL - Original: ${linkedinUrl}, Canonicalized: ${normalizedUrl}`);
  
  try {
    const updateSql = `
      INSERT INTO user_profiles (user_id, contacted_linkedins)
      VALUES ($1, ARRAY[$2])
      ON CONFLICT (user_id)
      DO UPDATE SET
        contacted_linkedins = (
          SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(user_profiles.contacted_linkedins, '{}') || ARRAY[EXCLUDED.contacted_linkedins[1]]))
        ),
        updated_at = NOW()
      RETURNING user_id, first_name, last_name, linkedin_url, experiences, skills, contacted_linkedins, school, preferences, created_at, updated_at
    `;
    const { rows } = await query(updateSql, [userId, normalizedUrl]);
    return res.json({ success: true, profile: rows[0] });
  } catch (error) {
    console.error('Error updating contacted linkedins:', error);
    return res.status(500).json({ error: 'FailedToUpdateContacted', message: 'Could not update contacted linkedins' });
  }
});

/**
 * GET /api/user/apollo-usage
 * Get current Apollo API usage count for the user
 */
router.get('/apollo-usage', async (req, res) => {
  const userId = req.user.id;
  const APOLLO_USAGE_LIMIT = 50;
  
  try {
    const sql = `
      SELECT apollo_api_calls
      FROM user_profiles
      WHERE user_id = $1
    `;
    const { rows } = await query(sql, [userId]);
    
    let currentUsage = 0;
    if (rows.length > 0 && rows[0].apollo_api_calls !== null) {
      currentUsage = rows[0].apollo_api_calls;
    }
    
    return res.json({
      success: true,
      currentUsage,
      limit: APOLLO_USAGE_LIMIT,
      remaining: Math.max(0, APOLLO_USAGE_LIMIT - currentUsage),
      hasReachedLimit: currentUsage >= APOLLO_USAGE_LIMIT
    });
  } catch (error) {
    console.error('Error fetching Apollo usage:', error);
    return res.status(500).json({ 
      error: 'FailedToFetchUsage', 
      message: 'Could not fetch Apollo usage information' 
    });
  }
});