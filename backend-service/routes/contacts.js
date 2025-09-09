// Contacts routes for LinkMail backend

const express = require('express');
const { body, validationResult, query: vquery } = require('express-validator');
const { getClient, query } = require('../db');

const router = express.Router();

// Helper to normalize and generate LinkedIn URL variants for robust matching
function buildLinkedInUrlVariants(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return [];

  const candidates = new Set();

  const trimmed = rawUrl.trim();
  const lower = trimmed.toLowerCase();
  candidates.add(lower);

  // Toggle trailing slash variants
  if (lower.endsWith('/')) {
    candidates.add(lower.replace(/\/+$/, ''));
  } else {
    candidates.add(`${lower}/`);
  }

  // Ensure scheme for URL parsing
  const ensureScheme = (value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`);

  try {
    const urlWithScheme = ensureScheme(lower);
    const parsed = new URL(urlWithScheme);
    // Normalize host to include or exclude www
    const hostNoWww = parsed.host.replace(/^www\./, '');
    const hostWithWww = hostNoWww.startsWith('www.') ? hostNoWww : `www.${hostNoWww}`;

    // Drop query and hash, keep pathname only
    const pathname = parsed.pathname.replace(/\/+$/, '');

    const httpsBase = `https://${hostNoWww}${pathname}`;
    const httpsBaseWww = `https://${hostWithWww}${pathname}`;

    [httpsBase, `${httpsBase}/`, httpsBaseWww, `${httpsBaseWww}/`].forEach(v => candidates.add(v));

    // Also include host+path without scheme variants
    const noScheme = `${hostNoWww}${pathname}`;
    const noSchemeWww = `${hostWithWww}${pathname}`;
    [noScheme, `${noScheme}/`, noSchemeWww, `${noSchemeWww}/`].forEach(v => candidates.add(v));
  } catch (e) {
    // Ignore parsing errors, we still have basic variants
  }

  return Array.from(candidates);
}

// Normalize noisy company strings from LinkedIn (e.g., "Google · Full-time")
function normalizeCompanyInput(rawCompany) {
  if (!rawCompany || typeof rawCompany !== 'string') return '';
  let value = rawCompany.trim();
  if (!value) return '';
  // Split on common separators used in LinkedIn UI labels
  const separators = ['·', '|', ',', '\\n'];
  for (const sep of separators) {
    if (value.includes(sep)) {
      value = value.split(sep)[0];
    }
  }
  // Collapse multiple spaces, trim again
  value = value.replace(/\s+/g, ' ').trim();
  return value;
}

// Canonicalize to https://www.linkedin.com/in/{slug}/ (lowercased slug, https, www, no query/hash)
function canonicalizeLinkedInProfile(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const input = rawUrl.trim();
  if (!input) return null;
  const ensureScheme = (value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`);
  try {
    const parsed = new URL(ensureScheme(input));
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith('linkedin.com')) return null;
    // Extract slug from /in/{slug}
    const match = parsed.pathname.match(/\/in\/([A-Za-z0-9_-]+)/i);
    if (!match) return null;
    const slug = match[1].toLowerCase();
    return `https://www.linkedin.com/in/${slug}/`;
  } catch {
    return null;
  }
}

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
    linkedinUrl: rawLinkedinUrl = null,
    emails
  } = req.body;

  const emailList = emails == null
    ? []
    : (typeof emails === 'string' ? [emails] : emails).filter((e) => e && e.trim().length > 0);

  // Canonicalize LinkedIn URL if provided
  const linkedinUrl = rawLinkedinUrl
    ? (canonicalizeLinkedInProfile(rawLinkedinUrl) || rawLinkedinUrl.trim())
    : null;

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

/**
 * GET /api/contacts/facets
 * Return distinct job titles, companies, and categories for dropdowns, along with total count
 */
router.get('/facets', async (req, res) => {
  try {
    const [jobTitlesRes, companiesRes, categoriesRes, countRes] = await Promise.all([
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
      ),
      query(
        `SELECT DISTINCT category
         FROM contacts
         WHERE category IS NOT NULL AND length(trim(category)) > 0
         ORDER BY category ASC`
      ),
      query('SELECT COUNT(*) as total_contacts FROM contacts')
    ]);

    const jobTitles = jobTitlesRes.rows.map(r => r.job_title);
    const companies = companiesRes.rows.map(r => r.company);
    const categories = categoriesRes.rows.map(r => r.category);
    const totalContacts = parseInt(countRes.rows[0].total_contacts);

    res.json({ jobTitles, companies, categories, totalContacts });
  } catch (err) {
    console.error('Facets error:', err);
    res.status(500).json({ error: 'InternalError', message: 'Failed to fetch facets' });
  }
});


