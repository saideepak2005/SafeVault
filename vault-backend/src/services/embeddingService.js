const env = require('../config/env');

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function parseRetryDelayMs(bodyText) {
  try {
    const data = JSON.parse(bodyText);
    let val = data?.retryDelay || data?.error?.retryDelay;
    if (!val && Array.isArray(data?.error?.details)) {
      for (const d of data.error.details) {
        if (d?.retryDelay) {
          val = d.retryDelay;
          break;
        }
      }
    }
    if (val) {
      if (typeof val === 'string') {
        const match = val.match(/([\d.]+)s?/);
        if (match) {
          const sec = parseFloat(match[1]);
          if (!isNaN(sec) && sec > 0) return Math.ceil(sec * 1000);
        }
      } else if (typeof val === 'number' && val > 0) {
        return val < 1000 ? Math.ceil(val * 1000) : val;
      }
    }
  } catch {
    // Non-JSON response, fall back to default
  }
  return 20000; // default 20s
}

// Turns one string of text into a vector (array of numbers) via Gemini's
// embedding model. Called once per chunk at upload time, and once per
// question at chat time - never at dashboard-load time, which is why this
// stays comfortably inside the free tier even under demo conditions.
async function embedText(text) {
  const url = `${BASE}/${env.gemini.embeddingModel}:embedContent?key=${env.gemini.apiKey}`;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        outputDimensionality: env.gemini.embeddingDims,
      }),
    });

    if (res.status === 429 && attempt < maxAttempts) {
      const body = await res.text();
      const delayMs = parseRetryDelayMs(body);
      console.warn(
        `[embedText] Gemini rate limit (HTTP 429) on attempt ${attempt} of ${maxAttempts}. ` +
        `Waiting ${delayMs / 1000}s before retry...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini embedding failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    const values = data?.embedding?.values;
    if (!Array.isArray(values)) {
      throw new Error('Gemini embedding response missing embedding.values');
    }
    if (values.length !== env.gemini.embeddingDims) {
      // Loud warning, not a crash - lets you notice a model/dimension mismatch
      // immediately instead of silently corrupting your vector column.
      console.warn(
        `Warning: embedding has ${values.length} dims, expected ${env.gemini.embeddingDims}. ` +
        'Update GEMINI_EMBEDDING_DIMS and the vector(N) column in schema.sql to match.'
      );
    }
    return values;
  }
}

module.exports = { embedText };
