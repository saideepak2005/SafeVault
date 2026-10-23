const { generateText } = require('./llmService');

const ACTION_PROMPT = ({ question, history, today, dayOfWeek }) => `You are a strict intent parser for a personal vault assistant.
Analyze the user's latest message and conversation history. Determine if the user is asking to ADD / RECORD an item (task, note, or event/reminder/birthday) or if they are asking a question / having a conversation ("ask").

Today is ${dayOfWeek}, ${today} (YYYY-MM-DD). Use this date to resolve relative dates like "today", "tomorrow", "next Friday", "in 3 days", "Oct 28", etc. to exact YYYY-MM-DD strings. For upcoming dates without an explicit year, use the appropriate year (${today.slice(0, 4)} or next year if month already passed).

Respond with ONLY a single JSON object, no markdown code block fences, no commentary.

Guidelines:
1. Adding a task (e.g., "add a task to submit assignment tomorrow", "todo: buy groceries by Friday", "task: finish slides"):
{
  "action": "add_task",
  "task": {
    "title": "<clean task description, e.g. 'Submit assignment'>",
    "due_date": "<YYYY-MM-DD or null>"
  }
}

2. Adding a note (e.g., "note that I felt dizzy today", "remember that door code is 1234", "take a note: spoke to doctor"):
{
  "action": "add_note",
  "note": {
    "content": "<exact or cleaned note content, e.g. 'I felt dizzy today'>"
  }
}

3. Adding an event, reminder, deadline, renewal, or birthday:
- Statements declaring someone's birthday (e.g. "Upender's birthday is October 28", "Mom's birthday is May 14") -> event_type: "birthday", description: "<Name>" (e.g. "Upender")
- Reminders or renewals (e.g. "remind me about my insurance renewal on November 2", "set reminder for dentist on Monday") -> event_type: "renewal" or "due_date" or "other"
{
  "action": "add_event",
  "event": {
    "event_type": "<one of: birthday, renewal, due_date, expiry, amount, other>",
    "event_date": "<YYYY-MM-DD>",
    "description": "<short description, e.g. 'Upender' or 'Insurance renewal'>",
    "amount": <number or null>
  }
}

4. Inquiring or asking a question (e.g. "what tasks do I have?", "what is Kafka?", "what is my passport number?", "when is Upender's birthday?", "list all birthdays", "what notes do I have?", "what did I note about dizziness?", "what did I note about X?", "what's coming up this month?", "any alerts this year?", "whose birthday is next?", "how many tasks do I have?"):
{
  "action": "ask"
}

Recent Conversation History:
${(history || []).map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') || '(None)'}

Latest User Message:
"${question}"
`;

function safeParseJson(raw) {
  if (!raw || typeof raw !== 'string') return { action: 'ask' };
  const cleaned = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (inner) {
        console.warn('Inner action JSON parse failed:', inner.message);
      }
    }
    console.warn('Action parse failed, defaulting to ask:', e.message);
    return { action: 'ask' };
  }
}

async function parseChatAction({ question, history, today, dayOfWeek }) {
  try {
    const prompt = ACTION_PROMPT({ question, history, today, dayOfWeek });
    const { text: raw, provider } = await generateText(prompt);
    const parsed = safeParseJson(raw);
    return { parsed, provider };
  } catch (err) {
    console.warn('parseChatAction error, defaulting to ask:', err.message);
    return { parsed: { action: 'ask' }, provider: null };
  }
}

module.exports = { parseChatAction, safeParseJson };
