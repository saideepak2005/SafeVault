const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { searchChunks } = require('../services/retrievalService');
const { generateText } = require('../services/llmService');
const { parseChatAction } = require('../services/chatActionService');
const {
  ALLOWED_EVENT_TYPES,
  isValidDate,
  getNextBirthdayDate,
} = require('../services/eventHelpers');

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
  dashboardSnapshot,
  fileChunksText,
}) => `You are the AI assistant for SafeVault, a personal document vault and dashboard.
Today's date: ${today}

Context from User's SafeVault:
--- DASHBOARD SNAPSHOT ---
${dashboardSnapshot}
--- END DASHBOARD SNAPSHOT ---

--- RETRIEVED FILE CHUNKS ---
${fileChunksText}
--- END RETRIEVED FILE CHUNKS ---

Recent Conversation History:
${(history || []).map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') || '(None)'}

User's Question: "${question}"

Instructions and Rules:
1. Questions about MY documents, personal data, dates, amounts, notes or tasks:
   - Answer ONLY from the context provided above.
   - If missing from the context, clearly state that you could not find it in their files or records. NEVER guess, assume, or hallucinate personal facts, numbers, dates, or documents (e.g., passport number, insurance number, SSN, personal dates).
   - Mode should be "files".
2. General-knowledge questions (e.g. technical concepts like "what is Kafka Schema Registry?", math, recipes, general facts):
   - Answer normally and conversationally.
   - You MUST label it clearly as "Not from your files" (e.g. start with "[Not from your files] ").
   - Mode should be "general".
   - Set used_chunk_indices to [].
3. If both help (e.g., user asks for general advice related to a document or note):
   - Combine them and explicitly say which part came from the user's files/records and which part is general advice.
   - Mode should be "mixed".

Respond with ONLY a single JSON object (no markdown code blocks, no text before or after):
{
  "mode": "files" | "general" | "mixed",
  "answer": "<your complete answer text>",
  "used_chunk_indices": [1, 2]
}
Note: used_chunk_indices are 1-based indices of Retrieved File Chunks actually used. Return [] if no file chunks were used (e.g. for general knowledge, questions answered from dashboard snapshot only, or when info was not found).`;

// POST /api/chat { question: string, category?: string, history?: Array<{ role: string, content: string }> }
router.post('/', requireAuth, async (req, res) => {
  const { question, category, history } = req.body || {};
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: '"question" is required' });
  }

  const cleanQuestion = question.trim();
  const today = new Date().toISOString().slice(0, 10);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = days[new Date().getDay()];

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

    // Step 2: Hybrid Answering
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [notesRes, tasksRes, eventsRes, birthdaysRes, matches] = await Promise.all([
      req.supabase
        .from('notes')
        .select('id, content, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
      req.supabase
        .from('tasks')
        .select('id, title, is_done, due_date')
        .eq('is_done', false)
        .order('due_date', { ascending: true, nullsFirst: false }),
      req.supabase
        .from('extracted_events')
        .select('id, description, event_date, event_type, amount')
        .neq('event_type', 'birthday')
        .gte('event_date', today)
        .lte('event_date', in30Days)
        .order('event_date', { ascending: true }),
      req.supabase
        .from('extracted_events')
        .select('id, description, event_date, event_type')
        .eq('event_type', 'birthday')
        .not('event_date', 'is', null),
      searchChunks(req.supabase, {
        userId: req.user.id,
        question: cleanQuestion,
        category: category || null,
      }).catch((err) => {
        console.warn('searchChunks warning:', err.message);
        return [];
      }),
    ]);

    const dashboardLines = [];
    if (tasksRes.data && tasksRes.data.length > 0) {
      dashboardLines.push('Open Tasks:');
      tasksRes.data.forEach((t) =>
        dashboardLines.push(`- ${t.title}${t.due_date ? ` (due: ${t.due_date})` : ''}`)
      );
    }
    if (notesRes.data && notesRes.data.length > 0) {
      dashboardLines.push('Recent Notes:');
      notesRes.data.forEach((n) =>
        dashboardLines.push(`- ${n.content} (added: ${n.created_at.slice(0, 10)})`)
      );
    }
    if (eventsRes.data && eventsRes.data.length > 0) {
      dashboardLines.push('Upcoming Alerts / Events (next 30 days):');
      eventsRes.data.forEach((e) =>
        dashboardLines.push(
          `- [${e.event_type}] ${e.description} on ${e.event_date}${
            e.amount != null ? ` (amount: $${e.amount})` : ''
          }`
        )
      );
    }

    const upcomingBirthdays = (birthdaysRes.data || [])
      .map((b) => ({ ...b, event_date: getNextBirthdayDate(b.event_date, today) }))
      .filter((b) => b.event_date && b.event_date >= today && b.event_date <= in30Days)
      .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''));

    if (upcomingBirthdays.length > 0) {
      dashboardLines.push('Upcoming Birthdays (next 30 days):');
      upcomingBirthdays.forEach((b) => dashboardLines.push(`- ${b.description}: ${b.event_date}`));
    }

    const dashboardSnapshot =
      dashboardLines.length > 0
        ? dashboardLines.join('\n')
        : '(No open tasks, notes, or upcoming events)';

    const chunksList = matches || [];
    const fileChunksText =
      chunksList.length > 0
        ? chunksList.map((m, i) => `[FileChunk_${i + 1}] ${m.content}`).join('\n\n')
        : '(No matching document chunks found in vault files)';

    const prompt = ANSWER_PROMPT({
      question: cleanQuestion,
      history: cleanHistory,
      today,
      dashboardSnapshot,
      fileChunksText,
    });

    const { text: rawAnswer, provider } = await generateText(prompt);
    const parsed = parseAnswerJson(rawAnswer);

    let mode = 'files';
    let answerText = rawAnswer;
    let usedIndices = [];

    if (parsed) {
      if (['files', 'general', 'mixed', 'action'].includes(parsed.mode)) {
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