/**
 * GET /api/contacts/search-similar
 * Query: category, company
 * Returns up to 3 contacts with prioritized search logic:
 * 1) Same category + same company
 * 2) Same company only (if < 3 results)
 * 3) Same category only (if < 3 results)
 * 4) Return whatever found (up to 3 total)
 * Excludes contacts that the user has already contacted
 */
router.get('/search-similar', async (req, res) => {
  try {
    const rawCategory = (req.query.category || '').toString();
    const rawCompany = (req.query.company || '').toString();

    const category = rawCategory.trim();
    const company = rawCompany.trim();

    if (!category || !company) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Both category and company are required'
      });
    }

    // Get user's contacted LinkedIn URLs to exclude from recommendations
    const userId = req.user.id;
    let contactedLinkedins = [];
    try {
      const userProfileSql = `SELECT contacted_linkedins FROM user_profiles WHERE user_id = $1`;
      const userProfileRows = await query(userProfileSql, [userId]);
      if (userProfileRows.rows.length > 0 && userProfileRows.rows[0].contacted_linkedins) {
        contactedLinkedins = userProfileRows.rows[0].contacted_linkedins.map(url => url.toLowerCase());
      }
    } catch (error) {
      console.warn('Could not fetch user contacted linkedins, proceeding without filtering:', error);
    }

    console.log(`Excluding ${contactedLinkedins.length} contacted LinkedIn URLs for user ${userId}`);

    let results = [];

    // Step 1: Search for people with same category AND same company
    console.log(`Step 1: Searching by category: ${category} + company: ${company}`);
    
    // Build exclusion clause for contacted LinkedIn URLs
    const contactedExcludeClause = contactedLinkedins.length > 0 
      ? `AND (linkedin_url IS NULL OR LOWER(linkedin_url) <> ALL($3))`
      : '';
    
    const categoryCompanySql = `
      SELECT id,
             first_name,
             last_name,
             job_title,
             company,
             category,
             linkedin_url
      FROM contacts
      WHERE LOWER(category) = LOWER($1)
        AND LOWER(company) = LOWER($2)
        ${contactedExcludeClause}
      ORDER BY (linkedin_url IS NOT NULL AND length(trim(linkedin_url)) > 0) DESC,
               is_verified DESC,
               updated_at DESC
      LIMIT 3
    `;

    const categoryCompanyParams = contactedLinkedins.length > 0 
      ? [category, company, contactedLinkedins] 
      : [category, company];
    const categoryCompanyRows = await query(categoryCompanySql, categoryCompanyParams);
    results = categoryCompanyRows.rows.map(r => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      jobTitle: r.job_title,
      company: r.company,
      category: r.category || null,
      linkedinUrl: r.linkedin_url || null,
      matchType: 'category_and_company'
    }));

    console.log(`Step 1 results: ${results.length}`);

    // Step 2: If we don't have 3 results, search for same company only
    if (results.length < 3) {
      const remainingNeeded = 3 - results.length;
      console.log(`Step 2: Need ${remainingNeeded} more. Searching by company only: ${company}`);
      
      // Get IDs of existing results to exclude them
      const excludeIds = results.map(r => r.id);
      let paramIndex = 2;
      let whereClause = 'WHERE LOWER(company) = LOWER($1)';
      let params = [company];
      
      // Exclude already found results
      if (excludeIds.length > 0) {
        whereClause += ` AND id NOT IN (${excludeIds.map(() => `$${paramIndex++}`).join(',')})`;
        params.push(...excludeIds);
      }
      
      // Exclude contacted LinkedIn URLs
      if (contactedLinkedins.length > 0) {
        whereClause += ` AND (linkedin_url IS NULL OR LOWER(linkedin_url) <> ALL($${paramIndex}))`;
        params.push(contactedLinkedins);
      }
      
      const companySql = `
        SELECT id,
               first_name,
               last_name,
               job_title,
               company,
               category,
               linkedin_url
        FROM contacts
        ${whereClause}
        ORDER BY (linkedin_url IS NOT NULL AND length(trim(linkedin_url)) > 0) DESC,
                 is_verified DESC,
                 updated_at DESC
        LIMIT ${remainingNeeded}
      `;

      const companyRows = await query(companySql, params);
      
      const companyResults = companyRows.rows.map(r => ({
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        jobTitle: r.job_title,
        company: r.company,
        category: r.category || null,
        linkedinUrl: r.linkedin_url || null,
        matchType: 'company_only'
      }));

      results = results.concat(companyResults);
      console.log(`Step 2 results: ${companyResults.length}, total: ${results.length}`);
    }

    // Step 3: If we still don't have 3 results, search for same category only
    if (results.length < 3) {
      const remainingNeeded = 3 - results.length;
      console.log(`Step 3: Need ${remainingNeeded} more. Searching by category only: ${category}`);
      
      // Get IDs of existing results to exclude them
      const excludeIds = results.map(r => r.id);
      let paramIndex = 2;
      let whereClause = 'WHERE LOWER(category) = LOWER($1)';
      let params = [category];
      
      // Exclude already found results
      if (excludeIds.length > 0) {
        whereClause += ` AND id NOT IN (${excludeIds.map(() => `$${paramIndex++}`).join(',')})`;
        params.push(...excludeIds);
      }
      
      // Exclude contacted LinkedIn URLs
      if (contactedLinkedins.length > 0) {
        whereClause += ` AND (linkedin_url IS NULL OR LOWER(linkedin_url) <> ALL($${paramIndex}))`;
        params.push(contactedLinkedins);
      }
      
      const categorySql = `
        SELECT id,
               first_name,
               last_name,
               job_title,
               company,
               category,
               linkedin_url
        FROM contacts
        ${whereClause}
        ORDER BY (linkedin_url IS NOT NULL AND length(trim(linkedin_url)) > 0) DESC,
                 is_verified DESC,
                 updated_at DESC
        LIMIT ${remainingNeeded}
      `;

      const params_final = params;
      const categoryRows = await query(categorySql, params_final);
      
      const categoryResults = categoryRows.rows.map(r => ({
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        jobTitle: r.job_title,
        company: r.company,
        category: r.category || null,
        linkedinUrl: r.linkedin_url || null,
        matchType: 'category_only'
      }));

      results = results.concat(categoryResults);
      console.log(`Step 3 results: ${categoryResults.length}, total: ${results.length}`);
    }

    console.log(`Search completed. Found ${results.length} results for category: "${category}", company: "${company}"`);
    return res.json({ results });
  } catch (err) {
    console.error('Search similar contacts error:', err);
    return res.status(500).json({ error: 'InternalError', message: 'Failed to search similar contacts' });
  }
});

