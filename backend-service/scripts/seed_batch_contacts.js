require('dotenv').config();
const { Pool } = require('pg');

const contacts = [
  {
    firstName: 'Nitin',
    lastName: 'Subramanian',
    jobTitle: 'Software Engineer',
    company: 'Applied Intuition',
    location: 'Mountain View',
    emails: ['nitins@ucla.edu']
  },
  {
    firstName: 'Saanya',
    lastName: 'Ojha',
    jobTitle: 'Partner',
    company: 'Bain Capital Ventures',
    location: 'San Francisco',
    emails: ['saojha@baincapital.com']
  }
];

async function insertContact(client, c) {
  const insertContactSql = `
    INSERT INTO contacts (first_name, last_name, job_title, company, location)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `;
  const { rows } = await client.query(insertContactSql, [
    c.firstName, c.lastName, c.jobTitle, c.company, c.location
  ]);
  const id = rows[0].id;

  if (Array.isArray(c.emails)) {
    for (let i = 0; i < c.emails.length; i++) {
      const email = c.emails[i];
      const isPrimary = i === 0;
      await client.query(
        'INSERT INTO contact_emails (contact_id, email, is_primary) VALUES ($1, $2, $3) ON CONFLICT (contact_id, email) DO NOTHING',
        [id, email, isPrimary]
      );
    }
  }

  return id;
}

async function main() {
  const url = process.env.DATABASE_URL;
  const ssl = /neon\.tech/.test(url) ? { rejectUnauthorized: false } : undefined;
  const pool = new Pool({ connectionString: url, ssl });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const insertedIds = [];
    for (const c of contacts) {
      const id = await insertContact(client, c);
      insertedIds.push(id);
    }
    await client.query('COMMIT');

    const rows = (await pool.query(
      `SELECT * FROM contacts_with_emails WHERE id = ANY($1::bigint[]) ORDER BY id`,
      [insertedIds]
    )).rows;
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Batch seed error:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
