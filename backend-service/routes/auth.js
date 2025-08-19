// Authentication routes for LinkMail backend

const express = require('express');
const { google } = require('googleapis');
const { generateToken, verifyToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// In-memory storage for user sessions (in production, use a database)
const userSessions = new Map();

/**
 * Initialize Google OAuth2 client
 */
function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
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
    const oauth2Client = getOAuth2Client();
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
    userSessions.set(profile.id, {
      ...userData,
      createdAt: new Date(),
      lastAccessed: new Date()
    });

    // Generate JWT token
    const jwtToken = generateToken(userData);

    // If request came from extension, show success page with token
    if (state === 'extension') {
      // Set CSP to allow inline scripts for this page
      res.setHeader('Content-Security-Policy', "script-src 'self' 'unsafe-inline'; object-src 'self'; frame-ancestors 'none';");
      
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>LinkMail - Authentication Successful</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                   max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
            .success { color: #28a745; margin-bottom: 20px; }
            .token { background: #f8f9fa; padding: 15px; border-radius: 5px; 
                     word-break: break-all; margin: 20px 0; }
            .instructions { background: #e9ecef; padding: 15px; border-radius: 5px; 
                          text-align: left; }
          </style>
        </head>
        <body>
          <h1 class="success">✅ Authentication Successful!</h1>
          <p>You have successfully signed in to LinkMail.</p>
          <p><strong>You can now close this tab and return to LinkedIn.</strong></p>
          
          <div class="instructions">
            <h3>Next Steps:</h3>
            <ol>
              <li>Close this browser tab</li>
              <li>Return to LinkedIn</li>
              <li>The extension should now be authenticated and ready to use</li>
            </ol>
          </div>
          
          <script>
            // Set a session flag that the extension can detect via polling
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
            
            // Auto-close after 3 seconds
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
        </html>
      `);
    } else {
      // Web application flow - redirect to dashboard or success page
      res.redirect(`${process.env.FRONTEND_URL}/dashboard?token=${jwtToken}`);
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
router.get('/verify', (req, res) => {
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
  const userSession = userSessions.get(decoded.id);
  if (!userSession) {
    return res.status(401).json({ error: 'Session not found' });
  }

  // Update last accessed time
  userSession.lastAccessed = new Date();
  userSessions.set(decoded.id, userSession);

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
router.post('/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      // Remove user session
      userSessions.delete(decoded.id);
    }
  }

  res.json({ success: true, message: 'Logged out successfully' });
});

// Store for extension tokens (temporary storage)
const extensionTokens = new Map();

/**
 * POST /api/auth/extension-token
 * Store token for extension to retrieve
 */
router.post('/extension-token', (req, res) => {
  try {
    const { token, userData } = req.body;
    
    if (!token || !userData) {
      return res.status(400).json({ error: 'Token and userData required' });
    }

    // Generate a temporary key for this auth session
    const sessionKey = `ext_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    // Store token with expiration (5 minutes)
    extensionTokens.set(sessionKey, {
      token,
      userData,
      createdAt: Date.now(),
      expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes
    });

    // Clean up expired tokens
    cleanupExpiredTokens();

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
router.get('/extension-poll', (req, res) => {
  try {
    // Clean up expired tokens first
    cleanupExpiredTokens();

    // Find the most recent valid token
    let latestToken = null;
    let latestTime = 0;

    for (const [key, tokenData] of extensionTokens.entries()) {
      if (tokenData.createdAt > latestTime) {
        latestTime = tokenData.createdAt;
        latestToken = { key, ...tokenData };
      }
    }

    if (latestToken) {
      // Remove the token after retrieval (one-time use)
      extensionTokens.delete(latestToken.key);
      
      console.log('Extension token retrieved and removed');
      res.json({
        success: true,
        token: latestToken.token,
        userData: latestToken.userData
      });
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
function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [key, tokenData] of extensionTokens.entries()) {
    if (now > tokenData.expiresAt) {
      extensionTokens.delete(key);
    }
  }
}

/**
 * GET /api/auth/sessions
 * Get active sessions count (for debugging in development)
 */
if (process.env.NODE_ENV !== 'production') {
  router.get('/sessions', (req, res) => {
    res.json({
      totalSessions: userSessions.size,
      sessions: Array.from(userSessions.entries()).map(([id, session]) => ({
        id,
        email: session.email,
        name: session.name,
        createdAt: session.createdAt,
        lastAccessed: session.lastAccessed
      }))
    });
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
      <html>
      <head>
        <title>LinkMail - Debug Success Page</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                 max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
          .success { color: #28a745; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1 class="success">🔧 Debug Success Page</h1>
        <p>Testing token storage mechanism...</p>
        
        <script>
          console.log('LinkMail DEBUG: Starting token storage test...');
          console.log('Token:', '${testToken}');
          console.log('UserData:', ${JSON.stringify(testUserData)});
          
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
            console.log('LinkMail DEBUG: Extension token endpoint response status:', response.status);
            return response.json();
          }).then(data => {
            console.log('LinkMail DEBUG: Extension token stored successfully:', data);
            console.log('LinkMail DEBUG: Check if extension can poll for this token now');
          }).catch(err => {
            console.error('LinkMail DEBUG: Failed to store extension token:', err);
          });
        </script>
      </body>
      </html>
    `);
  });
}

module.exports = { router, userSessions };