/**
 * GET /api/contacts/search
 * Query: jobTitle, company
 * Returns up to 3 contacts with name and linkedin url
 * Search logic: 
 * 1) If jobTitle matches a predefined category, search by category + company
 * 2) Otherwise, use job_title substring matching + company
 * Excludes contacts that the user has already contacted
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

    // Get user's contacted LinkedIn URLs to exclude from recommendations
    const userId = req.user.id;
    let contactedLinkedins = [];
    try {
      const userProfileSql = `SELECT contacted_linkedins FROM user_profiles WHERE user_id = $1`;
      const userProfileRows = await query(userProfileSql, [userId]);
      if (userProfileRows.rows.length > 0 && userProfileRows.rows[0].contacted_linkedins) {
        contactedLinkedins = userProfileRows.rows[0].contacted_linkedins.map(url => url.toLowerCase());
      }
    } catch (error) {
      console.warn('Could not fetch user contacted linkedins, proceeding without filtering:', error);
    }

    console.log(`Excluding ${contactedLinkedins.length} contacted LinkedIn URLs for user ${userId} in search`);

    // Build exclusion clause for contacted LinkedIn URLs
    const contactedExcludeClause = contactedLinkedins.length > 0 
      ? `AND (linkedin_url IS NULL OR LOWER(linkedin_url) <> ALL($3))`
      : '';

    // Predefined categories for exact matching
    const predefinedCategories = [
      'Analyst', 'CEO', 'Founder', 'Co-Founder', 'Consultant', 
      'Data Scientist', 'Designer', 'Product Manager', 'Recruiter', 
      'University Recruiter', 'Software Engineer', 'Talent Acquisition'
    ];

    // Check if the jobTitle is one of our predefined categories (case-insensitive)
    const isCategory = predefinedCategories.some(category => 
      category.toLowerCase() === jobTitle.toLowerCase()
    );

    let results = [];

    if (isCategory) {
      // Search by category + company
      console.log(`Searching by category: ${jobTitle} + company: ${company}`);
      
      const categorySearchSql = `
        SELECT id,
               first_name,
               last_name,
               job_title,
               company,
               category,
               linkedin_url
        FROM contacts
        WHERE LOWER(category) = LOWER($1)
          AND LOWER(company) LIKE LOWER($2)
          ${contactedExcludeClause}
        ORDER BY (linkedin_url IS NOT NULL AND length(trim(linkedin_url)) > 0) DESC,
                 is_verified DESC,
                 updated_at DESC
        LIMIT 3
      `;

      const categoryParams = contactedLinkedins.length > 0 
        ? [jobTitle, `%${company}%`, contactedLinkedins] 
        : [jobTitle, `%${company}%`];
      const categoryRows = await query(categorySearchSql, categoryParams);
      results = categoryRows.rows.map(r => ({
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        jobTitle: r.job_title,
        company: r.company,
        category: r.category || null,
        linkedinUrl: r.linkedin_url || null
      }));

    } else {
      // Use existing job_title substring search logic
      console.log(`Searching by job_title substring: ${jobTitle} + company: ${company}`);
      
      // Step 1: Look for exact matches (case-insensitive)
      const exactMatchSql = `
        SELECT id,
               first_name,
               last_name,
               job_title,
               company,
               category,
               linkedin_url
        FROM contacts
        WHERE LOWER(job_title) = LOWER($1)
          AND LOWER(company) = LOWER($2)
          ${contactedExcludeClause}
        ORDER BY (linkedin_url IS NOT NULL AND length(trim(linkedin_url)) > 0) DESC,
                 is_verified DESC,
                 updated_at DESC
        LIMIT 3
      `;

      const exactParams = contactedLinkedins.length > 0 
        ? [jobTitle, company, contactedLinkedins] 
        : [jobTitle, company];
      const exactRows = await query(exactMatchSql, exactParams);
      results = exactRows.rows.map(r => ({
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        jobTitle: r.job_title,
        company: r.company,
        category: r.category || null,
        linkedinUrl: r.linkedin_url || null
      }));

      // Step 2: If we don't have 3 results, look for substring matches
      if (results.length < 3) {
        const remainingNeeded = 3 - results.length;
        
        // Get IDs of exact matches to exclude them from substring search
        const excludeIds = results.map(r => r.id);
        let paramIndex = 3;
        let whereClause = `WHERE (
            LOWER(job_title) LIKE LOWER($1) OR LOWER($1) LIKE LOWER(job_title)
          ) AND (
            LOWER(company) LIKE LOWER($2) OR LOWER($2) LIKE LOWER(company)
          )`;
        let params = [`%${jobTitle}%`, `%${company}%`];
        
        // Exclude already found results
        if (excludeIds.length > 0) {
          whereClause += ` AND id NOT IN (${excludeIds.map(() => `$${paramIndex++}`).join(',')})`;
          params.push(...excludeIds);
        }
        
        // Exclude contacted LinkedIn URLs
        if (contactedLinkedins.length > 0) {
          whereClause += ` AND (linkedin_url IS NULL OR LOWER(linkedin_url) <> ALL($${paramIndex}))`;
          params.push(contactedLinkedins);
        }
        
        const substringMatchSql = `
          SELECT id,
                 first_name,
                 last_name,
                 job_title,
                 company,
                 category,
                 linkedin_url
          FROM contacts
          ${whereClause}
          ORDER BY (linkedin_url IS NOT NULL AND length(trim(linkedin_url)) > 0) DESC,
                   is_verified DESC,
                   updated_at DESC
          LIMIT ${remainingNeeded}
        `;

        const substringRows = await query(substringMatchSql, params);
        
        const substringResults = substringRows.rows.map(r => ({
          id: r.id,
          firstName: r.first_name,
          lastName: r.last_name,
          jobTitle: r.job_title,
          company: r.company,
          category: r.category || null,
          linkedinUrl: r.linkedin_url || null
        }));

        results = results.concat(substringResults);
      }
    }

    console.log(`Search completed. Found ${results.length} results for jobTitle: "${jobTitle}", company: "${company}"`);
    return res.json({ results });
  } catch (err) {
    console.error('Search contacts error:', err);
    return res.status(500).json({ error: 'InternalError', message: 'Failed to search contacts' });
  }
});

/**
 * GET /api/contacts/email-by-linkedin
 * Query: linkedinUrl
 * Returns the best email for a contact matched by LinkedIn URL (case-insensitive, robust to www/trailing slash)
 */
