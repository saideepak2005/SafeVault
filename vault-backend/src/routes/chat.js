const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { searchChunks } = require('../services/retrievalService');
const { generateText } = require('../services/llmService');
const { parseChatAction } = require('../services/chatActionService');
const {
  ALLOWED_EVENT_TYPES,
  isValidDate,
} = require('../services/eventHelpers');
const { buildSavedDataSnapshot } = require('../services/savedDataService');

const router = express.Router();

function parseAnswerJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (inner) {}
    }
    return null;
  }
}

const ANSWER_PROMPT = ({
  question,
  history,
  today,
  savedDataText,
  fileChunksText,
}) => `You are the AI assistant for SafeVault, a personal document vault and dashboard.
Today's date: ${today}

${savedDataText}

--- RETRIEVED FILE CHUNKS (FROM UPLOADED DOCUMENTS) ---
${fileChunksText}
--- END RETRIEVED FILE CHUNKS ---

Recent Conversation History:
${(history || []).map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') || '(None)'}

User's Question: "${question}"

Instructions and Rules:
1. Questions about the user's notes, tasks, birthdays, alerts, reminders, schedule, or counts (e.g. "when is saideepak's birthday?", "whose birthday is next?", "list all birthdays", "what notes do I have?", "what tasks do I have?", "which tasks did I finish?", "what's coming up this month?", "how many birthdays/tasks/notes do I have?"):
   - Treat SAVED DATA as the absolute source of truth.
   - Answer with exact names, dates, days until / remaining, and exact counts.
   - Return mode: "dashboard".
   - Set used_chunk_indices to [].
2. Questions about the user's uploaded documents or files:
   - Answer using the Retrieved File Chunks.
   - Return mode: "files".
   - Include 1-based indices of used chunks in used_chunk_indices.
3. If an answer requires information about personal records, documents, dates, notes, or tasks, but it is NOT found in either SAVED DATA or Retrieved File Chunks:
   - Clearly state that you could not find it in their saved data or files.
   - NEVER guess, invent, or hallucinate personal facts (e.g. passport numbers, passwords, policy numbers, etc.).
   - Return mode: "dashboard" (or "files") with used_chunk_indices: [].
4. General-knowledge questions (e.g. "what is Kafka Schema Registry?", common knowledge, math, definitions):
   - Answer normally, accurately, and conversationally.
   - You MUST label it clearly as "Not from your files" (e.g. start with "[Not from your files] ").
   - Return mode: "general".
   - Set used_chunk_indices to [].
5. If both files and general knowledge or saved data help:
   - Combine them and explicitly say which part came from files / saved data and which part is general advice.
   - Return mode: "mixed".

Respond with ONLY a single JSON object (no markdown code blocks, no text before or after):
{
  "mode": "dashboard" | "files" | "general" | "mixed",
  "answer": "<your complete answer text>",
  "used_chunk_indices": [1, 2]
}
Note: used_chunk_indices are 1-based indices of Retrieved File Chunks actually used. Return [] if no file chunks were used (e.g. for questions answered from SAVED DATA, general knowledge, or when info was not found).`;

