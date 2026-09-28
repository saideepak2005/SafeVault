const env = require('../config/env');

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Turns one string of text into a vector (array of numbers) via Gemini's
// embedding model. Called once per chunk at upload time, and once per
// question at chat time - never at dashboard-load time, which is why this
// stays comfortably inside the free tier even under demo conditions.
async function embedText(text) {
  const url = `${BASE}/${env.gemini.embeddingModel}:embedContent?key=${env.gemini.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      outputDimensionality: env.gemini.embeddingDims,
    }),
  });

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

module.exports = { embedText };
