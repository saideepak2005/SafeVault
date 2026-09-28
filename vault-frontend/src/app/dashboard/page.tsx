'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  fetchDashboard,
  addNote,
  addTask,
  toggleTask,
  type DashboardData,
  type DashboardEvent,
  type Note,
  type Task,
} from '@/lib/api';
import Nav from '@/components/nav';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Note form
  const [noteContent, setNoteContent] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Task form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const d = await fetchDashboard();
      setData(d);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteContent.trim() || addingNote) return;
    setAddingNote(true);
    try {
      const note = await addNote(noteContent.trim());
      setData((prev) =>
        prev ? { ...prev, notes: [note, ...prev.notes] } : prev,
      );
      setNoteContent('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setAddingNote(false);
    }
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim() || addingTask) return;
    setAddingTask(true);
    try {
      const task = await addTask(
        taskTitle.trim(),
        taskDueDate || undefined,
      );
      setData((prev) =>
        prev ? { ...prev, tasks: [...prev.tasks, task] } : prev,
      );
      setTaskTitle('');
      setTaskDueDate('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add task');
    } finally {
      setAddingTask(false);
    }
  }

  async function handleToggleTask(task: Task) {
    try {
      const updated = await toggleTask(task.id, !task.is_done);
      setData((prev) =>
        prev
          ? {
              ...prev,
              tasks: prev.tasks.map((t) =>
                t.id === updated.id ? updated : t,
              ),
            }
          : prev,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded">
            {error}
          </div>
        )}

        {loading && <p className="text-gray-400">Loading dashboard…</p>}

        {data && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Alerts */}
            <Section title="⚠️ Upcoming Alerts" count={data.alerts.length}>
              {data.alerts.length === 0 ? (
                <Empty>No upcoming alerts in the next 30 days.</Empty>
              ) : (
                <ul className="space-y-2">
                  {data.alerts.map((evt) => (
                    <EventRow key={evt.id} event={evt} />
                  ))}
                </ul>
              )}
            </Section>

            {/* Birthdays */}
            <Section title="🎂 Birthdays" count={data.birthdays.length}>
              {data.birthdays.length === 0 ? (
                <Empty>No upcoming birthdays.</Empty>
              ) : (
                <ul className="space-y-2">
                  {data.birthdays.map((evt) => (
                    <EventRow key={evt.id} event={evt} />
                  ))}
                </ul>
              )}
            </Section>

            {/* Notes */}
            <Section title="📝 Notes" count={data.notes.length}>
              <form onSubmit={handleAddNote} className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Add a note…"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={addingNote || !noteContent.trim()}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Add
                </button>
              </form>
              {data.notes.length === 0 ? (
                <Empty>No notes yet.</Empty>
              ) : (
                <ul className="space-y-2">
                  {data.notes.map((note) => (
                    <NoteRow key={note.id} note={note} />
                  ))}
                </ul>
              )}
            </Section>

            {/* Tasks */}
            <Section title="✅ Tasks" count={data.tasks.length}>
              <form onSubmit={handleAddTask} className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Task title…"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={addingTask || !taskTitle.trim()}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Add
                </button>
              </form>
              {data.tasks.length === 0 ? (
                <Empty>No tasks yet.</Empty>
              ) : (
                <ul className="space-y-2">
                  {data.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={handleToggleTask}
                    />
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <h2 className="text-lg font-semibold mb-3">
        {title}{' '}
        <span className="text-sm text-gray-400 font-normal">({count})</span>
      </h2>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-400">{children}</p>;
}

function EventRow({ event }: { event: DashboardEvent }) {
  return (
    <li className="text-sm p-2 bg-gray-50 rounded flex justify-between items-start">
      <span>
        <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs mr-2">
          {event.event_type}
        </span>
        {event.description || 'No description'}
      </span>
      <span className="text-gray-500 whitespace-nowrap ml-2">
        {event.event_date || '—'}
        {event.amount != null && ` • $${event.amount}`}
      </span>
    </li>
  );
}

function NoteRow({ note }: { note: Note }) {
  return (
    <li className="text-sm p-2 bg-gray-50 rounded flex justify-between">
      <span>{note.content}</span>
      <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
        {new Date(note.created_at).toLocaleDateString()}
      </span>
    </li>
  );
}

function TaskRow({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: (task: Task) => void;
}) {
  return (
    <li className="text-sm p-2 bg-gray-50 rounded flex items-center gap-2">
      <input
        type="checkbox"
        checked={task.is_done}
        onChange={() => onToggle(task)}
        className="w-4 h-4 accent-blue-600"
      />
      <span className={task.is_done ? 'line-through text-gray-400' : ''}>
        {task.title}
      </span>
      {task.due_date && (
        <span className="ml-auto text-xs text-gray-400">{task.due_date}</span>
      )}
    </li>
  );
}
