const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  ALLOWED_EVENT_TYPES,
  isValidDate,
  getNextBirthdayDate,
  getDaysBetween,
} = require('../services/eventHelpers');

const router = express.Router();

// GET /api/dashboard - everything the dashboard needs in one call.
// Accepts optional ?today=YYYY-MM-DD to use user's local date.
router.get('/', requireAuth, async (req, res) => {
  try {
    const today =
      req.query.today && isValidDate(req.query.today)
        ? req.query.today
        : new Date().toISOString().slice(0, 10);
    const in30Days = new Date(Date.parse(today + 'T00:00:00Z') + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const [alertsRes, birthdaysRes, notesRes, tasksRes] = await Promise.all([
      req.supabase
        .from('extracted_events')
        .select('id, file_id, event_type, event_date, description, amount')
        .neq('event_type', 'birthday')
        .gte('event_date', today)
        .lte('event_date', in30Days)
        .order('event_date', { ascending: true }),
      req.supabase
        .from('extracted_events')
        .select('id, file_id, event_type, event_date, description, amount')
        .eq('event_type', 'birthday')
        .not('event_date', 'is', null),
      req.supabase.from('notes').select('*').order('created_at', { ascending: false }).limit(20),
      req.supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }),
    ]);

    if (alertsRes.error) throw new Error(alertsRes.error.message);
    if (birthdaysRes.error) throw new Error(birthdaysRes.error.message);
    if (notesRes.error) throw new Error(notesRes.error.message);
    if (tasksRes.error) throw new Error(tasksRes.error.message);

    const alerts = (alertsRes.data || []).map((a) => {
      const daysUntil = a.event_date ? getDaysBetween(today, a.event_date) : null;
      return {
        ...a,
        days_until: daysUntil,
      };
    });

    // Birthdays card: ALL saved birthdays sorted by next occurrence
    const birthdays = (birthdaysRes.data || [])
      .map((b) => {
        const nextDate = getNextBirthdayDate(b.event_date, today);
        const daysUntil = nextDate ? getDaysBetween(today, nextDate) : null;
        return {
          ...b,
          next_occurrence: nextDate,
          days_until: daysUntil,
          event_date: nextDate, // existing field preserved for backwards compatibility
          original_date: b.event_date,
        };
      })
      .sort((a, b) => (a.days_until ?? 9999) - (b.days_until ?? 9999));

    res.json({
      alerts,
      birthdays,
      notes: notesRes.data || [],
      tasks: tasksRes.data || [],
    });
  } catch (err) {
    console.error('Dashboard fetch failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dashboard/events { event_type, event_date, description, amount? }
router.post('/events', requireAuth, async (req, res) => {
  const { event_type, event_date, description, amount } = req.body || {};

  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    return res.status(400).json({ error: '"description" is required' });
  }

  if (!isValidDate(event_date)) {
    return res.status(400).json({ error: 'Valid event_date "YYYY-MM-DD" is required' });
  }

  const clampedType = ALLOWED_EVENT_TYPES.includes(event_type) ? event_type : 'other';
  const numAmount = amount != null && !isNaN(Number(amount)) ? Number(amount) : null;

  const { data, error } = await req.supabase
    .from('extracted_events')
    .insert({
      user_id: req.user.id,
      file_id: null,
      event_type: clampedType,
      event_date,
      description: description.trim(),
      amount: numAmount,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// POST /api/dashboard/notes  { content: string }
router.post('/notes', requireAuth, async (req, res) => {
  const { content } = req.body || {};
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: '"content" is required' });
  }
  const { data, error } = await req.supabase
    .from('notes')
    .insert({ user_id: req.user.id, content: content.trim() })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// POST /api/dashboard/tasks  { title: string, due_date?: "YYYY-MM-DD" }
router.post('/tasks', requireAuth, async (req, res) => {
  const { title, due_date } = req.body || {};
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: '"title" is required' });
  }
  if (due_date && !isValidDate(due_date)) {
    return res.status(400).json({ error: 'Invalid due_date' });
  }
  const { data, error } = await req.supabase
    .from('tasks')
    .insert({ user_id: req.user.id, title: title.trim(), due_date: due_date || null })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/dashboard/tasks/:id  { is_done: boolean }
router.patch('/tasks/:id', requireAuth, async (req, res) => {
  const { is_done } = req.body || {};
  const { data, error } = await req.supabase
    .from('tasks')
    .update({ is_done: Boolean(is_done) })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/dashboard/events/:id
router.delete('/events/:id', requireAuth, async (req, res) => {
  const { error } = await req.supabase
    .from('extracted_events')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// DELETE /api/dashboard/notes/:id
router.delete('/notes/:id', requireAuth, async (req, res) => {
  const { error } = await req.supabase
    .from('notes')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// DELETE /api/dashboard/tasks/:id
router.delete('/tasks/:id', requireAuth, async (req, res) => {
  const { error } = await req.supabase
    .from('tasks')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
