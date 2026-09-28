const { generateText } = require('./llmService');

const CATEGORIES = [
  'Documents', 'Personal', 'Health', 'Finance', 'Education', 'Work', 'Subscriptions', 'Others',
];

const PROMPT_TEMPLATE = (excerpt) => `You are a strict document classifier. Read the excerpt below and
respond with ONLY a single JSON object, no markdown fences, no commentary.

Allowed categories (pick exactly one): ${CATEGORIES.join(', ')}

Return this exact shape:
{
  "category": "<one of the allowed categories>",
  "subcategory": "<a short 1-3 word subcategory, or null>",
  "events": [
    {
      "event_type": "<one of: expiry, renewal, due_date, birthday, amount, other>",
      "event_date": "<YYYY-MM-DD or null>",
      "description": "<short description, e.g. 'Health insurance renewal'>",
      "amount": <number or null>
    }
  ]
}

If there are no meaningful dates or amounts, return "events": [].
Never invent a date or amount that isn't actually in the text.

Excerpt:
"""
${excerpt.slice(0, 6000)}
"""`;

// Strips ```json fences some models add despite instructions, and safely parses.
function safeParseJson(raw) {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn('Classification JSON parse failed, defaulting to Others:', e.message);
    return { category: 'Others', subcategory: null, events: [] };
  }
}

async function classifyAndExtract(text) {
  const { text: raw } = await generateText(PROMPT_TEMPLATE(text));
  const parsed = safeParseJson(raw);

  // Defensive: never trust the model to actually respect the enum, even
  // though we asked it to. This is what "fixed taxonomy" means in practice.
  if (!CATEGORIES.includes(parsed.category)) {
    parsed.category = 'Others';
  }
  if (!Array.isArray(parsed.events)) {
    parsed.events = [];
  }

  return parsed;
}

module.exports = { classifyAndExtract, CATEGORIES };