router.get('/email-by-linkedin', [
  vquery('linkedinUrl').isString().trim().notEmpty().withMessage('linkedinUrl is required'),
  vquery('firstName').optional().isString().trim(),
  vquery('lastName').optional().isString().trim(),
  vquery('company').optional().isString().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }

  const rawLinkedinUrl = (req.query.linkedinUrl || '').toString();
  const firstName = (req.query.firstName || '').toString().trim();
  const lastName = (req.query.lastName || '').toString().trim();
  const company = (req.query.company || '').toString().trim();
  const normalizedCompany = normalizeCompanyInput(company);
  try {
    const canonical = canonicalizeLinkedInProfile(rawLinkedinUrl);
    const variants = canonical
      ? [
          canonical.toLowerCase(), 
          canonical.replace(/\/$/, '').toLowerCase(),
          // Also include HTTP variants for backward compatibility
          canonical.toLowerCase().replace('https://', 'http://'),
          canonical.replace(/\/$/, '').toLowerCase().replace('https://', 'http://')
        ]
      : buildLinkedInUrlVariants(rawLinkedinUrl).map(v => v.toLowerCase());
    if (variants.length === 0) {
      return res.status(400).json({ error: 'ValidationError', message: 'Invalid linkedinUrl' });
    }
    
    // Debug: log the variants being searched
    console.log(`[DEBUG] Searching for LinkedIn URL variants:`, variants);

    // Find contact by normalized linkedin_url
    const contactSql = `
      SELECT id, first_name, last_name, job_title, company, category, linkedin_url, is_verified
      FROM contacts
      WHERE linkedin_url IS NOT NULL
        AND length(trim(linkedin_url)) > 0
        AND lower(linkedin_url) = ANY($1)
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    const { rows: contactRows } = await query(contactSql, [variants]);
    let contact = contactRows[0];

    // Fallback: match by name (+ optional company) if linkedin_url not stored in DB
    if (!contact && firstName && lastName) {
      const params = [firstName, lastName];
      let where = `lower(first_name) = lower($1) AND lower(last_name) = lower($2)`;
      if (normalizedCompany) {
        params.push(`%${normalizedCompany}%`);
        where += ` AND company ILIKE $3`;
      }

      const byNameSql = `
        SELECT id, first_name, last_name, job_title, company, category, linkedin_url, is_verified
        FROM contacts
        WHERE ${where}
        ORDER BY is_verified DESC, updated_at DESC
        LIMIT 1
      `;
      const { rows: nameRows } = await query(byNameSql, params);
      contact = nameRows[0];
    }

    if (!contact) {
      return res.json({ found: false, email: null, emails: [] });
    }

    // Get emails ordered by primary and verification
    const emailSql = `
      SELECT email, is_primary, is_verified
      FROM contact_emails
      WHERE contact_id = $1
      ORDER BY is_primary DESC, is_verified DESC, id ASC
    `;
    const { rows: emailRows } = await query(emailSql, [contact.id]);

    const bestEmail = emailRows.length > 0 ? emailRows[0].email : null;

    return res.json({
      found: true,
      contactId: contact.id,
      firstName: contact.first_name,
      lastName: contact.last_name,
      jobTitle: contact.job_title,
      company: contact.company,
      category: contact.category || null,
      linkedinUrl: contact.linkedin_url,
      isVerifiedContact: contact.is_verified,
      email: bestEmail,
      emails: emailRows.map(r => r.email),
      emailMeta: emailRows
    });
  } catch (err) {
    console.error('Lookup email by LinkedIn error:', err);
    return res.status(500).json({ error: 'InternalError', message: 'Failed to look up email' });
  }
});

/**
 * POST /api/contacts/apollo-email-search
 * Search for email using Apollo People Search API
 */
router.post('/apollo-email-search', [
  body('firstName').optional().isString().trim(),
  body('lastName').optional().isString().trim(),
  body('company').optional().isString().trim(),
  body('linkedinUrl').optional().isString().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }

  const { firstName, lastName, company, linkedinUrl } = req.body;

  // Check if we have at least some search criteria
  if (!firstName && !lastName && !company && !linkedinUrl) {
    return res.status(400).json({ error: 'At least one search parameter is required' });
  }

  // Check user's Apollo API usage limit
  const userId = req.user.id;
  const APOLLO_USAGE_LIMIT = 5;

  try {
    // Get current Apollo API usage count
    const userProfileSql = `SELECT apollo_api_calls FROM user_profiles WHERE user_id = $1`;
    const { rows: userProfileRows } = await query(userProfileSql, [userId]);
    
    let currentUsage = 0;
    if (userProfileRows.length > 0 && userProfileRows[0].apollo_api_calls !== null) {
      currentUsage = userProfileRows[0].apollo_api_calls;
    }

    // Check if user has reached the limit
    if (currentUsage >= APOLLO_USAGE_LIMIT) {
      return res.status(403).json({
        error: 'Usage limit exceeded',
        message: 'You have reached your Apollo API usage limit. Please upgrade to get more calls.',
        currentUsage,
        limit: APOLLO_USAGE_LIMIT
      });
    }

    console.log(`User ${userId} Apollo usage: ${currentUsage}/${APOLLO_USAGE_LIMIT}`);
  } catch (usageCheckError) {
    console.error('Error checking Apollo usage:', usageCheckError);
    // Continue with the API call if usage check fails (fail open)
  }

  try {
    // Apollo API configuration
    const apolloApiKey = process.env.APOLLO_API_KEY || 'Z8v_SYe2ByFcVLF3H1bfiA';
    
    if (!apolloApiKey) {
      return res.status(500).json({ error: 'Apollo API key not configured' });
    }

    // Clean up company name (remove duplicates)
    const cleanCompany = company ? company.replace(/(.+)\1+/g, '$1').trim() : '';
    
    // Build Apollo People Enrichment parameters
    const enrichmentParams = new URLSearchParams();
    
    if (firstName) enrichmentParams.append('first_name', firstName);
    if (lastName) enrichmentParams.append('last_name', lastName);
    if (cleanCompany) enrichmentParams.append('organization_name', cleanCompany);
    if (linkedinUrl) enrichmentParams.append('linkedin_url', linkedinUrl);
    
    // Enable email revelation 
    enrichmentParams.append('reveal_personal_emails', 'true');

    console.log('Apollo People Enrichment parameters:', Object.fromEntries(enrichmentParams));

    // Make request to Apollo People Enrichment API
    const apolloResponse = await fetch(`https://api.apollo.io/api/v1/people/match?${enrichmentParams.toString()}`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'X-Api-Key': apolloApiKey
      }
    });

    if (!apolloResponse.ok) {
      const errorText = await apolloResponse.text();
      console.error('Apollo API error:', apolloResponse.status, errorText);
      return res.status(500).json({ 
        error: 'Apollo API request failed', 
        message: `Apollo returned ${apolloResponse.status}: ${errorText}` 
      });
    }

    const apolloData = await apolloResponse.json();
    console.log('Apollo People Enrichment response:', JSON.stringify(apolloData, null, 2));

    // Process Apollo People Enrichment response
    if (!apolloData.person) {
      return res.json({
        success: false,
        message: 'No person found in Apollo database with the provided information',
        apolloResponse: apolloData,
        searchParams: { firstName, lastName, cleanCompany, linkedinUrl }
      });
    }

    const person = apolloData.person;
    console.log('Apollo enriched person:', person.name, person.email);

    // Extract email from the enriched person
    let email = person.email;

    if (email) {
      // Persist contact and email into our database
      let savedContact = null;
      let saved = false;
      const client = await getClient();
      try {
        await client.query('BEGIN');

        // Resolve best available identity fields
        const resolvedFirst = (person.first_name || firstName || '').toString().trim();
        const resolvedLast = (person.last_name || lastName || '').toString().trim();
        const resolvedCompany = normalizeCompanyInput(person.organization?.name || company || '');
        const resolvedTitle = (person.title || '').toString().trim();
        const rawLinkedin = (person.linkedin_url || linkedinUrl || '').toString().trim();
        const canonical = canonicalizeLinkedInProfile(rawLinkedin);

        // Try to find existing contact by linkedin_url variants first
        let contactRow = null;
        if (rawLinkedin) {
          const variants = canonical
            ? [
                canonical.toLowerCase(), 
                canonical.replace(/\/$/, '').toLowerCase(),
                // Also include HTTP variants for backward compatibility
                canonical.toLowerCase().replace('https://', 'http://'),
                canonical.replace(/\/$/, '').toLowerCase().replace('https://', 'http://')
              ]
            : buildLinkedInUrlVariants(rawLinkedin).map(v => v.toLowerCase());
          if (variants.length > 0) {
            const { rows } = await client.query(
              `SELECT id, first_name, last_name, job_title, company, linkedin_url, is_verified
               FROM contacts
               WHERE linkedin_url IS NOT NULL AND length(trim(linkedin_url)) > 0
                 AND lower(linkedin_url) = ANY($1)
               ORDER BY updated_at DESC
               LIMIT 1`,
              [variants]
            );
            contactRow = rows[0] || null;
          }
        }

        // Fallback: find by name (+ optional company)
        if (!contactRow && resolvedFirst && resolvedLast) {
          const params = [resolvedFirst, resolvedLast];
          let where = `lower(first_name) = lower($1) AND lower(last_name) = lower($2)`;
          if (resolvedCompany) {
            params.push(`%${resolvedCompany}%`);
            where += ` AND company ILIKE $3`;
          }
          const { rows } = await client.query(
            `SELECT id, first_name, last_name, job_title, company, linkedin_url, is_verified
             FROM contacts
             WHERE ${where}
             ORDER BY is_verified DESC, updated_at DESC
             LIMIT 1`,
            params
          );
          contactRow = rows[0] || null;
        }

        // Insert contact if not found
        if (!contactRow) {
          const insertSql = `
            INSERT INTO contacts (first_name, last_name, job_title, company, city, state, country, is_verified, linkedin_url)
            VALUES ($1, $2, $3, $4, NULL, NULL, NULL, $5, $6)
            RETURNING id, first_name, last_name, job_title, company, linkedin_url, is_verified
          `;
          const { rows } = await client.query(insertSql, [
            resolvedFirst || null,
            resolvedLast || null,
            resolvedTitle || null,
            resolvedCompany || null,
            true,
            canonical || (rawLinkedin || null)
          ]);
          contactRow = rows[0];
        } else {
          // Optionally refresh sparse fields we may have learned from Apollo
          const maybeUpdate = [];
          const params = [];
          let idx = 1;
          if (resolvedTitle && !contactRow.job_title) { maybeUpdate.push(`job_title = $${idx++}`); params.push(resolvedTitle); }
          if (resolvedCompany && !contactRow.company) { maybeUpdate.push(`company = $${idx++}`); params.push(resolvedCompany); }
          if (canonical && !contactRow.linkedin_url) { maybeUpdate.push(`linkedin_url = $${idx++}`); params.push(canonical); }
          // Mark contact as verified because email came from Apollo
          maybeUpdate.push(`is_verified = TRUE`);
          if (maybeUpdate.length > 0) {
            params.push(contactRow.id);
            await client.query(`UPDATE contacts SET ${maybeUpdate.join(', ')}, updated_at = NOW() WHERE id = $${idx}`, params);
          }
        }

        // Ensure email row exists; set primary if none exists yet
        let isPrimary = false;
        {
          const { rows } = await client.query(
            'SELECT COUNT(1) AS n FROM contact_emails WHERE contact_id = $1',
            [contactRow.id]
          );
          isPrimary = (parseInt(rows[0]?.n || '0', 10) === 0);
        }

        // Email obtained via Apollo: treat as verified
        const isEmailVerified = true;

        await client.query(
          `INSERT INTO contact_emails (contact_id, email, is_primary, is_verified)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (contact_id, email) DO UPDATE SET
             is_verified = TRUE
          `,
          [contactRow.id, email, isPrimary, isEmailVerified]
        );

        await client.query('COMMIT');
        saved = true;

        const { rows: viewRows } = await query(
          'SELECT * FROM contacts_with_emails WHERE id = $1',
          [contactRow.id]
        );
        savedContact = viewRows[0] || contactRow;
      } catch (persistErr) {
        console.error('Apollo enrichment persistence error:', persistErr);
        try { await client.query('ROLLBACK'); } catch (_) {}
      } finally {
        client.release();
      }

      // Increment Apollo API usage counter for successful email retrieval
      try {
        await query(`
          INSERT INTO user_profiles (user_id, apollo_api_calls)
          VALUES ($1, 1)
          ON CONFLICT (user_id)
          DO UPDATE SET
            apollo_api_calls = COALESCE(user_profiles.apollo_api_calls, 0) + 1,
            updated_at = NOW()
        `, [userId]);
        console.log(`Incremented Apollo usage for user ${userId}`);
      } catch (incrementError) {
        console.error('Error incrementing Apollo usage count:', incrementError);
        // Don't fail the request if counter increment fails
      }

      return res.json({
        success: true,
        email: email,
        saved,
        savedContact,
        contact: {
          name: person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim(),
          title: person.title,
          company: person.organization?.name,
          linkedin_url: person.linkedin_url,
          email_status: person.email_status,
          photo_url: person.photo_url
        },
        enrichmentMethod: 'apollo_people_enrichment',
        apolloResponse: apolloData
      });
    } else {
      return res.json({
        success: false,
        message: 'Person found in Apollo but no email available',
        contact: {
          name: person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim(),
          title: person.title,
          company: person.organization?.name,
          linkedin_url: person.linkedin_url,
          photo_url: person.photo_url
        },
        enrichmentMethod: 'apollo_people_enrichment',
        apolloResponse: apolloData
      });
    }

  } catch (err) {
    console.error('Apollo email search error:', err);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: 'Failed to search Apollo API',
      details: err.message 
    });
  }
});

