require('dotenv').config();
const fs = require('fs');
const { parse } = require('csv-parse');
const { Pool } = require('pg');

// CSV columns expected (case-insensitive; flexible on names):
// - First Name, Last Name, Title/Job Title, Company, Email, Email Status,
// - Person Linkedin URL / LinkedIn URL / Linkedin / LinkedIn / Profile URL, City, State, Country

function getField(row, candidates) {
  for (const key of candidates) {
    if (key in row && typeof row[key] === 'string' && row[key].trim().length > 0) {
      return row[key].trim();
    }
  }
  // Case-insensitive fallback
  const map = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  for (const key of candidates) {
    const v = map.get(key.toLowerCase());
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
}

function canonicalizeLinkedInUrl(raw) {
  if (!raw) return null;
  let url = raw.trim();
  if (!url) return null;
  // Add scheme if missing
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  try {
    const u = new URL(url);
    // Ensure it's a LinkedIn domain
    if (!/linkedin\.com$/i.test(u.hostname) && !/\.linkedin\.com$/i.test(u.hostname)) {
      return null; // ignore non-LinkedIn URLs
    }
    u.hash = '';
    u.search = '';
    // Normalize hostname
    u.hostname = u.hostname.toLowerCase();
    // Remove trailing slash for consistency
    const normalized = u.toString().replace(/\/$/, '');
    return normalized;
  } catch {
    return null;
  }
}

async function upsertContactAndEmail(client, row) {
  const firstName = getField(row, ['First Name']);
  const lastName = getField(row, ['Last Name']);
  const jobTitle = getField(row, ['Title', 'Job Title']);
  const company = getField(row, ['Company', 'Company Name']);
  const email = getField(row, ['Email', 'Work Email', 'Personal Email']);
  const emailStatus = (getField(row, ['Email Status', 'Status']) || '').toLowerCase();
  const rawLinkedIn = getField(row, [
    'Person Linkedin URL',
    'Person Linkedin Url',
    'LinkedIn URL',
    'Linkedin URL',
    'LinkedIn',
    'Linkedin',
    'Profile URL',
    'LinkedIn Profile URL'
  ]);
  const linkedinUrl = canonicalizeLinkedInUrl(rawLinkedIn);
  const city = getField(row, ['City']);
  const state = getField(row, ['State']);
  const country = getField(row, ['Country']);

  if (!firstName || !lastName) {
    throw new Error('Missing First Name or Last Name');
  }

  // Consider verified if Email Status indicates valid/verified (simple heuristic)
  const verified = emailStatus.includes('valid') || emailStatus.includes('verify') || emailStatus === 'ok';

  // Try to find by LinkedIn URL first if provided; else find by name + company
  let contactId = null;
  if (linkedinUrl) {
    const res = await client.query(
      'SELECT id FROM contacts WHERE lower(linkedin_url) = lower($1) LIMIT 1',
      [linkedinUrl]
    );
    if (res.rows[0]) contactId = res.rows[0].id;
  }

  if (!contactId) {
    const res = await client.query(
      `SELECT id FROM contacts 
       WHERE lower(first_name) = lower($1) AND lower(last_name) = lower($2) AND (company IS NOT DISTINCT FROM $3)
       LIMIT 1`,
      [firstName, lastName, company]
    );
    if (res.rows[0]) contactId = res.rows[0].id;
  }

  if (!contactId) {
    const ins = await client.query(
      `INSERT INTO contacts (first_name, last_name, job_title, company, city, state, country, is_verified, linkedin_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [firstName, lastName, jobTitle, company, city, state, country, verified, linkedinUrl]
    );
    contactId = ins.rows[0].id;
  } else {
    // Update details if newly provided
    await client.query(
      `UPDATE contacts SET 
         job_title = COALESCE($2, job_title),
         company = COALESCE($3, company),
         city = COALESCE($4, city),
         state = COALESCE($5, state),
         country = COALESCE($6, country),
         linkedin_url = CASE WHEN $7::text IS NOT NULL AND length(trim($7::text)) > 0 THEN $7::text ELSE linkedin_url END,
         is_verified = CASE WHEN $8 THEN TRUE ELSE is_verified END
       WHERE id = $1`,
      [contactId, jobTitle, company, city, state, country, linkedinUrl, verified]
    );
  }

  if (email) {
    await client.query(
      `INSERT INTO contact_emails (contact_id, email, is_primary, is_verified)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (contact_id, email) DO UPDATE SET is_verified = EXCLUDED.is_verified`,
      [contactId, email, true, verified]
    );
  }

  return contactId;
}

async function importCsv(filePath) {
  const url = process.env.DATABASE_URL;
  const ssl = /neon\.tech/.test(url) ? { rejectUnauthorized: false } : undefined;
  const pool = new Pool({ connectionString: url, ssl });
  const client = await pool.connect();
  let processed = 0;
  let created = 0;
  try {
    await client.query('BEGIN');

    const parser = fs.createReadStream(filePath).pipe(parse({ columns: true, trim: true }));
    for await (const row of parser) {
      const before = await client.query('SELECT COUNT(*)::int AS c FROM contacts');
      const id = await upsertContactAndEmail(client, row);
      const after = await client.query('SELECT COUNT(*)::int AS c FROM contacts');
      if (after.rows[0].c > before.rows[0].c) created += 1;
      processed += 1;
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({ processed, created }, null, 2));
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Import failed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/import_csv_contacts.js <path-to-csv>');
    process.exit(1);
  }
  importCsv(file);
}
