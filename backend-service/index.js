// LinkMail Backend Service
// Handles OAuth authentication and email sending for the LinkMail extension

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { router: authRoutes } = require('./routes/auth');
const emailRoutes = require('./routes/email');
const userRoutes = require('./routes/user');
const { authenticateToken } = require('./middleware/auth');
const contactsRoutes = require('./routes/contacts');
const { router: connectionsRoutes } = require('./routes/connections');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// Rate limiting (more lenient for development)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // increased limit for development
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow chrome extensions
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    
    // Allow specific domains
    const allowedOrigins = [
      'https://www.linkedin.com',
      'https://linkedin.com',
      'https://linkmail-web.vercel.app',
      'https://linkmail-sending.vercel.app', // allow same-origin success page
      'https://www.linkmail.dev',
      'https://linkmail.dev', // Add without www as well
      'http://localhost:3000',
      'http://localhost:3001'
    ];

    // Also allow FRONTEND_URL if provided
    const frontendUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.trim() : '';
    if (frontendUrl && !allowedOrigins.includes(frontendUrl)) {
      allowedOrigins.push(frontendUrl);
    }
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.log('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));
// Explicitly handle preflight requests so they don't fall through to 404
app.options('*', cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files statically  
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/email', authenticateToken, emailRoutes);
app.use('/api/user', authenticateToken, userRoutes);
app.use('/api/contacts', authenticateToken, contactsRoutes);
app.use('/api/connections', authenticateToken, connectionsRoutes);
app.use('/api/upload', uploadRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authentication token'
    });
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong!' 
      : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found'
  });
});

// Export the Express app for serverless environments (e.g., Vercel)
module.exports = app;

// Start server only when running locally (not in serverless envs)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 LinkMail Backend running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}