// Installation landing page route for referral links

const express = require('express');
const router = express.Router();

/**
 * GET /install
 * Landing page for referral links
 * Redirects to Chrome Web Store with referral code stored
 */
router.get('/', (req, res) => {
  const { ref } = req.query;
  
  // Chrome Web Store URL
  const chromeWebStoreUrl = 'https://chrome.google.com/webstore/detail/linkmail/gehgnliedpckenmdindaioghgkhnfjaa';
  
  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Install LinkMail - Send Personalized Emails on LinkedIn</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        margin: 0;
        background: linear-gradient(135deg, #0B66C2 0%, #004182 100%);
        color: white;
      }
      
      .container {
        text-align: center;
        padding: 3rem 2rem;
        max-width: 600px;
        animation: fadeIn 0.6s ease-out;
      }
      
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .logo {
        font-size: 4rem;
        margin-bottom: 1rem;
        animation: bounce 1s ease-in-out infinite;
      }
      
      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      
      h1 {
        font-size: 2.8rem;
        margin-bottom: 1rem;
        font-weight: 700;
        letter-spacing: -0.02em;
      }
      
      .subtitle {
        font-size: 1.3rem;
        margin-bottom: 2.5rem;
        opacity: 0.95;
        line-height: 1.5;
      }
      
      .ref-badge {
        display: inline-block;
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        padding: 0.6rem 1.2rem;
        border-radius: 50px;
        font-size: 0.9rem;
        margin-bottom: 2rem;
        border: 1px solid rgba(255, 255, 255, 0.3);
      }
      
      .ref-code {
        font-weight: 700;
        font-family: 'Courier New', monospace;
        font-size: 1.1rem;
      }
      
      .btn {
        background: white;
        color: #0B66C2;
        padding: 1.2rem 3rem;
        border-radius: 12px;
        text-decoration: none;
        font-weight: 700;
        font-size: 1.2rem;
        display: inline-block;
        transition: all 0.3s ease;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        cursor: pointer;
        border: none;
      }
      
      .btn:hover {
        transform: translateY(-3px);
        box-shadow: 0 6px 30px rgba(0, 0, 0, 0.3);
        background: #f0f0f0;
      }
      
      .btn:active {
        transform: translateY(-1px);
      }
      
      .features {
        margin-top: 3rem;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 1.5rem;
        text-align: left;
      }
      
      .feature {
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        padding: 1.2rem;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      .feature-icon {
        font-size: 2rem;
        margin-bottom: 0.5rem;
      }
      
      .feature-title {
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 0.3rem;
      }
      
      .feature-desc {
        font-size: 0.85rem;
        opacity: 0.9;
      }
      
      .info {
        margin-top: 2rem;
        font-size: 0.9rem;
        opacity: 0.8;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="logo">📧</div>
      <h1>Install LinkMail</h1>
      <p class="subtitle">Send personalized emails directly from LinkedIn profiles</p>
      
      ${ref ? `<div class="ref-badge">
        Referral Code: <span class="ref-code">${ref}</span>
      </div>` : ''}
      
      <button class="btn" onclick="installExtension()">
        Add to Chrome - It's Free
      </button>
      
      <div class="features">
        <div class="feature">
          <div class="feature-icon">⚡</div>
          <div class="feature-title">Email Finder</div>
          <div class="feature-desc">Find verified email addresses</div>
        </div>
        <div class="feature">
          <div class="feature-icon">✨</div>
          <div class="feature-title">AI Templates</div>
          <div class="feature-desc">Generate personalized messages</div>
        </div>
        <div class="feature">
          <div class="feature-icon">📊</div>
          <div class="feature-title">Track Connections</div>
          <div class="feature-desc">Manage your outreach</div>
        </div>
      </div>
      
      <p class="info">
        ${ref ? 'You were referred by a friend. Install now to help them unlock Premium Plus!' : 'Join thousands of professionals using LinkMail'}
      </p>
    </div>
    
    <script>
      function installExtension() {
        // Store referral code in localStorage before redirecting
        ${ref ? `localStorage.setItem('linkmail_referral_code', '${ref}');` : ''}
        
        // Redirect to Chrome Web Store
        window.location.href = '${chromeWebStoreUrl}';
      }
      
      // Also handle if they press Enter
      document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          installExtension();
        }
      });
    </script>
  </body>
  </html>
  `;
  
  res.send(html);
});

module.exports = router;

