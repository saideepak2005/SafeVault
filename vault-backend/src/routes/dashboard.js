const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard - everything the dashboard needs in one call.
// Note this does zero LLM calls: all the heavy lifting (classification,
// date extraction) already happened once at upload time. This is why the
// dashboard can be refreshed constantly without burning API quota.
router.get('/', requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [eventsRes, notesRes, tasksRes] = await Promise.all([
      req.supabase
        .from('extracted_events')
        .select('id, file_id, event_type, event_date, description, amount')
        .gte('event_date', today)
        .lte('event_date', in30Days)
        .order('event_date', { ascending: true }),
      req.supabase.from('notes').select('*').order('created_at', { ascending: false }).limit(20),
      req.supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }),
    ]);

    if (eventsRes.error) throw new Error(eventsRes.error.message);
    if (notesRes.error) throw new Error(notesRes.error.message);
    if (tasksRes.error) throw new Error(tasksRes.error.message);

    const alerts = (eventsRes.data || []).filter((e) => e.event_type !== 'birthday');
    const birthdays = (eventsRes.data || []).filter((e) => e.event_type === 'birthday');

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

module.exports = router;
