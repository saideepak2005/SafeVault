const env = require('../config/env');

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function callGemini(prompt) {
  const url = `${GEMINI_BASE}/${env.gemini.chatModel}:generateContent?key=${env.gemini.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Gemini generateContent failed (${res.status}): ${body}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  return text;
}

async function callGroq(prompt) {
  if (!env.groq.apiKey) {
    throw new Error('Groq fallback requested but GROQ_API_KEY is not set');
  }
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.groq.apiKey}`,
    },
    body: JSON.stringify({
      model: env.groq.model,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq chat completion failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

// Tries Gemini first. On a 429 (rate limited) or 503 (overloaded), falls back
// to Groq automatically so a live demo never just dies mid-question.
async function generateText(prompt) {
  try {
    return { text: await callGemini(prompt), provider: 'gemini' };
  } catch (err) {
    const shouldFallback = err.status === 429 || err.status === 503 || !env.gemini.apiKey;
    if (shouldFallback && env.groq.apiKey) {
      console.warn('Gemini unavailable, falling back to Groq:', err.message);
      return { text: await callGroq(prompt), provider: 'groq' };
    }
    throw err;
  }
}

// For image/scanned files: sends the actual image bytes to Gemini's vision
// model instead of relying only on OCR'd text. base64Data should NOT include
// the "data:image/png;base64," prefix.
async function analyzeImage(base64Data, mimeType, prompt) {
  const url = `${GEMINI_BASE}/${env.gemini.chatModel}:generateContent?key=${env.gemini.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mimeType, data: base64Data } },
            { text: prompt },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini vision failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
}

module.exports = { generateText, analyzeImage };
