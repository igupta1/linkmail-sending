#!/usr/bin/env node

/**
 * Import Apollo contacts CSV export into LinkMail database
 * 
 * Usage: node scripts/import-apollo-csv.js <path-to-csv-file>
 * 
 * This script:
 * 1. Parses the Apollo contacts export CSV
 * 2. Maps CSV fields to database schema
 * 3. Handles LinkedIn URL normalization and deduplication
 * 4. Imports contacts and emails with verification flags
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Load environment variables
require('dotenv').config();

const { getClient, query } = require('../db');
const { cleanContactData } = require('../utils/contact-cleaner');

// Helper function to canonicalize LinkedIn profile URLs
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

// Clean and normalize text fields
function cleanText(value) {
  if (!value || typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned === '' ? null : cleaned;
}

// Parse CSV and import contacts
async function importApolloCSV(csvPath) {
  if (!fs.existsSync(csvPath)) {
    console.error(`Error: CSV file not found at ${csvPath}`);
    process.exit(1);
  }

  console.log(`Starting import from: ${csvPath}`);
  
  const contacts = [];
  const errors = [];
  let totalRows = 0;

  // Parse CSV file
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        totalRows++;
        
        try {
          // Map CSV fields to database schema
          const contact = {
            firstName: cleanText(row['First Name']),
            lastName: cleanText(row['Last Name']),
            jobTitle: cleanText(row['Title']),
            company: cleanText(row['Company']),
            email: cleanText(row['Email']),
            emailStatus: cleanText(row['Email Status']),
            city: cleanText(row['City']),
            state: cleanText(row['State']),
            country: cleanText(row['Country']),
            linkedinUrl: cleanText(row['Person Linkedin Url']),
            secondaryEmail: cleanText(row['Secondary Email']),
            secondaryEmailStatus: cleanText(row['Secondary Email Status']),
            tertiaryEmail: cleanText(row['Tertiary Email']),
            tertiaryEmailStatus: cleanText(row['Tertiary Email Status']),
            // Apollo-specific fields
            apolloContactId: cleanText(row['Apollo Contact Id']),
            apolloAccountId: cleanText(row['Apollo Account Id']),
            emailConfidence: cleanText(row['Email Confidence']),
            primaryEmailSource: cleanText(row['Primary Email Source']),
            lastVerifiedAt: cleanText(row['Primary Email Last Verified At'])
          };

          // Skip rows without basic required data
          if (!contact.firstName || !contact.lastName || !contact.email) {
            console.warn(`Row ${totalRows}: Skipping - missing required fields (firstName, lastName, or email)`);
            return;
          }

          // Normalize LinkedIn URL
          if (contact.linkedinUrl) {
            contact.linkedinUrl = canonicalizeLinkedInProfile(contact.linkedinUrl) || contact.linkedinUrl;
          }

          contacts.push(contact);
        } catch (error) {
          errors.push({ row: totalRows, error: error.message, data: row });
          console.error(`Row ${totalRows}: Parse error - ${error.message}`);
        }
      })
      .on('end', async () => {
        console.log(`\nParsed ${totalRows} rows, ${contacts.length} valid contacts, ${errors.length} errors`);
        
        if (contacts.length === 0) {
          console.log('No valid contacts to import');
          resolve({ imported: 0, updated: 0, skipped: 0, errors: errors.length });
          return;
        }

        try {
          const result = await importContacts(contacts);
          resolve({ ...result, totalParsed: contacts.length, parseErrors: errors.length });
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

// Import contacts into database
async function importContacts(contacts) {
  const client = await getClient();
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  try {
    console.log(`\nImporting ${contacts.length} contacts into database...`);
    
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      
      try {
        await client.query('BEGIN');
        
        // Check if contact already exists (by LinkedIn URL first, then by name + company)
        let existingContact = null;
        
        if (contact.linkedinUrl) {
          const linkedinVariants = [
            contact.linkedinUrl.toLowerCase(),
            contact.linkedinUrl.replace(/\/$/, '').toLowerCase()
          ];
          
          const { rows } = await client.query(
            `SELECT id, first_name, last_name, job_title, company, linkedin_url, is_verified
             FROM contacts 
             WHERE linkedin_url IS NOT NULL 
               AND lower(linkedin_url) = ANY($1)
             LIMIT 1`,
            [linkedinVariants]
          );
          existingContact = rows[0];
        }
        
        // Fallback: find by name + company
        if (!existingContact && contact.firstName && contact.lastName && contact.company) {
          const { rows } = await client.query(
            `SELECT id, first_name, last_name, job_title, company, linkedin_url, is_verified
             FROM contacts 
             WHERE lower(first_name) = lower($1) 
               AND lower(last_name) = lower($2)
               AND lower(company) = lower($3)
             LIMIT 1`,
            [contact.firstName, contact.lastName, contact.company]
          );
          existingContact = rows[0];
        }
        
        let contactId;
        
        if (existingContact) {
          // Update existing contact with new information
          const updateFields = [];
          const updateValues = [];
          let paramIndex = 1;
          
          // Only update fields that are empty or less complete
          if (contact.jobTitle && !existingContact.job_title) {
            updateFields.push(`job_title = $${paramIndex++}`);
            updateValues.push(contact.jobTitle);
          }
          
          if (contact.linkedinUrl && !existingContact.linkedin_url) {
            updateFields.push(`linkedin_url = $${paramIndex++}`);
            updateValues.push(contact.linkedinUrl);
          }
          
          // Mark as verified since it comes from Apollo
          updateFields.push(`is_verified = TRUE, updated_at = NOW()`);
          
          if (updateFields.length > 1) { // More than just the verification update
            updateValues.push(existingContact.id);
            await client.query(
              `UPDATE contacts SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
              updateValues
            );
            updated++;
          } else {
            // Just mark as verified
            await client.query(
              `UPDATE contacts SET is_verified = TRUE, updated_at = NOW() WHERE id = $1`,
              [existingContact.id]
            );
          }
          
          contactId = existingContact.id;
        } else {
          // Clean job title and company before inserting (also infers category)
          const cleaned = await cleanContactData(contact.jobTitle, contact.company);
          
          // Insert new contact
          const insertSQL = `
            INSERT INTO contacts (first_name, last_name, job_title, company, city, state, country, is_verified, linkedin_url, category)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
          `;
          
          const { rows } = await client.query(insertSQL, [
            contact.firstName,
            contact.lastName,
            cleaned.jobTitle || contact.jobTitle,  // Use cleaned or fallback to original
            cleaned.company || contact.company,    // Use cleaned or fallback to original
            contact.city,
            contact.state,
            contact.country,
            true, // Mark as verified since from Apollo
            contact.linkedinUrl,
            cleaned.category || null  // Use LLM-inferred category
          ]);
          
          contactId = rows[0].id;
          imported++;
        }
        
        // Handle emails
        const emails = [
          { email: contact.email, status: contact.emailStatus, isPrimary: true },
          { email: contact.secondaryEmail, status: contact.secondaryEmailStatus, isPrimary: false },
          { email: contact.tertiaryEmail, status: contact.tertiaryEmailStatus, isPrimary: false }
        ].filter(e => e.email);
        
        for (const emailData of emails) {
          // Check if email already exists for this contact
          const { rows: existingEmail } = await client.query(
            `SELECT id FROM contact_emails WHERE contact_id = $1 AND email = $2`,
            [contactId, emailData.email]
          );
          
          if (existingEmail.length === 0) {
            // Insert new email
            const isVerified = emailData.status === 'Verified';
            await client.query(
              `INSERT INTO contact_emails (contact_id, email, is_primary, is_verified)
               VALUES ($1, $2, $3, $4)`,
              [contactId, emailData.email, emailData.isPrimary, isVerified]
            );
          } else {
            // Update verification status if needed
            const isVerified = emailData.status === 'Verified';
            await client.query(
              `UPDATE contact_emails 
               SET is_verified = $1 
               WHERE contact_id = $2 AND email = $3 AND is_verified != $1`,
              [isVerified, contactId, emailData.email]
            );
          }
        }
        
        await client.query('COMMIT');
        
        // Progress indicator
        if ((i + 1) % 100 === 0) {
          console.log(`Processed ${i + 1}/${contacts.length} contacts...`);
        }
        
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error processing contact ${i + 1} (${contact.firstName} ${contact.lastName}):`, error.message);
        errors++;
      }
    }
    
  } finally {
    client.release();
  }
  
  return { imported, updated, skipped, errors };
}

// Main execution
async function main() {
  const csvPath = process.argv[2];
  
  if (!csvPath) {
    console.error('Usage: node scripts/import-apollo-csv.js <path-to-csv-file>');
    process.exit(1);
  }
  
  const resolvedPath = path.resolve(csvPath);
  
  try {
    const result = await importApolloCSV(resolvedPath);
    
    console.log('\n=== Import Complete ===');
    console.log(`Total parsed: ${result.totalParsed}`);
    console.log(`Parse errors: ${result.parseErrors}`);
    console.log(`New contacts imported: ${result.imported}`);
    console.log(`Existing contacts updated: ${result.updated}`);
    console.log(`Skipped: ${result.skipped}`);
    console.log(`Processing errors: ${result.errors}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { importApolloCSV, canonicalizeLinkedInProfile };
