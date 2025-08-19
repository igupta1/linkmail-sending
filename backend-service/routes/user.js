// User routes for LinkMail backend

const express = require('express');
const { userSessions } = require('./auth');

const router = express.Router();

/**
 * GET /api/user/profile
 * Get user profile information
 */
router.get('/profile', (req, res) => {
  const userId = req.user.id;
  
  try {
    const userSession = userSessions.get(userId);
    if (!userSession) {
      return res.status(401).json({
        error: 'Session not found',
        message: 'Please sign in again'
      });
    }

    // Update last accessed time
    userSession.lastAccessed = new Date();
    userSessions.set(userId, userSession);

    // Return user profile data (excluding sensitive information)
    res.json({
      success: true,
      user: {
        id: userSession.id,
        email: userSession.email,
        name: userSession.name,
        picture: userSession.picture,
        createdAt: userSession.createdAt,
        lastAccessed: userSession.lastAccessed,
        emailsSent: userSession.emailHistory ? userSession.emailHistory.length : 0
      }
    });

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
router.put('/profile', (req, res) => {
  const userId = req.user.id;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      error: 'Invalid name',
      message: 'Name must be a non-empty string'
    });
  }

  try {
    const userSession = userSessions.get(userId);
    if (!userSession) {
      return res.status(401).json({
        error: 'Session not found',
        message: 'Please sign in again'
      });
    }

    // Update user name
    userSession.name = name.trim();
    userSession.lastAccessed = new Date();
    userSessions.set(userId, userSession);

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
router.get('/stats', (req, res) => {
  const userId = req.user.id;
  
  try {
    const userSession = userSessions.get(userId);
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
router.delete('/account', (req, res) => {
  const userId = req.user.id;
  
  try {
    const userSession = userSessions.get(userId);
    if (!userSession) {
      return res.status(401).json({
        error: 'Session not found',
        message: 'Please sign in again'
      });
    }

    // Remove user session and all data
    userSessions.delete(userId);

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