require('dotenv').config();

const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'GEMINI_API_KEY',
  'GEMINI_CHAT_MODEL',
  'GEMINI_EMBEDDING_MODEL',
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  // Fail fast at startup, not on the first request - saves you a confusing 500
  // during a live demo when it turns out .env was never filled in.
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill these in before starting the server.');
  process.exit(1);
}

module.exports = {
  port: process.env.PORT || 4000,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    chatModel: process.env.GEMINI_CHAT_MODEL,
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL,
    embeddingDims: Number(process.env.GEMINI_EMBEDDING_DIMS || 768),
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY || null,
    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
  },
  maxSupabaseFileBytes: Number(process.env.MAX_SUPABASE_FILE_BYTES || 50 * 1024 * 1024),
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || null,
    accessKeyId: process.env.R2_ACCESS_KEY_ID || null,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || null,
    bucket: process.env.R2_BUCKET || null,
  },
};
