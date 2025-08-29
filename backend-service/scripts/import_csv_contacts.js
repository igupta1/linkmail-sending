require('dotenv').config();
const fs = require('fs');
const { parse } = require('csv-parse');
const { Pool } = require('pg');

// CSV columns expected: First Name, Last Name, Title, Company, Email, Email Status, Person Linkedin URL, City, State, Country

async function upsertContactAndEmail(client, row) {
  const firstName = row['First Name']?.trim();
  const lastName = row['Last Name']?.trim();
  const jobTitle = row['Title']?.trim() || null;
  const company = row['Company']?.trim() || null;
  const email = row['Email']?.trim();
  const emailStatus = row['Email Status']?.trim()?.toLowerCase() || '';
  const linkedinUrl = row['Person Linkedin URL']?.trim() || null;
  const city = row['City']?.trim() || null;
  const state = row['State']?.trim() || null;
  const country = row['Country']?.trim() || null;

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
         job_title = COALESCE($3, job_title),
         company = COALESCE($4, company),
         city = COALESCE($5, city),
         state = COALESCE($6, state),
         country = COALESCE($7, country),
         linkedin_url = COALESCE($8, linkedin_url),
         is_verified = CASE WHEN $9 THEN TRUE ELSE is_verified END
       WHERE id = $1`,
      [contactId, firstName, jobTitle, company, city, state, country, linkedinUrl, verified]
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