/**
 * GET /api/contacts/autocomplete
 * Query: type (jobTitle|company), q (search query)
 * Returns autocomplete suggestions for job titles or companies
 */
router.get('/autocomplete', async (req, res) => {
  try {
    console.log('Autocomplete request received:', { 
      type: req.query.type, 
      q: req.query.q, 
      user: req.user?.email 
    });
    
    const type = req.query.type;
    const searchQuery = (req.query.q || '').toString().trim();

    if (!type || !['jobTitle', 'company', 'category'].includes(type)) {
      console.log('Invalid type parameter:', type);
      return res.status(400).json({
        error: 'ValidationError',
        message: 'type must be either "jobTitle", "company", or "category"'
      });
    }

    if (!searchQuery || searchQuery.length < 1) {
      console.log('Empty search query, returning empty suggestions');
      return res.json({ suggestions: [] });
    }

    let sql;
    let params;
    
    // Use simpler SQL approach similar to facets endpoint for better compatibility
    if (type === 'jobTitle') {
      sql = `
        SELECT DISTINCT job_title as value
        FROM contacts
        WHERE job_title IS NOT NULL 
          AND length(trim(job_title)) > 0
          AND LOWER(job_title) LIKE $1
        ORDER BY 
          CASE WHEN LOWER(job_title) LIKE $2 THEN 0 ELSE 1 END,
          length(job_title) ASC,
          job_title ASC
        LIMIT 10
      `;
    } else if (type === 'company') {
      sql = `
        SELECT DISTINCT company as value
        FROM contacts
        WHERE company IS NOT NULL 
          AND length(trim(company)) > 0
          AND LOWER(company) LIKE $1
        ORDER BY 
          CASE WHEN LOWER(company) LIKE $2 THEN 0 ELSE 1 END,
          length(company) ASC,
          company ASC
        LIMIT 10
      `;
    } else if (type === 'category') {
      sql = `
        SELECT DISTINCT category as value
        FROM contacts
        WHERE category IS NOT NULL 
          AND length(trim(category)) > 0
          AND LOWER(category) LIKE $1
        ORDER BY 
          CASE WHEN LOWER(category) LIKE $2 THEN 0 ELSE 1 END,
          length(category) ASC,
          category ASC
        LIMIT 10
      `;
    }

    // Prepare parameters with proper escaping
    const searchLower = searchQuery.toLowerCase();
    const containsPattern = `%${searchLower}%`;
    const startsWithPattern = `${searchLower}%`;
    params = [containsPattern, startsWithPattern];

    console.log('Executing SQL query for type:', type);
    console.log('SQL:', sql.replace(/\s+/g, ' ').trim());
    console.log('Query parameters:', params);
    
    const result = await query(sql, params);
    console.log('Query result:', { rowCount: result.rows.length });
    
    const suggestions = result.rows.map(row => row.value);

    console.log('Returning suggestions:', suggestions.slice(0, 3)); // Log first 3 for debugging
    res.json({ suggestions });
  } catch (err) {
    console.error('Autocomplete error details:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
      sqlState: err.sqlState,
      type: req.query.type,
      query: req.query.q
    });
    res.status(500).json({ 
      error: 'InternalError', 
      message: 'Failed to fetch autocomplete suggestions',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;
