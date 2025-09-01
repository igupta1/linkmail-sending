#!/usr/bin/env node

// Import Apollo contacts from CSV files
// Usage: node import_apollo_contacts.js

const fs = require('fs').promises;
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { query } = require('../db');

// CSV file paths relative to linkmail-all directory
const CSV_FILES = [
  '../../../apollo-contacts-export(14).csv',
  '../../../apollo-contacts-export(15).csv', 
  '../../../apollo-contacts-export(16).csv'
];

// Parse CSV line into object
function parseCSVLine(line, headers) {
  const values = [];
  let currentValue = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(currentValue.trim());
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  
  // Add the last value
  values.push(currentValue.trim());
  
  // Create object from headers and values
  const result = {};
  headers.forEach((header, index) => {
    result[header] = values[index] || '';
  });
  
  return result;
}

// Parse CSV content
function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    try {
      const row = parseCSVLine(lines[i], headers);
      rows.push(row);
    } catch (error) {
      console.error(`Error parsing line ${i + 1}: ${lines[i]}`);
      console.error(error);
    }
  }
  
  return rows;
}

// Normalize LinkedIn URL to match existing contacts
function normalizeLinkedInUrl(url) {
  if (!url) return null;
  
  // Remove trailing slash and convert to lowercase for comparison
  return url.toLowerCase().replace(/\/$/, '');
}

// Insert or update contact
async function insertContact(contactData) {
  const {
    'First Name': firstName,
    'Last Name': lastName,
    'Title': jobTitle,
    'Company': company,
    'Person Linkedin Url': linkedinUrl,
    'City': city,
    'State': state,
    'Country': country,
    'Email': email
  } = contactData;

  const normalizedLinkedInUrl = normalizeLinkedInUrl(linkedinUrl);

  try {
    // Check if contact exists by LinkedIn URL
    let contactId = null;
    if (normalizedLinkedInUrl) {
      const existingContact = await query(
        'SELECT id FROM contacts WHERE lower(linkedin_url) = $1',
        [normalizedLinkedInUrl]
      );
      
      if (existingContact.rows.length > 0) {
        contactId = existingContact.rows[0].id;
        console.log(`Contact already exists with LinkedIn URL: ${linkedinUrl}`);
      }
    }

    // If not found by LinkedIn, check by name and company
    if (!contactId) {
      const existingByName = await query(
        'SELECT id FROM contacts WHERE first_name = $1 AND last_name = $2 AND company = $3',
        [firstName, lastName, company]
      );
      
      if (existingByName.rows.length > 0) {
        contactId = existingByName.rows[0].id;
        console.log(`Contact already exists with name: ${firstName} ${lastName} at ${company}`);
      }
    }

    // Insert new contact if doesn't exist
    if (!contactId) {
      const insertResult = await query(`
        INSERT INTO contacts (first_name, last_name, job_title, company, city, state, country, linkedin_url, is_verified)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [firstName, lastName, jobTitle, company, city, state, country, linkedinUrl, true]);
      
      contactId = insertResult.rows[0].id;
      console.log(`✅ Inserted new contact: ${firstName} ${lastName} (ID: ${contactId})`);
    } else {
      // Update existing contact to mark as verified and update any missing fields
      await query(`
        UPDATE contacts 
        SET is_verified = true,
            job_title = COALESCE(NULLIF($3, ''), job_title),
            company = COALESCE(NULLIF($4, ''), company),
            city = COALESCE(NULLIF($5, ''), city),
            state = COALESCE(NULLIF($6, ''), state),
            country = COALESCE(NULLIF($7, ''), country),
            linkedin_url = COALESCE(NULLIF($8, ''), linkedin_url),
            updated_at = NOW()
        WHERE id = $1
      `, [contactId, firstName, lastName, jobTitle, company, city, state, country, linkedinUrl]);
      
      console.log(`📝 Updated existing contact: ${firstName} ${lastName} (ID: ${contactId})`);
    }

    // Handle email
    if (email && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      
      // Check if email already exists for this contact
      const existingEmail = await query(
        'SELECT id FROM contact_emails WHERE contact_id = $1 AND email = $2',
        [contactId, cleanEmail]
      );

      if (existingEmail.rows.length === 0) {
        // Check if this is the first email for this contact (make it primary)
        const emailCount = await query(
          'SELECT COUNT(*) as count FROM contact_emails WHERE contact_id = $1',
          [contactId]
        );
        
        const isPrimary = emailCount.rows[0].count === '0';

        await query(`
          INSERT INTO contact_emails (contact_id, email, is_primary, is_verified)
          VALUES ($1, $2, $3, $4)
        `, [contactId, cleanEmail, isPrimary, true]);
        
        console.log(`  📧 Added email: ${cleanEmail} ${isPrimary ? '(primary)' : ''}`);
      } else {
        // Update existing email to mark as verified
        await query(
          'UPDATE contact_emails SET is_verified = true WHERE contact_id = $1 AND email = $2',
          [contactId, cleanEmail]
        );
        console.log(`  ✅ Email already exists and marked verified: ${cleanEmail}`);
      }
    }

    return contactId;
  } catch (error) {
    console.error(`❌ Error processing contact ${firstName} ${lastName}:`, error.message);
    throw error;
  }
}

// Main import function
async function importContacts() {
  console.log('🚀 Starting Apollo contacts import...\n');
  
  let totalContacts = 0;
  let totalEmails = 0;
  
  for (const csvFile of CSV_FILES) {
    const filePath = path.join(__dirname, csvFile);
    
    try {
      console.log(`📂 Processing file: ${csvFile}`);
      const content = await fs.readFile(filePath, 'utf8');
      const contacts = parseCSV(content);
      
      console.log(`   Found ${contacts.length} contacts to import`);
      
      for (const contact of contacts) {
        try {
          await insertContact(contact);
          totalContacts++;
          if (contact.Email && contact.Email.trim()) {
            totalEmails++;
          }
        } catch (error) {
          console.error(`Failed to import contact: ${contact['First Name']} ${contact['Last Name']}`);
        }
      }
      
      console.log(`✅ Completed ${csvFile}\n`);
      
    } catch (error) {
      console.error(`❌ Error reading file ${csvFile}:`, error.message);
    }
  }
  
  console.log(`🎉 Import completed!`);
  console.log(`   Total contacts processed: ${totalContacts}`);
  console.log(`   Total emails processed: ${totalEmails}`);
  
  // Show summary from database
  try {
    const contactsCount = await query('SELECT COUNT(*) as count FROM contacts WHERE is_verified = true');
    const emailsCount = await query('SELECT COUNT(*) as count FROM contact_emails WHERE is_verified = true');
    
    console.log(`\n📊 Database summary:`);
    console.log(`   Verified contacts in DB: ${contactsCount.rows[0].count}`);
    console.log(`   Verified emails in DB: ${emailsCount.rows[0].count}`);
  } catch (error) {
    console.error('Error getting database summary:', error.message);
  }
}

// Run the import
if (require.main === module) {
  importContacts()
    .then(() => {
      console.log('\n✨ Import script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Import script failed:', error);
      process.exit(1);
    });
}

module.exports = { importContacts };
