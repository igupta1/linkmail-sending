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
 * Return distinct job titles and companies for dropdowns, along with total count
 */
router.get('/facets', async (req, res) => {
  try {
    const [jobTitlesRes, companiesRes, countRes] = await Promise.all([
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
      query('SELECT COUNT(*) as total_contacts FROM contacts')
    ]);

    const jobTitles = jobTitlesRes.rows.map(r => r.job_title);
    const companies = companiesRes.rows.map(r => r.company);
    const totalContacts = parseInt(countRes.rows[0].total_contacts);

    res.json({ jobTitles, companies, totalContacts });
  } catch (err) {
    console.error('Facets error:', err);
    res.status(500).json({ error: 'InternalError', message: 'Failed to fetch facets' });
  }
});


/**
 * GET /api/contacts/search
 * Query: jobTitle, company
 * Returns up to 3 contacts with name and linkedin url
 * Search logic: 1) Exact matches first, 2) Substring matches if needed
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

    let results = [];

    // Step 1: Look for exact matches (case-insensitive)
    const exactMatchSql = `
      SELECT id,
             first_name,
             last_name,
             job_title,
             company,
             linkedin_url
      FROM contacts
      WHERE LOWER(job_title) = LOWER($1)
        AND LOWER(company) = LOWER($2)
      ORDER BY (linkedin_url IS NOT NULL AND length(trim(linkedin_url)) > 0) DESC,
               is_verified DESC,
               updated_at DESC
      LIMIT 3
    `;

    const exactRows = await query(exactMatchSql, [jobTitle, company]);
    results = exactRows.rows.map(r => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      jobTitle: r.job_title,
      company: r.company,
      linkedinUrl: r.linkedin_url || null
    }));

    // Step 2: If we don't have 3 results, look for substring matches
    if (results.length < 3) {
      const remainingNeeded = 3 - results.length;
      
      // Get IDs of exact matches to exclude them from substring search
      const excludeIds = results.map(r => r.id);
      const excludeClause = excludeIds.length > 0 ? 'AND id NOT IN (' + excludeIds.map((_, i) => `$${i + 3}`).join(',') + ')' : '';
      
      const substringMatchSql = `
        SELECT id,
               first_name,
               last_name,
               job_title,
               company,
               linkedin_url
        FROM contacts
        WHERE (
          LOWER(job_title) LIKE LOWER($1) OR LOWER($1) LIKE LOWER(job_title)
        ) AND (
          LOWER(company) LIKE LOWER($2) OR LOWER($2) LIKE LOWER(company)
        )
        ${excludeClause}
        ORDER BY (linkedin_url IS NOT NULL AND length(trim(linkedin_url)) > 0) DESC,
                 is_verified DESC,
                 updated_at DESC
        LIMIT ${remainingNeeded}
      `;

      const params = [`%${jobTitle}%`, `%${company}%`, ...excludeIds];
      const substringRows = await query(substringMatchSql, params);
      
      const substringResults = substringRows.rows.map(r => ({
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        jobTitle: r.job_title,
        company: r.company,
        linkedinUrl: r.linkedin_url || null
      }));

      results = results.concat(substringResults);
    }

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
      SELECT id, first_name, last_name, job_title, company, linkedin_url, is_verified
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
        SELECT id, first_name, last_name, job_title, company, linkedin_url, is_verified
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

module.exports = router;
