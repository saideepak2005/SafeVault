import { supabase } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}` };
}

// ── Upload ──────────────────────────────────────────────────────────────────
export async function uploadFile(file: File) {
  const headers = await authHeaders();
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    headers, // no Content-Type — browser sets multipart boundary automatically
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || 'Upload failed');
  }
  return res.json() as Promise<{
    file: {
      id: string;
      file_name: string;
      category: string;
      subcategory: string | null;
      mime_type: string;
      file_size: number;
      storage_provider: string;
      storage_path: string;
      created_at: string;
    };
    extractedEvents: Array<{
      event_type: string;
      event_date: string | null;
      description: string | null;
      amount: number | null;
    }>;
  }>;
}

// ── Chat ────────────────────────────────────────────────────────────────────
export async function sendChatMessage(question: string, category?: string) {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, category: category || undefined }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || 'Chat failed');
  }
  return res.json() as Promise<{
    answer: string;
    provider: string | null;
    sources: Array<{
      fileId: string;
      fileName: string;
      similarity: number;
    }>;
  }>;
}

// ── Dashboard ───────────────────────────────────────────────────────────────
export interface DashboardEvent {
  id: string;
  file_id: string;
  event_type: string;
  event_date: string | null;
  description: string | null;
  amount: number | null;
}

export interface Note {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  is_done: boolean;
  due_date: string | null;
  created_at: string;
}

export interface DashboardData {
  alerts: DashboardEvent[];
  birthdays: DashboardEvent[];
  notes: Note[];
  tasks: Task[];
}

export async function fetchDashboard(): Promise<DashboardData> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/api/dashboard`, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || 'Dashboard fetch failed');
  }
  return res.json();
}

export async function addNote(content: string): Promise<Note> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/api/dashboard/notes`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || 'Add note failed');
  }
  return res.json();
}

export async function addTask(title: string, due_date?: string): Promise<Task> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/api/dashboard/tasks`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, due_date: due_date || undefined }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || 'Add task failed');
  }
  return res.json();
}

export async function toggleTask(id: string, is_done: boolean): Promise<Task> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/api/dashboard/tasks/${id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_done }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || 'Toggle task failed');
  }
  return res.json();
}
