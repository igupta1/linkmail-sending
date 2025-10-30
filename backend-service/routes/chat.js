const express = require('express');
const { query } = require('../db');

const router = express.Router();

// POST /api/chat/generate
// Body: { prompt: string, context?: object | array }
router.post('/generate', async (req, res) => {
  try {
    const { prompt, context } = req.body || {};
    const userId = req.user.id;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Field "prompt" is required and must be a non-empty string.'
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Fail fast if no API key is configured
      return res.status(500).json({
        error: 'LLM not configured',
        message: 'OPENAI_API_KEY is not set on the server.'
      });
    }

    // Fetch user profile data for better personalization
    const userProfile = await fetchUserProfile(userId);

    // Prepare a focused system prompt for drafting outreach messages
    const systemPrompt = [
      'You are LinkMail, an expert assistant that drafts concise, high-converting outreach emails and DMs.',
      'Given a user purpose and optional context, write a clear, friendly draft that:',
      '- Matches a professional, human tone',
      '- Is concise (5-8 sentences max)',
      '- Personalizes with provided context when helpful',
      '- Uses the sender\'s background and experience to add credibility',
      '- Avoids exaggerated claims and buzzwords',
      '- Ends with a single, specific call-to-action',
      '',
      'Format your response as JSON with exactly two fields:',
      '{ "subject": "Your subject line here", "body": "Your email body here" }',
      '',
      'The subject line should be:',
      '- Attention-grabbing and personalized',
      '- Short (5-8 words)',
      '- Professional and relevant to the purpose',
      '',
      'If a Sender name is provided in the context, use that exact name in any self-introduction and in the sign-off. Do not invent or alter it.',
      'Never output placeholders like "[Not specified]" or "[Not Specified]". If a piece of information is missing, omit it rather than writing a placeholder.',
      '',
      'Return ONLY valid JSON without any additional text, markdown formatting, or code blocks.'
    ].join('\n');

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    // Build messages array for Chat Completions
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildUserContent(prompt, context, userProfile) }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: clampNumber(process.env.OPENAI_TEMPERATURE, 0.2, 0.9, 0.4),
        max_tokens: clampInt(process.env.OPENAI_MAX_TOKENS, 128, 1024, 512)
      })
    });

    if (!response.ok) {
      const errText = await safeText(response);
      return res.status(502).json({
        error: 'LLM upstream error',
        message: 'Failed to generate draft from LLM provider.',
        details: truncate(errText, 800)
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return res.status(502).json({
        error: 'Empty response',
        message: 'The LLM returned no content.'
      });
    }

    // Parse JSON response to extract subject and body
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (parseError) {
      // If JSON parsing fails, treat the content as body with a default subject
      console.error('Failed to parse LLM response as JSON:', parseError);
      parsedContent = {
        subject: 'Quick Question',
        body: content
      };
    }

    // Validate that we have both subject and body
    let subject = parsedContent?.subject?.trim() || 'Quick Question';
    let body = parsedContent?.body?.trim() || content;

    // If user profile has a name, ensure placeholders are replaced with their real name
    const senderName = `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim();
    if (senderName) {
      body = body.replace(/\[Not specified\]|\[Not Specified\]/gi, senderName);
    }

    return res.json({
      subject,
      body,
      draft: body, // Keep for backward compatibility
      model,
      usage: data?.usage || null
    });
  } catch (error) {
    console.error('Error generating draft:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Unexpected error while generating draft.'
    });
  }
});

async function fetchUserProfile(userId) {
  try {
    const sql = `
      SELECT user_id,
             first_name,
             last_name,
             linkedin_url,
             experiences,
             skills,
             school,
             preferences
      FROM user_profiles
      WHERE user_id = $1
    `;
    const { rows } = await query(sql, [userId]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

function buildUserContent(prompt, context, userProfile) {
  const parts = [
    `Purpose/Message: ${String(prompt).trim()}`
  ];

  // Add user profile context for better personalization
  if (userProfile) {
    const profileContext = [];
    
    if (userProfile.first_name || userProfile.last_name) {
      const name = `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim();
      if (name) profileContext.push(`Sender: ${name}`);
    }
    
    if (userProfile.school) {
      profileContext.push(`Education: ${userProfile.school}`);
    }
    
    if (userProfile.experiences && Array.isArray(userProfile.experiences) && userProfile.experiences.length > 0) {
      const recentExperience = userProfile.experiences[0];
      if (recentExperience.company && recentExperience.job_title) {
        profileContext.push(`Current Role: ${recentExperience.job_title} at ${recentExperience.company}`);
      }
    }
    
    if (userProfile.skills && Array.isArray(userProfile.skills) && userProfile.skills.length > 0) {
      const topSkills = userProfile.skills.slice(0, 5).join(', ');
      profileContext.push(`Key Skills: ${topSkills}`);
    }
    
    if (profileContext.length > 0) {
      parts.push('Sender Background:', ...profileContext);
    }
  }

  if (typeof context !== 'undefined' && context !== null) {
    try {
      const serialized = JSON.stringify(context, null, 2);
      parts.push('Additional Context:', serialized);
    } catch (_) {
      parts.push('Additional context provided but could not be serialized.');
    }
  }

  return parts.join('\n');
}

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (Number.isFinite(num)) {
    return Math.min(max, Math.max(min, num));
  }
  return fallback;
}

function clampInt(value, min, max, fallback) {
  const num = parseInt(String(value), 10);
  if (Number.isFinite(num)) {
    return Math.min(max, Math.max(min, num));
  }
  return fallback;
}

async function safeText(resp) {
  try {
    return await resp.text();
  } catch (_) {
    return '';
  }
}

function truncate(str, max) {
  if (typeof str !== 'string') return '';
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

module.exports = router;


