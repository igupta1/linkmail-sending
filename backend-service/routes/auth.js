// Authentication routes for LinkMail backend

const express = require('express');
const { google } = require('googleapis');
const { generateToken, verifyToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { query } = require('../db');

const router = express.Router();

// Storage helpers (KV in prod, memory in dev)
const {
  setUserSession,
  getUserSession,
  deleteUserSession,
  storeExtensionToken,
  pollExtensionToken
} = require('../store');

/**
 * Initialize Google OAuth2 client
 */
function getOAuth2Client() {
  // OAuth redirect URI should point to the backend callback endpoint
  // The backend will then redirect to the frontend with the token
  const redirectUri = (process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback').trim();
  
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 */
router.get('/google', (req, res) => {
  const oauth2Client = getOAuth2Client();
  
  const scopes = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: req.query.source || 'web' // Track if request came from extension
  });

  res.redirect(url);
});

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback
 */
router.get('/google/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).send('Authorization code missing');
  }

  try {
    // Create OAuth client with same configuration as the initial request
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      (process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback').trim()
    );
    
    const { tokens } = await oauth2Client.getToken(code);
    
    oauth2Client.setCredentials(tokens);

    // Get user profile information
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    // Create user session data
    const userData = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      googleTokens: tokens
    };

    // Store user session
    await setUserSession(profile.id, {
      ...userData,
      createdAt: new Date(),
      lastAccessed: new Date()
    });

    // Upsert minimal user profile row in Postgres (non-blocking)
    try {
      if (process.env.DATABASE_URL) {
        const upsertSql = `
          INSERT INTO user_profiles (user_id, user_email, first_name, last_name)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id) DO UPDATE SET
            user_email = COALESCE(EXCLUDED.user_email, user_profiles.user_email),
            first_name = COALESCE(EXCLUDED.first_name, user_profiles.first_name),
            last_name = COALESCE(EXCLUDED.last_name, user_profiles.last_name),
            updated_at = NOW()
        `;
        const name = (profile.name || '').trim();
        const first = name.split(' ')[0] || null;
        const last = name.split(' ').slice(1).join(' ') || null;
        await query(upsertSql, [profile.id, profile.email || null, first, last]);
      }
    } catch (e) {
      console.error('Upsert minimal user profile failed (non-fatal):', e?.message || e);
    }

    // Generate JWT token
    const jwtToken = generateToken(userData);

    // If request came from extension, show success page with token
    if (state === 'extension') {
      // Set CSP to allow inline scripts for this page
      res.setHeader('Content-Security-Policy', "script-src 'self' 'unsafe-inline'; object-src 'self'; frame-ancestors 'none';");
      
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>LinkMail - Authentication Successful</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
            }
            
            .container {
              background: white;
              border-radius: 16px;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
              max-width: 500px;
              width: 100%;
              padding: 48px 40px;
              text-align: center;
              animation: slideUp 0.5s ease-out;
            }
            
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(30px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            
            @keyframes checkmark {
              0% {
                stroke-dashoffset: 100;
              }
              100% {
                stroke-dashoffset: 0;
              }
            }
            
            @keyframes circle {
              0% {
                stroke-dashoffset: 166;
              }
              100% {
                stroke-dashoffset: 0;
              }
            }
            
            @keyframes fadeIn {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }
            
            .logo-container {
              width: 80px;
              height: 80px;
              margin: 0 auto 24px;
              background: #0B66C2;
              border-radius: 16px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 8px 16px rgba(11, 102, 194, 0.2);
            }
            
            .logo-icon {
              width: 48px;
              height: 48px;
            }
            
            .success-icon {
              width: 80px;
              height: 80px;
              margin: 0 auto 24px;
              position: relative;
              animation: fadeIn 0.5s ease-out 0.3s backwards;
            }
            
            .success-circle {
              stroke: #10b981;
              stroke-width: 3;
              fill: none;
              stroke-dasharray: 166;
              stroke-dashoffset: 166;
              animation: circle 0.6s ease-out 0.3s forwards;
            }
            
            .success-check {
              stroke: #10b981;
              stroke-width: 3;
              fill: none;
              stroke-linecap: round;
              stroke-linejoin: round;
              stroke-dasharray: 100;
              stroke-dashoffset: 100;
              animation: checkmark 0.3s ease-out 0.6s forwards;
            }
            
            h1 {
              color: #1f2937;
              font-size: 28px;
              font-weight: 700;
              margin-bottom: 12px;
              animation: fadeIn 0.5s ease-out 0.4s backwards;
            }
            
            .subtitle {
              color: #6b7280;
              font-size: 16px;
              line-height: 1.6;
              margin-bottom: 32px;
              animation: fadeIn 0.5s ease-out 0.5s backwards;
            }
            
            .info-box {
              background: #f3f4f6;
              border-radius: 12px;
              padding: 24px;
              margin-bottom: 24px;
              text-align: left;
              animation: fadeIn 0.5s ease-out 0.6s backwards;
            }
            
            .info-box h3 {
              color: #1f2937;
              font-size: 14px;
              font-weight: 600;
              margin-bottom: 16px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            .steps {
              list-style: none;
              counter-reset: step-counter;
            }
            
            .steps li {
              counter-increment: step-counter;
              position: relative;
              padding-left: 36px;
              margin-bottom: 12px;
              color: #4b5563;
              font-size: 14px;
              line-height: 1.5;
            }
            
            .steps li:last-child {
              margin-bottom: 0;
            }
            
            .steps li::before {
              content: counter(step-counter);
              position: absolute;
              left: 0;
              top: 0;
              width: 24px;
              height: 24px;
              background: #0B66C2;
              color: white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              font-weight: 600;
            }
            
            .close-button {
              background: #0B66C2;
              color: white;
              border: none;
              border-radius: 100px;
              padding: 14px 32px;
              font-size: 15px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s ease;
              width: 100%;
              animation: fadeIn 0.5s ease-out 0.7s backwards;
            }
            
            .close-button:hover {
              background: #084e96;
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(11, 102, 194, 0.3);
            }
            
            .close-button:active {
              transform: translateY(0);
            }
            
            .footer-text {
              margin-top: 20px;
              color: #9ca3af;
              font-size: 13px;
              animation: fadeIn 0.5s ease-out 0.8s backwards;
            }
            
            .countdown {
              display: inline-block;
              font-weight: 600;
              color: #6b7280;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo-container">
              <svg class="logo-icon" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 20 L50 20 L80 20 L80 35 L65 50 L65 80 L35 80 L35 50 L20 35 Z" fill="white"/>
              </svg>
            </div>
            
            <svg class="success-icon" viewBox="0 0 80 80">
              <circle class="success-circle" cx="40" cy="40" r="26"/>
              <path class="success-check" d="M25 40 L35 50 L55 30"/>
            </svg>
            
            <h1>Authentication Successful!</h1>
            <p class="subtitle">You have successfully signed in to LinkMail.<br>You can now close this tab and return to LinkedIn.</p>
            
            <div class="info-box">
              <h3>Next Steps</h3>
              <ol class="steps">
                <li>Close this browser tab</li>
                <li>Return to LinkedIn</li>
                <li>The extension is now authenticated and ready to use</li>
              </ol>
            </div>
            
            <button class="close-button" onclick="window.close()">Close This Tab</button>
            
            <p class="footer-text">This tab will automatically close in <span class="countdown" id="countdown">3</span> seconds</p>
          </div>
          
          <script>
            // Store token for extension
            console.log('LinkMail: Storing token for extension...');
            
            fetch('/api/auth/extension-token', {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                token: '${jwtToken}',
                userData: ${JSON.stringify(userData)}
              })
            }).then(response => {
              console.log('LinkMail: Extension token endpoint response status:', response.status);
              return response.json();
            }).then(data => {
              console.log('LinkMail: Extension token stored successfully:', data);
              console.log('LinkMail: Extension should detect authentication now');
            }).catch(err => {
              console.error('LinkMail: Failed to store extension token:', err);
              console.error('LinkMail: This means the extension will not detect authentication');
            });
            
            // Countdown timer
            let countdown = 3;
            const countdownEl = document.getElementById('countdown');
            
            const timer = setInterval(() => {
              countdown--;
              if (countdownEl) {
                countdownEl.textContent = countdown;
              }
              
              if (countdown <= 0) {
                clearInterval(timer);
                window.close();
              }
            }, 1000);
          </script>
        </body>
        </html>
      `);
    } else {
      // Web application flow - redirect to dashboard or success page
      const frontendUrl = (process.env.FRONTEND_URL || '').trim();
      res.redirect(`${frontendUrl}/dashboard?token=${jwtToken}`);
    }

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Authentication failed. Please try again.');
  }
});

/**
 * GET /api/auth/verify
 * Verify JWT token validity
 */
router.get('/verify', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Check if user session still exists
  const userSession = await getUserSession(decoded.id);
  if (!userSession) {
    return res.status(401).json({ error: 'Session not found' });
  }

  // Update last accessed time
  userSession.lastAccessed = new Date();
  await setUserSession(decoded.id, userSession);

  res.json({ 
    valid: true, 
    user: {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name
    }
  });
});

/**
 * POST /api/auth/logout
 * Logout user and invalidate session
 */
router.post('/logout', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      // Remove user session
      await deleteUserSession(decoded.id);
    }
  }

  res.json({ success: true, message: 'Logged out successfully' });
});

// Extension token handoff is handled via KV-backed store

/**
 * POST /api/auth/extension-token
 * Store token for extension to retrieve
 */
router.post('/extension-token', async (req, res) => {
  try {
    const { token, userData } = req.body;
    
    if (!token || !userData) {
      return res.status(400).json({ error: 'Token and userData required' });
    }

    const { sessionKey } = await storeExtensionToken(token, userData);
    console.log(`Extension token stored with key: ${sessionKey}`);
    res.json({ success: true, sessionKey });
  } catch (error) {
    console.error('Error storing extension token:', error);
    res.status(500).json({ error: 'Failed to store extension token' });
  }
});

/**
 * GET /api/auth/extension-poll
 * Poll for available extension token
 */
router.get('/extension-poll', async (req, res) => {
  try {
    const latestToken = await pollExtensionToken();
    if (latestToken) {
      console.log('Extension token retrieved and removed');
      res.json({ success: true, token: latestToken.token, userData: latestToken.userData });
    } else {
      res.json({ success: false, message: 'No token available' });
    }
  } catch (error) {
    console.error('Error polling for extension token:', error);
    res.status(500).json({ error: 'Failed to poll for extension token' });
  }
});

/**
 * Clean up expired extension tokens
 */
function cleanupExpiredTokens() { /* no-op with KV-backed store */ }

/**
 * GET /api/auth/sessions
 * Get active sessions count (for debugging in development)
 */
if (process.env.NODE_ENV !== 'production') {
  router.get('/sessions', (req, res) => {
    res.json({ message: 'Session listing is not available in KV mode' });
  });
  
  // Debug endpoint to test success page template
  router.get('/debug-success', (req, res) => {
    // Set CSP to allow inline scripts for this page
    res.setHeader('Content-Security-Policy', "script-src 'self' 'unsafe-inline'; object-src 'self'; frame-ancestors 'none';");
    const testToken = 'debug-token-123';
    const testUserData = {
      id: 'debug-id',
      email: 'debug@example.com',
      name: 'Debug User',
      picture: 'https://example.com/pic.jpg'
    };
    
    // Generate the same template as in the OAuth callback
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>LinkMail - Debug Success Page</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          
          .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 100%;
            padding: 48px 40px;
            text-align: center;
            animation: slideUp 0.5s ease-out;
          }
          
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .logo-container {
            width: 80px;
            height: 80px;
            margin: 0 auto 24px;
            background: #0B66C2;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 16px rgba(11, 102, 194, 0.2);
          }
          
          .logo-icon {
            width: 48px;
            height: 48px;
          }
          
          h1 {
            color: #1f2937;
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 12px;
          }
          
          .subtitle {
            color: #6b7280;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 32px;
          }
          
          .debug-info {
            background: #f3f4f6;
            border-radius: 12px;
            padding: 20px;
            text-align: left;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: #4b5563;
            margin-bottom: 24px;
            max-height: 200px;
            overflow-y: auto;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo-container">
            <svg class="logo-icon" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 20 L50 20 L80 20 L80 35 L65 50 L65 80 L35 80 L35 50 L20 35 Z" fill="white"/>
            </svg>
          </div>
          
          <h1>🔧 Debug Success Page</h1>
          <p class="subtitle">Testing token storage mechanism...</p>
          
          <div class="debug-info" id="debug-output">
            Initializing debug test...<br>
          </div>
        </div>
        
        <script>
          const debugOutput = document.getElementById('debug-output');
          
          function log(message) {
            console.log(message);
            debugOutput.innerHTML += message + '<br>';
            debugOutput.scrollTop = debugOutput.scrollHeight;
          }
          
          log('LinkMail DEBUG: Starting token storage test...');
          log('Token: ${testToken}');
          log('UserData: ${JSON.stringify(testUserData)}');
          
          fetch('/api/auth/extension-token', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              token: '${testToken}',
              userData: ${JSON.stringify(testUserData)}
            })
          }).then(response => {
            log('Extension token endpoint response status: ' + response.status);
            return response.json();
          }).then(data => {
            log('Extension token stored successfully!');
            log('Session Key: ' + data.sessionKey);
            log('Check if extension can poll for this token now');
          }).catch(err => {
            log('ERROR: Failed to store extension token');
            log('Error: ' + err.message);
          });
        </script>
      </body>
      </html>
    `);
  });
}

module.exports = { router };