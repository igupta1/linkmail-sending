// Email Cron Job Handler
// Processes scheduled emails - called by Vercel cron

const { google } = require('googleapis');
const { getUserSession } = require('../store');
const { query } = require('../db');
const { findOrCreateConnection, addMessageToConnection } = require('./connections');

/**
 * Get authenticated Gmail client for user
 */
async function getGmailClient(userId) {
  const userSession = await getUserSession(userId);
  if (!userSession || !userSession.googleTokens) {
    throw new Error('User session not found or no Google tokens available');
  }

  const redirectUri = (process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback').trim();
  
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
 */
function createEmailMessage({ to, subject, body, from, attachments = [] }) {
  const processedMessage = body
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, '<br>\n');

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

  const boundary = 'LinkMail_' + Math.random().toString(36).substring(2);

  const fromHeader = (from?.name && from.name.trim()) 
    ? `From: "${from.name}" <${from.email}>`
    : `From: ${from?.email || 'me'}`;
  
  const headers = [
    'MIME-Version: 1.0',
    fromHeader,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    htmlBody
  ];

  if (attachments && attachments.length > 0) {
    attachments.forEach(attachment => {
      if (attachment.data) {
        headers.push(`--${boundary}`);
        headers.push(`Content-Type: ${attachment.type || 'application/pdf'}`);
        headers.push('Content-Transfer-Encoding: base64');
        headers.push(`Content-Disposition: attachment; filename="${attachment.name}"`);
        headers.push('');

        const chunkSize = 76;
        let remainingData = attachment.data;
        while (remainingData.length > 0) {
          headers.push(remainingData.substring(0, chunkSize));
          remainingData = remainingData.substring(chunkSize);
        }
      }
    });
  }

  headers.push(`--${boundary}--`);
  const email = headers.join('\r\n');

  return Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Find or create contact by email
 */
async function findOrCreateContactByEmail(email, contactInfo = {}) {
  try {
    const findContactSql = `
      SELECT c.* FROM contacts c
      JOIN contact_emails ce ON c.id = ce.contact_id
      WHERE ce.email = $1
      ORDER BY c.updated_at DESC
      LIMIT 1
    `;
    const { rows: existingContacts } = await query(findContactSql, [email]);
    
    if (existingContacts.length > 0) {
      return existingContacts[0];
    }
    
    const insertContactSql = `
      INSERT INTO contacts (first_name, last_name, job_title, company, linkedin_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const { rows: newContacts } = await query(insertContactSql, [
      contactInfo.firstName || null,
      contactInfo.lastName || null,
      contactInfo.jobTitle || null,
      contactInfo.company || null,
      contactInfo.linkedinUrl || null
    ]);
    
    const newContact = newContacts[0];
    
    const insertEmailSql = `
      INSERT INTO contact_emails (contact_id, email, is_primary, is_verified)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    await query(insertEmailSql, [newContact.id, email, true, false]);
    
    return newContact;
  } catch (error) {
    console.error('[email-cron] Error finding/creating contact:', error);
    throw error;
  }
}

/**
 * Process scheduled emails - called by Vercel cron
 */
async function processScheduledEmails(req, res) {
  // Verify cron secret to prevent unauthorized access
  const cronSecret = req.headers['x-cron-secret'] || req.query.secret;
  const expectedSecret = process.env.CRON_SECRET;
  
  // Also allow Vercel's cron authorization header
  const vercelCronHeader = req.headers['authorization'];
  const isVercelCron = vercelCronHeader === `Bearer ${process.env.CRON_SECRET}`;
  
  if (!expectedSecret) {
    console.error('[process-scheduled] CRON_SECRET environment variable not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }
  
  if (cronSecret !== expectedSecret && !isVercelCron) {
    console.error('[process-scheduled] Invalid cron secret');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[process-scheduled] Starting to process scheduled emails...');
  
  try {
    // Get all pending emails that are due to be sent
    const getPendingSql = `
      SELECT * FROM scheduled_emails
      WHERE status = 'pending' AND scheduled_at <= NOW()
      ORDER BY scheduled_at ASC
      LIMIT 10
    `;
    
    const { rows: pendingEmails } = await query(getPendingSql);
    
    console.log(`[process-scheduled] Found ${pendingEmails.length} emails to process`);
    
    if (pendingEmails.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No pending emails to process',
        processed: 0 
      });
    }
    
    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: []
    };
    
    for (const scheduledEmail of pendingEmails) {
      results.processed++;
      
      try {
        console.log(`[process-scheduled] Processing email ${scheduledEmail.id} to ${scheduledEmail.recipient_email}`);
        
        // Get user session
        const userSession = await getUserSession(scheduledEmail.user_id);
        if (!userSession) {
          throw new Error('User session not found - user may need to re-authenticate');
        }
        
        // Get Gmail client
        const gmail = await getGmailClient(scheduledEmail.user_id);
        
        // Parse attachments from JSON
        let attachments = [];
        try {
          attachments = typeof scheduledEmail.attachments === 'string' 
            ? JSON.parse(scheduledEmail.attachments) 
            : scheduledEmail.attachments || [];
        } catch (e) {
          console.warn('[process-scheduled] Failed to parse attachments:', e);
        }
        
        // Create the email message
        const rawMessage = createEmailMessage({
          to: scheduledEmail.recipient_email,
          subject: scheduledEmail.subject,
          body: scheduledEmail.body,
          from: {
            email: userSession.email,
            name: userSession.name
          },
          attachments: attachments
        });
        
        // Send the email
        const sendResponse = await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: rawMessage
          }
        });
        
        console.log(`[process-scheduled] Email ${scheduledEmail.id} sent successfully`);
        
        // Update status to sent
        const updateSentSql = `
          UPDATE scheduled_emails
          SET status = 'sent', 
              sent_at = NOW(), 
              gmail_message_id = $1, 
              gmail_thread_id = $2,
              updated_at = NOW()
          WHERE id = $3
        `;
        
        await query(updateSentSql, [
          sendResponse.data.id,
          sendResponse.data.threadId,
          scheduledEmail.id
        ]);
        
        // Try to create connection (non-blocking)
        try {
          let contactInfo = {};
          try {
            contactInfo = typeof scheduledEmail.contact_info === 'string'
              ? JSON.parse(scheduledEmail.contact_info)
              : scheduledEmail.contact_info || {};
          } catch (e) {}
          
          const contact = await findOrCreateContactByEmail(scheduledEmail.recipient_email, contactInfo);
          await findOrCreateConnection(scheduledEmail.user_id, contact.id, scheduledEmail.subject, contactInfo?.profilePictureUrl);
          
          const message = {
            direction: 'sent',
            subject: scheduledEmail.subject,
            body: scheduledEmail.body,
            attachments: attachments.map(a => ({ name: a.name, size: a.size, type: a.type })),
            sent_at: new Date().toISOString(),
            gmail_message_id: sendResponse.data.id,
            gmail_thread_id: sendResponse.data.threadId,
            is_follow_up: false
          };
          
          await addMessageToConnection(scheduledEmail.user_id, contact.id, message);
        } catch (contactError) {
          console.warn('[process-scheduled] Failed to create contact/connection:', contactError);
        }
        
        results.sent++;
        
      } catch (emailError) {
        console.error(`[process-scheduled] Failed to send email ${scheduledEmail.id}:`, emailError);
        
        // Update status to failed
        const updateFailedSql = `
          UPDATE scheduled_emails
          SET status = 'failed', 
              error_message = $1,
              updated_at = NOW()
          WHERE id = $2
        `;
        
        await query(updateFailedSql, [
          emailError.message || 'Unknown error',
          scheduledEmail.id
        ]);
        
        results.failed++;
        results.errors.push({
          id: scheduledEmail.id,
          error: emailError.message
        });
      }
    }
    
    console.log(`[process-scheduled] Completed. Sent: ${results.sent}, Failed: ${results.failed}`);
    
    res.json({
      success: true,
      message: `Processed ${results.processed} scheduled emails`,
      ...results
    });
    
  } catch (error) {
    console.error('[process-scheduled] Error:', error);
    res.status(500).json({
      error: 'Failed to process scheduled emails',
      message: error.message
    });
  }
}

module.exports = { processScheduledEmails };


