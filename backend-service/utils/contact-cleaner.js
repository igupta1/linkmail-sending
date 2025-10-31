// utils/contact-cleaner.js
// LLM-based contact data cleaning utility

/**
 * Clean job title and company using LLM
 * @param {string} rawJobTitle - Raw job title from scraping (e.g., "Recruiting at Notion - We're Hiring! Notion.so/careers")
 * @param {string} rawCompany - Raw company from scraping (e.g., "Notion · Contract")
 * @returns {Promise<{jobTitle: string|null, company: string|null}>} Cleaned job title and company
 */
async function cleanContactData(rawJobTitle, rawCompany) {
  // Skip cleaning if both fields are empty
  if (!rawJobTitle && !rawCompany) {
    return { jobTitle: null, company: null, category: null };
  }

  try {
    // Use OpenAI API for cleaning
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      console.warn('OPENAI_API_KEY not set, skipping contact data cleaning');
      return {
        jobTitle: rawJobTitle || null,
        company: rawCompany || null,
        category: null
      };
    }

    const prompt = `You are a data cleaning assistant. Extract clean, professional job titles, company names, and infer the job category from scraped LinkedIn data.

Input:
- Job Title: ${rawJobTitle || 'N/A'}
- Company: ${rawCompany || 'N/A'}

Rules:
1. For Job Title: Extract the core role (e.g., "Recruiter", "Software Engineer", "Product Manager")
   - Remove promotional text (e.g., "We're Hiring!", URLs, extra details)
   - Remove company names from the job title
   - Remove "at [company]" suffixes
   - Keep it concise and professional
   - If unclear or no job title, return null

2. For Company: Extract just the company name
   - Remove employment type (e.g., "· Full-time", "· Contract", "· Part-time")
   - Remove extra symbols and separators (e.g., "·", "|", "-")
   - Remove URLs and promotional text
   - If unclear or no company, return null

3. For Category: Infer the job category based on the job title
   - Choose from: "Recruiter", "Software Engineer", "Product Manager", "Designer", "CEO", "Founder", "Data Scientist", "Co-Founder", "Analyst", "Consultant", "University Recruiter", "Talent Acquisition", "Other"
   - Use "University Recruiter" for campus/university recruiting roles
   - Use "Co-Founder" for co-founder roles (not "Founder")
   - Use "Talent Acquisition" for talent acquisition specialists
   - Use "Other" if the job doesn't clearly fit any category
   - If unclear or no job title, return null

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{"jobTitle": "cleaned job title or null", "company": "cleaned company or null", "category": "category or null"}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Fast and cost-effective
        messages: [
          {
            role: 'system',
            content: 'You are a data cleaning assistant that outputs only valid JSON. Never use markdown formatting or code blocks.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for consistency
        max_tokens: 100
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      // Return original values on error
      return {
        jobTitle: rawJobTitle || null,
        company: rawCompany || null,
        category: null
      };
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();
    
    if (!content) {
      console.error('Empty response from OpenAI');
      return {
        jobTitle: rawJobTitle || null,
        company: rawCompany || null,
        category: null
      };
    }

    // Parse the JSON response
    let cleaned;
    try {
      // Remove markdown code blocks if present
      const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      cleaned = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content, parseError);
      return {
        jobTitle: rawJobTitle || null,
        company: rawCompany || null,
        category: null
      };
    }

    // Handle string "null" values
    let cleanedJobTitle = (cleaned.jobTitle === 'null' || cleaned.jobTitle === null) ? null : (cleaned.jobTitle || null);
    const cleanedCompany = (cleaned.company === 'null' || cleaned.company === null) ? null : (cleaned.company || null);
    const cleanedCategory = (cleaned.category === 'null' || cleaned.category === null) ? null : (cleaned.category || null);

    // If the LLM was unsure and returned an ambiguous role like "Other", prefer showing only the workplace
    if (cleanedJobTitle && typeof cleanedJobTitle === 'string') {
      const lower = cleanedJobTitle.trim().toLowerCase();
      if (lower === 'other' || lower === 'unknown' || lower === 'n/a' || lower === 'na') {
        cleanedJobTitle = null;
      }
    }

    // Log the cleaning for debugging
    console.log('Contact data cleaned:', {
      before: { jobTitle: rawJobTitle, company: rawCompany },
      after: { jobTitle: cleanedJobTitle, company: cleanedCompany, category: cleanedCategory }
    });

    return {
      jobTitle: cleanedJobTitle,
      company: cleanedCompany,
      category: cleanedCategory
    };

  } catch (error) {
    console.error('Error cleaning contact data with LLM:', error);
    // Return original values on error (no category inference)
    return {
      jobTitle: rawJobTitle || null,
      company: rawCompany || null,
      category: null
    };
  }
}

/**
 * Clean contact info object
 * @param {Object} contactInfo - Contact info object with firstName, lastName, jobTitle, company, etc.
 * @returns {Promise<Object>} Contact info with cleaned jobTitle, company, and category
 */
async function cleanContactInfo(contactInfo) {
  if (!contactInfo || typeof contactInfo !== 'object') {
    return contactInfo;
  }

  const { jobTitle, company, ...rest } = contactInfo;
  
  // Only clean if at least one field needs cleaning
  if (!jobTitle && !company) {
    return contactInfo;
  }

  const cleaned = await cleanContactData(jobTitle, company);
  
  return {
    ...rest,
    jobTitle: cleaned.jobTitle,
    company: cleaned.company,
    category: cleaned.category
  };
}

module.exports = {
  cleanContactData,
  cleanContactInfo
};

