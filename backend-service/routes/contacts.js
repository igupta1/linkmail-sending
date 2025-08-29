// Contacts routes for LinkMail backend

const express = require('express');
const { body, validationResult } = require('express-validator');
const { getClient, query } = require('../db');

const router = express.Router();

/**
 * POST /api/contacts
 * Create a contact with optional emails
 */
router.post('/', [
  body('firstName').isString().trim().notEmpty().withMessage('First Name is required'),
  body('lastName').isString().trim().notEmpty().withMessage('Last Name is required'),
  body('jobTitle').optional().isString().trim(),
  body('company').optional().isString().trim(),
  body('city').optional().isString().trim(),
  body('state').optional().isString().trim(),
  body('country').optional().isString().trim(),
  body('isVerified').optional().isBoolean(),
  body('linkedinUrl').optional().isString().trim(),
  body('emails').optional().custom((value) => {
    if (value == null) return true;
    if (typeof value === 'string') return true;
    if (Array.isArray(value) && value.every((e) => typeof e === 'string')) return true;
    throw new Error('Emails must be a string or an array of strings');
  })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }

  const {
    firstName,
    lastName,
    jobTitle = null,
    company = null,
    city = null,
    state = null,
    country = null,
    isVerified = false,
    linkedinUrl = null,
    emails
  } = req.body;

  const emailList = emails == null
    ? []
    : (typeof emails === 'string' ? [emails] : emails).filter((e) => e && e.trim().length > 0);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const insertContact = `
      INSERT INTO contacts (first_name, last_name, job_title, company, city, state, country, is_verified, linkedin_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, first_name, last_name, job_title, company, city, state, country, is_verified, linkedin_url, created_at, updated_at
    `;
    const contactResult = await client.query(insertContact, [
      firstName, lastName, jobTitle, company, city, state, country, Boolean(isVerified), linkedinUrl
    ]);
    const contact = contactResult.rows[0];

    if (emailList.length > 0) {
      const insertEmail = `
        INSERT INTO contact_emails (contact_id, email, is_primary, is_verified)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (contact_id, email) DO NOTHING
        RETURNING id, email, is_primary
      `;
      for (let index = 0; index < emailList.length; index++) {
        const email = emailList[index].trim();
        const isPrimary = index === 0;
        await client.query(insertEmail, [contact.id, email, isPrimary, Boolean(isVerified)]);
      }
    }

    await client.query('COMMIT');

    const { rows: viewRows } = await client.query(
      'SELECT * FROM contacts_with_emails WHERE id = $1',
      [contact.id]
    );

    res.status(201).json({ success: true, contact: viewRows[0] || contact });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create contact error:', err);
    if (err.code === '23505') { // unique violation
      return res.status(409).json({ error: 'Duplicate', message: 'Contact or email already exists' });
    }
    res.status(500).json({ error: 'Failed to create contact' });
  } finally {
    client.release();
  }
});

module.exports = router;

/**
 * GET /api/contacts/facets
 * Return distinct job titles and companies for dropdowns
 */
router.get('/facets', async (req, res) => {
  try {
    const [jobTitlesRes, companiesRes] = await Promise.all([
      query(
        `SELECT DISTINCT ON (lower(job_title)) job_title
         FROM contacts
         WHERE job_title IS NOT NULL AND length(trim(job_title)) > 0
         ORDER BY lower(job_title), job_title ASC`
      ),
      query(
        `SELECT DISTINCT ON (lower(company)) company
         FROM contacts
         WHERE company IS NOT NULL AND length(trim(company)) > 0
         ORDER BY lower(company), company ASC`
      )
    ]);

    const jobTitles = jobTitlesRes.rows.map(r => r.job_title);
    const companies = companiesRes.rows.map(r => r.company);

    res.json({ jobTitles, companies });
  } catch (err) {
    console.error('Facets error:', err);
    res.status(500).json({ error: 'InternalError', message: 'Failed to fetch facets' });
  }
});


/**
 * GET /api/contacts/search
 * Query: jobTitle, company
 * Returns up to 3 contacts with name and linkedin url
 */
router.get('/search', async (req, res) => {
  try {
    const rawJobTitle = (req.query.jobTitle || '').toString();
    const rawCompany = (req.query.company || '').toString();

    const jobTitle = rawJobTitle.trim();
    const company = rawCompany.trim();

    if (!jobTitle || !company) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Both jobTitle and company are required'
      });
    }

    // Case-insensitive, partial match, prefer verified and those with linkedin_url
    const sql = `
      SELECT id,
             first_name,
             last_name,
             job_title,
             company,
             linkedin_url
      FROM contacts
      WHERE job_title ILIKE $1
        AND company ILIKE $2
      ORDER BY (linkedin_url IS NOT NULL AND length(trim(linkedin_url)) > 0) DESC,
               is_verified DESC,
               updated_at DESC
      LIMIT 3
    `;

    // Use wildcard matching on both sides to allow partials provided by dropdowns just in case
    const { rows } = await query(sql, [
      `%${jobTitle}%`,
      `%${company}%`
    ]);

    const results = rows.map(r => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      jobTitle: r.job_title,
      company: r.company,
      linkedinUrl: r.linkedin_url || null
    }));

    return res.json({ results });
  } catch (err) {
    console.error('Search contacts error:', err);
    return res.status(500).json({ error: 'InternalError', message: 'Failed to search contacts' });
  }
});

