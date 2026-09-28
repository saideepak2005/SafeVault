const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { searchChunks } = require('../services/retrievalService');
const { generateText } = require('../services/llmService');

const router = express.Router();

const ANSWER_PROMPT = (question, context) => `Answer the user's question using ONLY the context
below. If the answer is not contained in the context, say clearly that you
could not find it in their files - do not guess or make anything up.

Context (from the user's own documents):
"""
${context}
"""

Question: ${question}

Answer:`;

// POST /api/chat  { question: string, category?: string }
router.post('/', requireAuth, async (req, res) => {
  const { question, category } = req.body || {};
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: '"question" is required' });
  }

  try {
    const matches = await searchChunks(req.supabase, {
      userId: req.user.id,
      question,
      category: category || null,
    });

    if (matches.length === 0) {
      return res.json({
        answer: "I couldn't find anything relevant in your files for that question.",
        sources: [],
        provider: null,
      });
    }

    const context = matches.map((m, i) => `[${i + 1}] ${m.content}`).join('\n\n');
    const { text: answer, provider } = await generateText(ANSWER_PROMPT(question, context));

    // Fetch the file names for the matched chunks so the user can see exactly
    // which document(s) the answer came from.
    const fileIds = [...new Set(matches.map((m) => m.file_id))];
    const { data: files } = await req.supabase.from('files').select('id, file_name').in('id', fileIds);
    const fileNameById = Object.fromEntries((files || []).map((f) => [f.id, f.file_name]));

    res.json({
      answer,
      provider,
      sources: matches.map((m) => ({
        fileId: m.file_id,
        fileName: fileNameById[m.file_id] || 'Unknown file',
        similarity: m.similarity,
      })),
    });
  } catch (err) {
    console.error('Chat pipeline failed:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
