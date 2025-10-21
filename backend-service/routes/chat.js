const express = require('express');

const router = express.Router();

// POST /api/chat/generate
// Body: { prompt: string, context?: object | array }
router.post('/generate', async (req, res) => {
  try {
    const { prompt, context } = req.body || {};

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

    // Prepare a focused system prompt for drafting outreach messages
    const systemPrompt = [
      'You are LinkMail, an expert assistant that drafts concise, high-converting outreach emails and DMs.',
      'Given a user purpose and optional context, write a clear, friendly draft that:',
      '- Matches a professional, human tone',
      '- Is concise (5-8 sentences max)',
      '- Personalizes with provided context when helpful',
      '- Avoids exaggerated claims and buzzwords',
      '- Ends with a single, specific call-to-action',
      '',
      'Return only the draft message body; do not include surrounding quotes or extra commentary.'
    ].join('\n');

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    // Build messages array for Chat Completions
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildUserContent(prompt, context) }
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

    return res.json({
      draft: content,
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

function buildUserContent(prompt, context) {
  const parts = [
    `Purpose/Message: ${String(prompt).trim()}`
  ];

  if (typeof context !== 'undefined' && context !== null) {
    try {
      const serialized = JSON.stringify(context, null, 2);
      parts.push('Context:', serialized);
    } catch (_) {
      parts.push('Context provided but could not be serialized.');
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


