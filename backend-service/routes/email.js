// Email routes for LinkMail backend

const express = require('express');
const { google } = require('googleapis');
const { body, validationResult } = require('express-validator');
const { getUserSession, setUserSession } = require('../store');
const { getClient } = require('../db');

const router = express.Router();

/**
 * Get authenticated Gmail client for user
 * @param {string} userId - User ID
 * @returns {Object} Gmail client
 */
async function getGmailClient(userId) {
  // Retrieve session from KV/memory
  const userSession = await getUserSession(userId);
  if (!userSession || !userSession.googleTokens) {
    throw new Error('User session not found or no Google tokens available');
  }

  // Use environment variable or default to localhost for development
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';
  
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  oauth2Client.setCredentials(userSession.googleTokens);

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Create email in Gmail format
 * @param {Object} emailData - Email data
 * @returns {string} Base64 encoded email
 */
function createEmailMessage({ to, subject, body, from, attachments = [] }) {
  // Process the message to ensure proper line breaks
  const processedMessage = body
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, '<br>\n');

  // Wrap in basic HTML structure
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #333; }
  </style>
</head>
<body>
  ${processedMessage}
</body>
</html>`.trim();

  // Generate a random boundary string for multipart message
  const boundary = 'LinkMail_' + Math.random().toString(36).substring(2);

  // Create email headers with properly quoted sender name
  const fromHeader = (from?.name && from.name.trim()) 
    ? `From: "${from.name}" <${from.email}>`
    : `From: ${from?.email || 'me'}`;
  
  const headers = [
    'MIME-Version: 1.0',
    fromHeader,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',  // Empty line separates headers from body
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',  // Empty line separates headers from content
    htmlBody
  ];

  // Add attachments if any
  if (attachments && attachments.length > 0) {
    attachments.forEach(attachment => {
      if (attachment.data) {
        headers.push(`--${boundary}`);
        headers.push(`Content-Type: ${attachment.type || 'application/pdf'}`);
        headers.push('Content-Transfer-Encoding: base64');
        headers.push(`Content-Disposition: attachment; filename="${attachment.name}"`);
        headers.push('');  // Empty line separates headers from content

        // Add the attachment data - split into chunks to avoid line length issues
        const chunkSize = 76;
        let remainingData = attachment.data;
        while (remainingData.length > 0) {
          headers.push(remainingData.substring(0, chunkSize));
          remainingData = remainingData.substring(chunkSize);
        }
      }
    });
  }

  // Add closing boundary
  headers.push(`--${boundary}--`);

  // Join all parts with CRLF
  const email = headers.join('\r\n');

  // Encode the email for Gmail API
  return Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * POST /api/email/send
 * Send email via Gmail API
 */
router.post('/send', [
  body('to').isEmail().withMessage('Valid recipient email is required'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('body').notEmpty().withMessage('Email body is required'),
  body('attachments').optional().isArray().withMessage('Attachments must be an array'),
  // Optional contact information
  body('contactInfo.firstName').optional().isString().trim(),
  body('contactInfo.lastName').optional().isString().trim(),
  body('contactInfo.jobTitle').optional().isString().trim(),
  body('contactInfo.company').optional().isString().trim(),
  body('contactInfo.linkedinUrl').optional().isString().trim()
], async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const { to, subject, body, attachments = [], contactInfo = {} } = req.body;
  const userId = req.user.id;

  try {
    // Get user session
    const userSession = await getUserSession(userId);
    if (!userSession) {
      return res.status(401).json({
        error: 'Session not found',
        message: 'Please sign in again'
      });
    }

    // Get Gmail client
    const gmail = await getGmailClient(userId);

    // Get user profile for the From header
    const profileResponse = await gmail.users.getProfile({ userId: 'me' });
    const userEmail = profileResponse.data.emailAddress;

    // Create the email message
    const rawMessage = createEmailMessage({
      to,
      subject,
      body,
      from: {
        email: userEmail,
        name: userSession.name
      },
      attachments
    });

    // Send the email
    const sendResponse = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage
      }
    });

    // Contact creation removed - no longer auto-creating contacts when sending emails

    // Save email to user's history
    if (!userSession.emailHistory) {
      userSession.emailHistory = [];
    }

    const emailRecord = {
      id: sendResponse.data.id,
      threadId: sendResponse.data.threadId,
      to,
      subject,
      body,
      attachments: attachments.map(a => ({ name: a.name, size: a.size, type: a.type })),
      sentAt: new Date().toISOString(),
      gmailMessageId: sendResponse.data.id
    };

    userSession.emailHistory.push(emailRecord);
    await setUserSession(userId, userSession);

    res.json({
      success: true,
      messageId: sendResponse.data.id,
      threadId: sendResponse.data.threadId,
      message: 'Email sent successfully'
    });

  } catch (error) {
    console.error('Email sending error:', error);
    
    // Handle specific Gmail API errors
    if (error.code === 401) {
      return res.status(401).json({
        error: 'Gmail authentication failed',
        message: 'Please reconnect your Google account'
      });
    }
    
    if (error.code === 403) {
      return res.status(403).json({
        error: 'Gmail permission denied',
        message: 'Insufficient permissions to send email'
      });
    }
    
    if (error.code === 400) {
      return res.status(400).json({
        error: 'Invalid email data',
        message: error.message || 'The email data is invalid'
      });
    }

    res.status(500).json({
      error: 'Email sending failed',
      message: 'An error occurred while sending the email'
    });
  }
});

/**
 * GET /api/email/history
 * Get user's email history
 */
router.get('/history', (req, res) => {
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
    
    // Sort by sent date (newest first)
    const sortedHistory = emailHistory.sort((a, b) => 
      new Date(b.sentAt) - new Date(a.sentAt)
    );

    res.json({
      success: true,
      emails: sortedHistory,
      total: sortedHistory.length
    });

  } catch (error) {
    console.error('Error fetching email history:', error);
    res.status(500).json({
      error: 'Failed to fetch email history',
      message: 'An error occurred while retrieving your email history'
    });
  }
});

/**
 * GET /api/email/profile
 * Get Gmail profile information
 */
router.get('/profile', async (req, res) => {
  const userId = req.user.id;

  try {
    const gmail = getGmailClient(userId);
    const profileResponse = await gmail.users.getProfile({ userId: 'me' });

    res.json({
      success: true,
      profile: {
        emailAddress: profileResponse.data.emailAddress,
        messagesTotal: profileResponse.data.messagesTotal,
        threadsTotal: profileResponse.data.threadsTotal,
        historyId: profileResponse.data.historyId
      }
    });

  } catch (error) {
    console.error('Error fetching Gmail profile:', error);
    
    if (error.code === 401) {
      return res.status(401).json({
        error: 'Gmail authentication failed',
        message: 'Please reconnect your Google account'
      });
    }

    res.status(500).json({
      error: 'Failed to fetch Gmail profile',
      message: 'An error occurred while retrieving your Gmail profile'
    });
  }
});

module.exports = router;