// POST /api/chat { question: string, category?: string, history?: Array<{ role: string, content: string }>, client_date?: string }
router.post('/', requireAuth, async (req, res) => {
  const { question, category, history, client_date } = req.body || {};
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: '"question" is required' });
  }

  const cleanQuestion = question.trim();
  // Validate client_date format, fallback to server date
  const today =
    client_date && isValidDate(client_date)
      ? client_date
      : new Date().toISOString().slice(0, 10);

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayDateObj = new Date(today + 'T00:00:00Z');
  const dayOfWeek = days[todayDateObj.getUTCDay()];

  const cleanHistory = Array.isArray(history)
    ? history.slice(-6).map((h) => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: String(h.content || ''),
      }))
    : [];

  try {
    // Step 1: Check for chat actions (add task, note, event)
    const { parsed: actionParsed, provider: actionProvider } = await parseChatAction({
      question: cleanQuestion,
      history: cleanHistory,
      today,
      dayOfWeek,
    });

    if (actionParsed?.action === 'add_task') {
      const task = actionParsed.task || {};
      if (task.title && typeof task.title === 'string' && task.title.trim().length > 0) {
        const title = task.title.trim();
        const dueDate = task.due_date && isValidDate(task.due_date) ? task.due_date : null;

        const { data: taskRow, error: taskErr } = await req.supabase
          .from('tasks')
          .insert({ user_id: req.user.id, title, due_date: dueDate })
          .select()
          .single();

        if (taskErr) throw new Error(taskErr.message);

        const confirmation = dueDate
          ? `Added task '${title}' due ${dueDate}.`
          : `Added task '${title}'.`;

        return res.json({
          answer: confirmation,
          provider: actionProvider,
          sources: [],
          mode: 'action',
          actions: [{ type: 'task', data: taskRow }],
        });
      }
    }

    if (actionParsed?.action === 'add_note') {
      const note = actionParsed.note || {};
      if (note.content && typeof note.content === 'string' && note.content.trim().length > 0) {
        const content = note.content.trim();
        const { data: noteRow, error: noteErr } = await req.supabase
          .from('notes')
          .insert({ user_id: req.user.id, content })
          .select()
          .single();

        if (noteErr) throw new Error(noteErr.message);

        const confirmation = `Added note: "${content}".`;
        return res.json({
          answer: confirmation,
          provider: actionProvider,
          sources: [],
          mode: 'action',
          actions: [{ type: 'note', data: noteRow }],
        });
      }
    }

    if (actionParsed?.action === 'add_event') {
      const event = actionParsed.event || {};
      if (
        event.description &&
        typeof event.description === 'string' &&
        event.description.trim().length > 0 &&
        isValidDate(event.event_date)
      ) {
        let rawType = event.event_type || 'other';
        if (rawType === 'deadline' || rawType === 'reminder') rawType = 'due_date';
        const eventType = ALLOWED_EVENT_TYPES.includes(rawType) ? rawType : 'other';
        const eventDate = event.event_date;
        const eventDesc = event.description.trim();
        const eventAmt =
          event.amount != null && !isNaN(Number(event.amount)) ? Number(event.amount) : null;

        const { data: eventRow, error: eventErr } = await req.supabase
          .from('extracted_events')
          .insert({
            user_id: req.user.id,
            file_id: null,
            event_type: eventType,
            event_date: eventDate,
            description: eventDesc,
            amount: eventAmt,
          })
          .select()
          .single();

        if (eventErr) throw new Error(eventErr.message);

        let confirmation = '';
        if (eventType === 'birthday') {
          confirmation = `Added birthday for ${eventDesc} on ${eventDate}.`;
        } else {
          confirmation = `Added ${eventType} event '${eventDesc}' on ${eventDate}.`;
        }

        return res.json({
          answer: confirmation,
          provider: actionProvider,
          sources: [],
          mode: 'action',
          actions: [{ type: 'event', data: eventRow }],
        });
      }
    }

    // Step 2: Hybrid Answering with comprehensive SAVED DATA snapshot
    const [{ savedDataText }, matches] = await Promise.all([
      buildSavedDataSnapshot(req.supabase, req.user.id, today),
      searchChunks(req.supabase, {
        userId: req.user.id,
        question: cleanQuestion,
        category: category || null,
      }).catch((err) => {
        console.warn('searchChunks warning:', err.message);
        return [];
      }),
    ]);

    const chunksList = matches || [];
    const fileChunksText =
      chunksList.length > 0
        ? chunksList.map((m, i) => `[FileChunk_${i + 1}] ${m.content}`).join('\n\n')
        : '(No matching document chunks found in vault files)';

    const prompt = ANSWER_PROMPT({
      question: cleanQuestion,
      history: cleanHistory,
      today,
      savedDataText,
      fileChunksText,
    });

    const { text: rawAnswer, provider } = await generateText(prompt);
    const parsed = parseAnswerJson(rawAnswer);

    let mode = 'dashboard';
    let answerText = rawAnswer;
    let usedIndices = [];

    if (parsed) {
      if (['dashboard', 'files', 'general', 'mixed', 'action'].includes(parsed.mode)) {
        mode = parsed.mode;
      }
      if (parsed.answer && typeof parsed.answer === 'string') {
        answerText = parsed.answer;
      }
      if (Array.isArray(parsed.used_chunk_indices)) {
        usedIndices = parsed.used_chunk_indices
          .map((n) => Number(n) - 1)
          .filter((n) => n >= 0 && n < chunksList.length);
      }
    } else {
      // Fallback if model returned plain string
      if (rawAnswer.toLowerCase().includes('not from your files')) {
        mode = 'general';
      } else if (chunksList.length > 0 && chunksList[0].similarity >= 0.5) {
        mode = 'files';
        usedIndices = [0];
      }
    }

    // Build sources only if files were used
    let sources = [];
    if (mode === 'files' || mode === 'mixed') {
      if (usedIndices.length > 0) {
        const usedChunks = usedIndices.map((i) => chunksList[i]);
        const fileIds = [...new Set(usedChunks.map((m) => m.file_id))];
        const { data: files } = await req.supabase
          .from('files')
          .select('id, file_name')
          .in('id', fileIds);
        const fileNameById = Object.fromEntries(
          (files || []).map((f) => [f.id, f.file_name])
        );

        sources = usedChunks.map((m) => ({
          fileId: m.file_id,
          fileName: fileNameById[m.file_id] || 'Unknown file',
          similarity: m.similarity,
        }));
      }
    } else {
      sources = [];
    }

    res.json({
      answer: answerText,
      provider,
      sources,
      mode,
    });
  } catch (err) {
    console.error('Chat pipeline failed:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
