'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  fetchDashboard,
  addNote,
  addTask,
  toggleTask,
  addEvent,
  deleteEvent,
  deleteNote,
  deleteTask,
  type DashboardData,
  type DashboardEvent,
  type Note,
  type Task,
} from '@/lib/api';
import Nav from '@/components/nav';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellOff,
  Cake,
  CalendarHeart,
  FileText,
  NotebookPen,
  ListTodo,
  CheckCheck,
  Plus,
  Loader2,
  Calendar,
  AlertTriangle,
  Clock,
  Sparkles,
  Check,
  Trash2,
} from 'lucide-react';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Alerts form
  const [alertWhat, setAlertWhat] = useState('');
  const [alertDate, setAlertDate] = useState('');
  const [alertType, setAlertType] = useState<'due_date' | 'renewal' | 'expiry' | 'other'>('due_date');
  const [addingAlert, setAddingAlert] = useState(false);

  // Birthdays form
  const [birthdayName, setBirthdayName] = useState('');
  const [birthdayDate, setBirthdayDate] = useState('');
  const [addingBirthday, setAddingBirthday] = useState(false);

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
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const dateDay = String(now.getDate()).padStart(2, '0');
      const localToday = `${y}-${m}-${dateDay}`;
      const data = await fetchDashboard(localToday);
      setData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) load();
  }, [user, load]);

  async function handleAddAlert(e: React.FormEvent) {
    e.preventDefault();
    if (!alertWhat.trim() || !alertDate || addingAlert) return;
    setAddingAlert(true);
    try {
      await addEvent({
        description: alertWhat.trim(),
        event_date: alertDate,
        event_type: alertType,
      });
      await load();
      setAlertWhat('');
      setAlertDate('');
      setAlertType('due_date');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add alert');
    } finally {
      setAddingAlert(false);
    }
  }

  async function handleAddBirthday(e: React.FormEvent) {
    e.preventDefault();
    if (!birthdayName.trim() || !birthdayDate || addingBirthday) return;
    setAddingBirthday(true);
    try {
      await addEvent({
        description: birthdayName.trim(),
        event_date: birthdayDate,
        event_type: 'birthday',
      });
      await load();
      setBirthdayName('');
      setBirthdayDate('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add birthday');
    } finally {
      setAddingBirthday(false);
    }
  }

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

  async function handleDeleteAlert(id: string) {
    try {
      await deleteEvent(id);
      setData((prev) =>
        prev ? { ...prev, alerts: prev.alerts.filter((a) => a.id !== id) } : prev,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete alert');
    }
  }

  async function handleDeleteBirthday(id: string) {
    try {
      await deleteEvent(id);
      setData((prev) =>
        prev ? { ...prev, birthdays: prev.birthdays.filter((b) => b.id !== id) } : prev,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete birthday');
    }
  }

  async function handleDeleteNote(id: string) {
    try {
      await deleteNote(id);
      setData((prev) =>
        prev ? { ...prev, notes: prev.notes.filter((n) => n.id !== id) } : prev,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    }
  }

  async function handleDeleteTask(id: string) {
    try {
      await deleteTask(id);
      setData((prev) =>
        prev ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== id) } : prev,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Loading your vault…</p>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 300,
        damping: 24,
      },
    },
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      <Nav />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Dashboard
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                <Sparkles className="w-3 h-3 mr-1 text-indigo-500" />
                Live Vault
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Your real-time document intelligence, upcoming reminders, and pending actions.
            </p>
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-rose-50 border border-rose-200/80 rounded-xl text-rose-800 text-sm flex items-center gap-3 shadow-xs"
          >
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="flex-1 font-medium">{error}</span>
          </motion.div>
        )}

        {/* Loading Skeleton */}
        {loading && <DashboardSkeleton />}

        {/* Dashboard Grid */}
        {data && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* 1. Alerts */}
            <motion.div variants={itemVariants}>
              <SectionCard
                title="Upcoming Alerts"
                count={data.alerts.length}
                icon={Bell}
                badgeColor="bg-amber-50 text-amber-700 border-amber-200/80"
                iconBg="bg-amber-500/10 text-amber-600"
                topAccent="border-t-amber-500"
                description="Next 30 days critical document events"
              >
                <form onSubmit={handleAddAlert} className="flex flex-col gap-2 mb-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Alert description (e.g. Insurance renewal)…"
                      value={alertWhat}
                      onChange={(e) => setAlertWhat(e.target.value)}
                      className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                    />
                  </div>
                  <div className="flex flex-wrap sm:flex-nowrap gap-2">
                    <input
                      type="date"
                      value={alertDate}
                      onChange={(e) => setAlertDate(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer"
                    />
                    <select
                      value={alertType}
                      onChange={(e) =>
                        setAlertType(
                          e.target.value as 'due_date' | 'renewal' | 'expiry' | 'other'
                        )
                      }
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer"
                    >
                      <option value="due_date">Due Date</option>
                      <option value="renewal">Renewal</option>
                      <option value="expiry">Expiry</option>
                      <option value="other">Other</option>
                    </select>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      type="submit"
                      disabled={addingAlert || !alertWhat.trim() || !alertDate}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-xl hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 disabled:pointer-events-none transition shadow-sm shadow-amber-600/10 cursor-pointer"
                    >
                      {addingAlert ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      <span>Add</span>
                    </motion.button>
                  </div>
                </form>

                {data.alerts.length === 0 ? (
                  <EmptyState
                    icon={BellOff}
                    title="No upcoming alerts"
                    description="You are all caught up for the next 30 days."
                    accent="amber"
                  />
                ) : (
                  <ul className="space-y-2.5">
                    <AnimatePresence initial={false}>
                      {data.alerts.map((evt) => (
                        <EventRow
                          key={evt.id}
                          event={evt}
                          type="alert"
                          onDelete={handleDeleteAlert}
                        />
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </SectionCard>
            </motion.div>

            {/* 2. Birthdays */}
            <motion.div variants={itemVariants}>
              <SectionCard
                title="Birthdays"
                count={data.birthdays.length}
                icon={Cake}
                badgeColor="bg-rose-50 text-rose-700 border-rose-200/80"
                iconBg="bg-rose-500/10 text-rose-600"
                topAccent="border-t-rose-500"
                description="Upcoming celebration dates extracted from vault"
              >
                <form onSubmit={handleAddBirthday} className="flex flex-col sm:flex-row gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Name (e.g. Upender)…"
                    value={birthdayName}
                    onChange={(e) => setBirthdayName(e.target.value)}
                    className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                  />
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={birthdayDate}
                      onChange={(e) => setBirthdayDate(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all cursor-pointer"
                    />
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      type="submit"
                      disabled={addingBirthday || !birthdayName.trim() || !birthdayDate}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-xl hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 disabled:pointer-events-none transition shadow-sm shadow-rose-600/10 cursor-pointer"
                    >
                      {addingBirthday ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      <span>Add</span>
                    </motion.button>
                  </div>
                </form>

                {data.birthdays.length === 0 ? (
                  <EmptyState
                    icon={CalendarHeart}
                    title="No upcoming birthdays"
                    description="No birthdays recorded in your vault yet."
                    accent="rose"
                  />
                ) : (
                  <ul className="space-y-2.5">
                    <AnimatePresence initial={false}>
                      {data.birthdays.map((evt) => (
                        <EventRow
                          key={evt.id}
                          event={evt}
                          type="birthday"
                          onDelete={handleDeleteBirthday}
                        />
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </SectionCard>
            </motion.div>

            {/* 3. Notes */}
            <motion.div variants={itemVariants}>
              <SectionCard
                title="Quick Notes"
                count={data.notes.length}
                icon={FileText}
                badgeColor="bg-indigo-50 text-indigo-700 border-indigo-200/80"
                iconBg="bg-indigo-500/10 text-indigo-600"
                topAccent="border-t-indigo-500"
                description="Personal thoughts and quick reminders"
              >
                <form onSubmit={handleAddNote} className="flex gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Write a quick note…"
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={addingNote || !noteContent.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:pointer-events-none transition shadow-sm shadow-indigo-600/10 cursor-pointer"
                  >
                    {addingNote ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    <span>Add</span>
                  </motion.button>
                </form>

                {data.notes.length === 0 ? (
                  <EmptyState
                    icon={NotebookPen}
                    title="No notes yet"
                    description="Capture a thought or paste important reference info above."
                    accent="indigo"
                  />
                ) : (
                  <ul className="space-y-2.5">
                    <AnimatePresence initial={false}>
                      {data.notes.map((note) => (
                        <NoteRow
                          key={note.id}
                          note={note}
                          onDelete={handleDeleteNote}
                        />
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </SectionCard>
            </motion.div>

            {/* 4. Tasks */}
            <motion.div variants={itemVariants}>
              <SectionCard
                title="Action Tasks"
                count={data.tasks.length}
                icon={ListTodo}
                badgeColor="bg-emerald-50 text-emerald-700 border-emerald-200/80"
                iconBg="bg-emerald-500/10 text-emerald-600"
                topAccent="border-t-emerald-500"
                description="To-dos and checklist items"
              >
                <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="What needs to be done?…"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                    />
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      type="submit"
                      disabled={addingTask || !taskTitle.trim()}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:pointer-events-none transition shadow-sm shadow-emerald-600/10 cursor-pointer"
                    >
                      {addingTask ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      <span>Add</span>
                    </motion.button>
                  </div>
                </form>

                {data.tasks.length === 0 ? (
                  <EmptyState
                    icon={CheckCheck}
                    title="No tasks yet"
                    description="Keep yourself accountable by adding your first task above."
                    accent="emerald"
                  />
                ) : (
                  <ul className="space-y-2.5">
                    <AnimatePresence initial={false}>
                      {data.tasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          onToggle={handleToggleTask}
                          onDelete={handleDeleteTask}
                        />
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </SectionCard>
            </motion.div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

// ── Sub-components & Helpers ────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  badgeColor: string;
  iconBg: string;
  topAccent: string;
  description: string;
  children: React.ReactNode;
}

function SectionCard({
  title,
  count,
  icon: Icon,
  badgeColor,
  iconBg,
  topAccent,
  description,
  children,
}: SectionCardProps) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] transition-all duration-300 overflow-hidden border-t-4 ${topAccent} flex flex-col h-full`}
    >
      <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              {title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{description}</p>
          </div>
        </div>

        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeColor}`}
        >
          {count}
        </span>
      </div>

      <div className="p-5 sm:p-6 flex-1 flex flex-col">{children}</div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accent: 'amber' | 'rose' | 'indigo' | 'emerald';
}) {
  const accentClasses = {
    amber: 'bg-amber-50 text-amber-500 border-amber-100',
    rose: 'bg-rose-50 text-rose-500 border-rose-100',
    indigo: 'bg-indigo-50 text-indigo-500 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-500 border-emerald-100',
  }[accent];

  return (
    <div className="my-auto py-8 px-4 flex flex-col items-center justify-center text-center">
      <div
        className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-3 shadow-xs ${accentClasses}`}
      >
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function EventRow({
  event,
  type,
  onDelete,
}: {
  event: DashboardEvent;
  type: 'alert' | 'birthday';
  onDelete?: (id: string) => void;
}) {
  const isAlert = type === 'alert';
  const isBirthday = type === 'birthday';
  const isWithin30 =
    event.days_until != null && event.days_until <= 30 && event.days_until >= 0;

  let daysLabel: string | null = null;
  if (event.days_until != null) {
    if (event.days_until === 0) daysLabel = 'today';
    else if (event.days_until === 1) daysLabel = 'tomorrow';
    else if (event.days_until > 1) daysLabel = `in ${event.days_until} days`;
    else daysLabel = `${Math.abs(event.days_until)} days ago`;
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, height: 0, marginBottom: 0, padding: 0 }}
      transition={{ duration: 0.2 }}
      className={`group p-3 border rounded-xl flex items-center justify-between gap-3 transition-colors overflow-hidden ${
        isBirthday && isWithin30
          ? 'bg-rose-50/70 border-rose-200/90 hover:bg-rose-50 hover:border-rose-300'
          : 'bg-slate-50/70 hover:bg-slate-50 border-slate-200/60 hover:border-slate-300/80'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span
          className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium uppercase tracking-wider ${
            isAlert
              ? 'bg-amber-100/80 text-amber-800 border border-amber-200/60'
              : isWithin30
              ? 'bg-rose-200 text-rose-900 border border-rose-300/80'
              : 'bg-rose-100/80 text-rose-800 border border-rose-200/60'
          }`}
        >
          {event.event_type}
        </span>
        <span className="text-sm font-medium text-slate-700 truncate group-hover:text-slate-900 transition-colors">
          {event.description || 'No description provided'}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0 text-xs text-slate-500 font-medium">
        {daysLabel && isBirthday && (
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
              isWithin30
                ? 'bg-rose-100 text-rose-700 border-rose-200 shadow-2xs'
                : 'bg-slate-100 text-slate-600 border-slate-200 shadow-2xs'
            }`}
          >
            {daysLabel}
          </span>
        )}
        <span className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-slate-200/60 shadow-2xs">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          {event.next_occurrence || event.event_date || '—'}
        </span>
        {event.amount != null && (
          <span className="font-semibold text-slate-700 bg-white px-2 py-1 rounded-md border border-slate-200/60 shadow-2xs">
            ${event.amount}
          </span>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(event.id);
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.li>
  );
}

function NoteRow({
  note,
  onDelete,
}: {
  note: Note;
  onDelete?: (id: string) => void;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, height: 0, marginBottom: 0, padding: 0 }}
      transition={{ duration: 0.2 }}
      className="group p-3.5 bg-slate-50/80 hover:bg-slate-50 border border-slate-200/70 hover:border-slate-300 rounded-xl flex justify-between items-start gap-3 transition-colors shadow-2xs overflow-hidden"
    >
      <p className="text-sm text-slate-800 leading-relaxed break-words flex-1">
        {note.content}
      </p>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 whitespace-nowrap bg-white px-2 py-0.5 rounded-md border border-slate-200/60">
          <Clock className="w-3 h-3" />
          <span>{new Date(note.created_at).toLocaleDateString()}</span>
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(note.id);
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.li>
  );
}

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: (task: Task) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, height: 0, marginBottom: 0, padding: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => onToggle(task)}
      className={`group p-3 border rounded-xl flex items-center gap-3 transition-all cursor-pointer shadow-2xs overflow-hidden ${
        task.is_done
          ? 'bg-slate-50/50 border-slate-200/50 opacity-75'
          : 'bg-white hover:bg-slate-50/80 border-slate-200/80 hover:border-slate-300'
      }`}
    >
      <div
        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
          task.is_done
            ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
            : 'border-slate-300 bg-white group-hover:border-emerald-500'
        }`}
      >
        {task.is_done && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </motion.div>
        )}
      </div>

      <span
        className={`text-sm flex-1 transition-all ${
          task.is_done
            ? 'line-through text-slate-400 font-normal'
            : 'text-slate-800 font-medium group-hover:text-slate-900'
        }`}
      >
        {task.title}
      </span>

      {task.due_date && (
        <span
          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border font-medium ${
            task.is_done
              ? 'bg-slate-100 text-slate-400 border-slate-200/50'
              : 'bg-slate-50 text-slate-500 border-slate-200/80 group-hover:border-slate-300'
          }`}
        >
          <Calendar className="w-3 h-3 text-slate-400" />
          {task.due_date}
        </span>
      )}

      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.li>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-200 rounded-xl" />
              <div className="space-y-1.5">
                <div className="w-28 h-4 bg-slate-200 rounded" />
                <div className="w-40 h-3 bg-slate-100 rounded" />
              </div>
            </div>
            <div className="w-6 h-4 bg-slate-200 rounded-full" />
          </div>

          <div className="space-y-2.5 pt-2">
            <div className="w-full h-11 bg-slate-100 rounded-xl" />
            <div className="w-full h-11 bg-slate-100 rounded-xl" />
            <div className="w-full h-11 bg-slate-100 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
