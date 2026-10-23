const {
  getNextBirthdayDate,
  getDaysBetween,
  formatRelativeDays,
} = require('./eventHelpers');

/**
 * Builds a compact SAVED DATA snapshot text for the chat prompt.
 * Enforces:
 * - ALL birthdays with name, original date, NEXT occurrence, days until (computed in code).
 * - Events: ALL upcoming within 365 days + 20 most recent past events.
 * - Tasks: ALL open tasks + 20 most recently completed tasks.
 * - Notes: 40 most recent notes.
 * - Exact total counts and truncation markers "(showing N of M)".
 * - Capped at ~150 lines total, compact per row.
 */
async function buildSavedDataSnapshot(supabase, userId, todayStr) {
  const in365Days = new Date(Date.parse(todayStr + 'T00:00:00Z') + 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // Parallel queries scoped to user via RLS (or user_id filter)
  const [
    birthdaysRes,
    upcomingEventsRes,
    pastEventsRes,
    totalEventsRes,
    openTasksRes,
    completedTasksRes,
    totalTasksRes,
    notesRes,
    totalNotesRes,
  ] = await Promise.all([
    // All birthdays
    supabase
      .from('extracted_events')
      .select('id, description, event_date, amount, created_at')
      .eq('event_type', 'birthday')
      .not('event_date', 'is', null),
    // Upcoming events within 365 days
    supabase
      .from('extracted_events')
      .select('id, event_type, event_date, description, amount, created_at')
      .neq('event_type', 'birthday')
      .gte('event_date', todayStr)
      .lte('event_date', in365Days)
      .order('event_date', { ascending: true }),
    // Past 20 events
    supabase
      .from('extracted_events')
      .select('id, event_type, event_date, description, amount, created_at')
      .neq('event_type', 'birthday')
      .lt('event_date', todayStr)
      .order('event_date', { ascending: false })
      .limit(20),
    // Total non-birthday events count
    supabase
      .from('extracted_events')
      .select('*', { count: 'exact', head: true })
      .neq('event_type', 'birthday'),
    // Open tasks (ALL)
    supabase
      .from('tasks')
      .select('id, title, is_done, due_date, created_at')
      .eq('is_done', false)
      .order('due_date', { ascending: true, nullsFirst: false }),
    // Completed tasks (20 most recent)
    supabase
      .from('tasks')
      .select('id, title, is_done, due_date, created_at')
      .eq('is_done', true)
      .order('created_at', { ascending: false })
      .limit(20),
    // Total tasks count
    supabase.from('tasks').select('*', { count: 'exact', head: true }),
    // Notes (40 most recent)
    supabase
      .from('notes')
      .select('id, content, created_at')
      .order('created_at', { ascending: false })
      .limit(40),
    // Total notes count
    supabase.from('notes').select('*', { count: 'exact', head: true }),
  ]);

  // 1. Process Birthdays
  const rawBirthdays = birthdaysRes.data || [];
  const processedBirthdays = rawBirthdays
    .map((b) => {
      const nextDate = getNextBirthdayDate(b.event_date, todayStr);
      const daysUntil = nextDate ? getDaysBetween(todayStr, nextDate) : 9999;
      return {
        ...b,
        next_occurrence: nextDate,
        days_until: daysUntil,
      };
    })
    .sort((a, b) => a.days_until - b.days_until);

  const totalBirthdays = processedBirthdays.length;

  // 2. Process Events
  const upcomingEvents = upcomingEventsRes.data || [];
  const pastEvents = pastEventsRes.data || [];
  const totalEvents = totalEventsRes.count ?? (upcomingEvents.length + pastEvents.length);
  const shownEventsCount = upcomingEvents.length + pastEvents.length;

  // 3. Process Tasks
  const openTasks = openTasksRes.data || [];
  const completedTasks = completedTasksRes.data || [];
  const totalTasks = totalTasksRes.count ?? (openTasks.length + completedTasks.length);
  const shownTasksCount = openTasks.length + completedTasks.length;

  // 4. Process Notes
  const notes = notesRes.data || [];
  const totalNotes = totalNotesRes.count ?? notes.length;
  const shownNotesCount = notes.length;

  // Assemble SAVED DATA text lines
  const lines = [];

  // Summary counts header for exact questions
  lines.push('=== SAVED DATA (DATABASE SOURCE OF TRUTH) ===');
  lines.push(
    `TOTAL COUNTS: Birthdays: ${totalBirthdays}, Events/Alerts: ${totalEvents}, Tasks: ${totalTasks} (${openTasks.length} open, ${completedTasks.length} completed shown), Notes: ${totalNotes}`
  );

  // Birthdays section
  lines.push(`\n[BIRTHDAYS] Total: ${totalBirthdays}`);
  if (processedBirthdays.length === 0) {
    lines.push('(No birthdays saved)');
  } else {
    for (const b of processedBirthdays) {
      const rel = formatRelativeDays(b.days_until);
      lines.push(
        `- ${b.description}: next ${b.next_occurrence} (${rel}, original date ${b.event_date})`
      );
    }
  }

  // Events & Alerts section
  const eventsTruncated = shownEventsCount < totalEvents;
  lines.push(
    `\n[EVENTS & ALERTS] Total: ${totalEvents}${
      eventsTruncated ? ` (showing ${shownEventsCount} of ${totalEvents})` : ''
    }`
  );
  if (shownEventsCount === 0) {
    lines.push('(No events saved)');
  } else {
    if (upcomingEvents.length > 0) {
      lines.push('Upcoming (within 365 days):');
      for (const e of upcomingEvents) {
        const diff = getDaysBetween(todayStr, e.event_date);
        const rel = formatRelativeDays(diff);
        lines.push(
          `- [${e.event_type}] ${e.description} on ${e.event_date}${
            e.amount != null ? ` ($${e.amount})` : ''
          } (${rel})`
        );
      }
    }
    if (pastEvents.length > 0) {
      lines.push('Past events (recent 20):');
      for (const e of pastEvents) {
        const diff = getDaysBetween(todayStr, e.event_date);
        const rel = formatRelativeDays(diff);
        lines.push(
          `- [${e.event_type}] ${e.description} on ${e.event_date}${
            e.amount != null ? ` ($${e.amount})` : ''
          } (${rel})`
        );
      }
    }
  }

  // Tasks section
  const tasksTruncated = shownTasksCount < totalTasks;
  lines.push(
    `\n[TASKS] Total: ${totalTasks} (${openTasks.length} open, ${totalTasks - openTasks.length} completed)${
      tasksTruncated ? ` (showing ${shownTasksCount} of ${totalTasks})` : ''
    }`
  );
  if (shownTasksCount === 0) {
    lines.push('(No tasks saved)');
  } else {
    if (openTasks.length > 0) {
      lines.push('Open tasks:');
      for (const t of openTasks) {
        lines.push(
          `- [OPEN] ${t.title}${t.due_date ? ` (due ${t.due_date})` : ''} (created ${t.created_at.slice(
            0,
            10
          )})`
        );
      }
    }
    if (completedTasks.length > 0) {
      lines.push('Completed tasks:');
      for (const t of completedTasks) {
        lines.push(
          `- [DONE] ${t.title}${t.due_date ? ` (due ${t.due_date})` : ''} (created ${t.created_at.slice(
            0,
            10
          )})`
        );
      }
    }
  }

  // Notes section
  const notesTruncated = shownNotesCount < totalNotes;
  lines.push(
    `\n[NOTES] Total: ${totalNotes}${
      notesTruncated ? ` (showing ${shownNotesCount} of ${totalNotes})` : ''
    }`
  );
  if (notes.length === 0) {
    lines.push('(No notes saved)');
  } else {
    for (const n of notes) {
      const cleanContent = n.content.replace(/\s+/g, ' ').slice(0, 150);
      lines.push(`- "${cleanContent}" (created ${n.created_at.slice(0, 10)})`);
    }
  }

  // Cap at ~150 lines
  let finalLines = lines;
  if (lines.length > 150) {
    finalLines = lines.slice(0, 149);
    finalLines.push(`(showing first 150 lines of saved data out of ${lines.length})`);
  }

  return {
    savedDataText: finalLines.join('\n'),
    counts: {
      birthdays: totalBirthdays,
      events: totalEvents,
      tasks: totalTasks,
      notes: totalNotes,
    },
  };
}

module.exports = { buildSavedDataSnapshot };
