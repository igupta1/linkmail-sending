// Connections routes for LinkMail backend
// Manages connections between users and contacts, including message tracking

const express = require('express');
const { body, validationResult, param } = require('express-validator');
const { getClient, query } = require('../db');

const router = express.Router();

/**
 * Helper function to find or create a connection between user and contact
 * @param {string} userId - User ID
 * @param {number} contactId - Contact ID
 * @param {string} subject - Connection subject
 * @returns {Object} Connection object
 */
async function findOrCreateConnection(userId, contactId, subject = null) {
  const client = await getClient();
  
  try {
    // Try to find existing connection
    const findSql = `
      SELECT * FROM connections 
      WHERE user_id = $1 AND contact_id = $2
    `;
    const { rows: existingConnections } = await client.query(findSql, [userId, contactId]);
    
    if (existingConnections.length > 0) {
      return existingConnections[0];
    }
    
    // Create new connection
    const insertSql = `
      INSERT INTO connections (user_id, contact_id, subject, status)
      VALUES ($1, $2, $3, 'active')
      RETURNING *
    `;
    const { rows: newConnections } = await client.query(insertSql, [userId, contactId, subject]);
    return newConnections[0];
    
  } finally {
    client.release();
  }
}

/**
 * Add a message to a connection's messages array
 * @param {string} userId - User ID
 * @param {number} contactId - Contact ID
 * @param {Object} message - Message object to add
 * @returns {Object} Updated connection
 */
async function addMessageToConnection(userId, contactId, message) {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Get current connection
    const getConnectionSql = `
      SELECT * FROM connections 
      WHERE user_id = $1 AND contact_id = $2
    `;
    const { rows: connections } = await client.query(getConnectionSql, [userId, contactId]);
    
    if (connections.length === 0) {
      throw new Error('Connection not found');
    }
    
    const connection = connections[0];
    const currentMessages = connection.messages || [];
    
    // Add new message with unique ID
    const messageWithId = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...message,
      added_at: new Date().toISOString()
    };
    
    const updatedMessages = [...currentMessages, messageWithId];
    
    // Update connection with new message
    const updateSql = `
      UPDATE connections 
      SET messages = $1, updated_at = NOW()
      WHERE user_id = $2 AND contact_id = $3
      RETURNING *
    `;
    const { rows: updatedConnections } = await client.query(
      updateSql, 
      [JSON.stringify(updatedMessages), userId, contactId]
    );
    
    await client.query('COMMIT');
    return updatedConnections[0];
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * GET /api/connections
 * Get all connections for the authenticated user
 */
router.get('/', async (req, res) => {
  const userId = req.user.id;
  
  try {
    const sql = `
      SELECT 
        c.*,
        co.first_name,
        co.last_name,
        co.job_title,
        co.company,
        co.linkedin_url,
        ce.email as primary_email
      FROM connections c
      JOIN contacts co ON c.contact_id = co.id
      LEFT JOIN contact_emails ce ON co.id = ce.contact_id AND ce.is_primary = true
      WHERE c.user_id = $1
      ORDER BY c.updated_at DESC
    `;
    
    const { rows } = await query(sql, [userId]);
    
    res.json({
      success: true,
      connections: rows,
      total: rows.length
    });
    
  } catch (error) {
    console.error('Error fetching connections:', error);
    res.status(500).json({
      error: 'Failed to fetch connections',
      message: 'An error occurred while retrieving your connections'
    });
  }
});

/**
 * GET /api/connections/:contactId
 * Get specific connection with full message history
 */
router.get('/:contactId', [
  param('contactId').isInt().withMessage('Contact ID must be a valid integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  
  const userId = req.user.id;
  const contactId = parseInt(req.params.contactId);
  
  try {
    const sql = `
      SELECT 
        c.*,
        co.first_name,
        co.last_name,
        co.job_title,
        co.company,
        co.linkedin_url,
        ce.email as primary_email
      FROM connections c
      JOIN contacts co ON c.contact_id = co.id
      LEFT JOIN contact_emails ce ON co.id = ce.contact_id AND ce.is_primary = true
      WHERE c.user_id = $1 AND c.contact_id = $2
    `;
    
    const { rows } = await query(sql, [userId, contactId]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Connection not found',
        message: 'No connection found for this contact'
      });
    }
    
    res.json({
      success: true,
      connection: rows[0]
    });
    
  } catch (error) {
    console.error('Error fetching connection:', error);
    res.status(500).json({
      error: 'Failed to fetch connection',
      message: 'An error occurred while retrieving the connection'
    });
  }
});

/**
 * PUT /api/connections/:contactId/status
 * Update connection status
 */
router.put('/:contactId/status', [
  param('contactId').isInt().withMessage('Contact ID must be a valid integer'),
  body('status').isIn(['active', 'closed', 'follow_up_needed', 'responded', 'meeting_scheduled', 'converted'])
    .withMessage('Invalid status')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  
  const userId = req.user.id;
  const contactId = parseInt(req.params.contactId);
  const { status } = req.body;
  
  try {
    const sql = `
      UPDATE connections 
      SET status = $1, updated_at = NOW()
      WHERE user_id = $2 AND contact_id = $3
      RETURNING *
    `;
    
    const { rows } = await query(sql, [status, userId, contactId]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Connection not found',
        message: 'No connection found for this contact'
      });
    }
    
    res.json({
      success: true,
      connection: rows[0],
      message: 'Status updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating connection status:', error);
    res.status(500).json({
      error: 'Failed to update status',
      message: 'An error occurred while updating the connection status'
    });
  }
});

/**
 * PUT /api/connections/:contactId/notes
 * Update connection notes
 */
router.put('/:contactId/notes', [
  param('contactId').isInt().withMessage('Contact ID must be a valid integer'),
  body('notes').isString().withMessage('Notes must be a string')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  
  const userId = req.user.id;
  const contactId = parseInt(req.params.contactId);
  const { notes } = req.body;
  
  try {
    const sql = `
      UPDATE connections 
      SET notes = $1, updated_at = NOW()
      WHERE user_id = $2 AND contact_id = $3
      RETURNING *
    `;
    
    const { rows } = await query(sql, [notes, userId, contactId]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Connection not found',
        message: 'No connection found for this contact'
      });
    }
    
    res.json({
      success: true,
      connection: rows[0],
      message: 'Notes updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating connection notes:', error);
    res.status(500).json({
      error: 'Failed to update notes',
      message: 'An error occurred while updating the connection notes'
    });
  }
});

// Export helper functions for use in other modules
module.exports = {
  router,
  findOrCreateConnection,
  addMessageToConnection
};
