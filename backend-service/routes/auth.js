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
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];

  // Encode source and referral code in state parameter
  const stateData = {
    source: req.query.source || 'web',
    ref: req.query.ref || null
  };

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: JSON.stringify(stateData)
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

  // Parse state parameter to extract source and referral code
  let stateData = { source: 'web', ref: null };
  try {
    if (state) {
      stateData = typeof state === 'string' && state.startsWith('{') 
        ? JSON.parse(state) 
        : { source: state, ref: null };
    }
  } catch (e) {
    console.error('Failed to parse state parameter:', e);
    stateData = { source: state || 'web', ref: null };
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
      googleTokens: tokens,
      pendingReferralCode: stateData.ref || null
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
    if (stateData.source === 'extension') {
      // Set CSP to allow inline scripts for this page
      res.setHeader('Content-Security-Policy', "script-src 'self' 'unsafe-inline'; object-src 'self'; frame-ancestors 'none';");
      
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Linkmail Success</title>
          <style>
            /* Minimal, theme-aligned styling */
            :root { --bg: #F8FAFC; --fg: #ffffff; --text: #202020; --muted: #00000094; --accent: #0B66C2; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body { height: 100%; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
              background: var(--bg);
              color: var(--text);
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 24px;
            }
            .card {
              background: var(--fg);
              border-radius: 24px; /* rounded-3xl */
              width: 100%;
              max-width: 400px;
              padding: 36px;
              text-align: center;
              border: 1px solid rgba(0,0,0,0.08);
              box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06);
            }
            .logo {
              display: block;
              width: 56px;
              height: 56px;
              margin: 4px auto 16px auto;
              object-fit: contain;
              margin-bottom:48px;
            }
            .hint { 
                font-size: 12px; 
                color: var(--muted);
                opacity: 0.65;
            }

            h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 8px; }
            p { font-size: 14px; color: var(--muted); line-height: 1.6; }
            .mt-3 { margin-top: 12px; }
            .mt-4 { margin-top: 16px; }
            .mt-6 { margin-top: 24px; }
            .btn {
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              border: 1px solid rgba(0,0,0,0.08);
              background: #0B66C2;
              color: #ffffff;
              padding: 6px 16px;
              border-radius: 10px;
              font-weight: 500;
              font-size: 14px;
              transition: background 120ms ease, transform 120ms ease;
            }
            a {
                cursor: pointer;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              border: 1px solid rgba(0,0,0,0.08);
              background: #f5f5f5;
              color: #626262;
              padding: 6px 16px;
              border-radius: 10px;
              font-weight: 400;
              font-size: 14px;
              transition: background 120ms ease, transform 120ms ease;
              text-decoration: none;
            }
            .btn:hover { background: #116fce; }
            .btn:active { transform: translateY(1px); }
            .hint { font-size: 12px; color: var(--muted); }
          </style>
        </head>
        <body>
          <div class="card">
            <img class="logo" alt="LinkMail logo" src="https://i.imgur.com/8KeJWZl.png" />
            <h1>Linkmail is Ready</h1>
            <p class="mt-6">You should now be able to use Linkmail to outreach on LinkedIn. Time to lock in!</p>
            <div class="mt-6" style="display:flex; justify-content:center; gap:8px;">
              <button class="btn" onclick="window.open('https://www.linkedin.com/in/ishaangpta/', '_target')">Begin</button>
              <a href="mailto:jaysontian@g.ucla.edu">Contact Us</a>
            </div>
          </div>
          <script>
            // Silently notify extension with token
            fetch('/api/auth/extension-token', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: '${jwtToken}', userData: ${JSON.stringify(userData)} })
            }).catch(() => {});
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
            <svg class="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4 L20 4 L20 8 L16 12 L16 20 L8 20 L8 12 L4 8 Z" fill="white"/>
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