# Contact Data Cleaner

This utility uses LLM (OpenAI GPT-4o-mini) to clean and normalize job titles and company names scraped from LinkedIn profiles.

## Problem

LinkedIn scraping often produces messy data:
- Job Title: `"Recruiting at Notion - We're Hiring! Notion.so/careers"`
- Company: `"Notion · Contract"`

## Solution

The LLM automatically cleans this to:
- Job Title: `"Recruiter"`
- Company: `"Notion"`

## Usage

### Configuration

Set the OpenAI API key in your environment:
```bash
OPENAI_API_KEY=sk-your-key-here
```

If the API key is not set, the cleaner will log a warning and return the original (uncleaned) values.

### In Code

```javascript
const { cleanContactData, cleanContactInfo } = require('./utils/contact-cleaner');

// Clean individual fields
const cleaned = await cleanContactData(
  "Recruiting at Notion - We're Hiring! Notion.so/careers",
  "Notion · Contract"
);
// Returns: { jobTitle: "Recruiter", company: "Notion" }

// Clean a contact info object
const contactInfo = {
  firstName: "John",
  lastName: "Doe",
  jobTitle: "Engineering at Google · Full-time",
  company: "Google | Mountain View"
};
const cleanedInfo = await cleanContactInfo(contactInfo);
// Returns: { firstName: "John", lastName: "Doe", jobTitle: "Software Engineer", company: "Google" }
```

## Integration Points

The contact cleaner is automatically integrated into:

1. **Email Sending** (`routes/email.js`)
   - Cleans contact data when an email is sent

2. **Manual Contact Creation** (`routes/contacts.js`)
   - Cleans data when creating contacts via POST /api/contacts

3. **Apollo Email Search** (`routes/contacts.js`)
   - Cleans data from Apollo API before persisting

4. **CSV Import** (`scripts/import-apollo-csv.js`)
   - Cleans data during bulk imports from Apollo CSV exports

## Performance

- **Model**: gpt-4o-mini (fast and cost-effective)
- **Latency**: ~200-500ms per contact
- **Cost**: ~$0.0001 per contact
- **Fallback**: Returns original values if API fails

## Error Handling

The cleaner is designed to never break contact creation:
- If OpenAI API is unavailable, it returns original values
- If the API key is missing, it logs a warning and returns original values
- If JSON parsing fails, it returns original values
- All errors are logged for debugging

## Example Transformations

| Before | After |
|--------|-------|
| `"Recruiting at Notion - We're Hiring!"` | `"Recruiter"` |
| `"Software Engineering · Full-time"` | `"Software Engineer"` |
| `"Product Manager at Google"` | `"Product Manager"` |
| `"Notion · Contract"` | `"Notion"` |
| `"Google \| Mountain View"` | `"Google"` |
| `"OpenAI · Full-time"` | `"OpenAI"` |

