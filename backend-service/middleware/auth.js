// Authentication middleware for LinkMail backend

const jwt = require('jsonwebtoken');

/**
 * Middleware to authenticate JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Access token required',
      message: 'Please provide a valid authentication token'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('Token verification failed:', err);
      return res.status(403).json({
        error: 'Invalid token',
        message: 'The provided token is invalid or expired'
      });
    }

    req.user = user;
    next();
  });
}

/**
 * Generate JWT token for user
 * @param {Object} userData - User data to encode in token
 * @returns {string} JWT token
 */
function generateToken(userData) {
  return jwt.sign(
    {
      id: userData.id,
      email: userData.email,
      name: userData.name
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    }
  );
}

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded token data or null if invalid
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

module.exports = {
  authenticateToken,
  generateToken,
  verifyToken
};