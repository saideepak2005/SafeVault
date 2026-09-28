const { embedText } = require('./embeddingService');

const CHUNK_SIZE = 1000; // characters, not tokens - simple and good enough for an MVP
const CHUNK_OVERLAP = 150;

// Splits long text into overlapping chunks so no single chunk is too big to
// embed meaningfully, and no answer-relevant sentence gets cut in half at a
// chunk boundary (that's what the overlap buys you).
function chunkText(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length === 0) return [];

  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_SIZE, clean.length);
    chunks.push(clean.slice(start, end));
    if (end === clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

// Chunks the extracted text, embeds each chunk, and stores them linked to the file.
async function storeChunks(supabase, { fileId, userId, category, text }) {
  const pieces = chunkText(text);
  const rows = [];
  for (const content of pieces) {
    const embedding = await embedText(content);
    rows.push({ file_id: fileId, user_id: userId, category, content, embedding });
  }
  if (rows.length === 0) return;

  const { error } = await supabase.from('chunks').insert(rows);
  if (error) throw new Error(`Failed to store chunks: ${error.message}`);
}

// Step 1: embed the question. Step 2: filter by user + optional category
// FIRST, then rank by vector similarity within that filtered set. This
// order (filter, then search) is the main accuracy lever in the whole system.
async function searchChunks(supabase, { userId, question, category, matchCount = 5 }) {
  const queryEmbedding = await embedText(question);
  const { data, error } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_user_id: userId,
    match_category: category || null,
    match_count: matchCount,
  });
  if (error) throw new Error(`Vector search failed: ${error.message}`);
  return data || [];
}

module.exports = { chunkText, storeChunks, searchChunks };
