-- Run this whole file once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

-- 1. Enable pgvector
create extension if not exists vector;

-- 2. Files: one row per uploaded file (metadata only - the bytes live in Storage/R2)
create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  mime_type text,
  file_size bigint,
  storage_provider text not null check (storage_provider in ('supabase', 'r2')),
  storage_path text not null,
  category text not null check (
    category in ('Documents', 'Personal', 'Health', 'Finance', 'Education', 'Work', 'Subscriptions', 'Others')
  ),
  subcategory text,
  created_at timestamptz not null default now()
);

-- 3. Chunks: chunked text + embedding, one row per chunk, linked to its file
create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references files(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  content text not null,
  embedding vector(768), -- must match GEMINI_EMBEDDING_DIMS in .env
  created_at timestamptz not null default now()
);

-- 4. Extracted events: structured facts pulled out at upload time - powers the dashboard
create table if not exists extracted_events (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references files(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (
    event_type in ('expiry', 'renewal', 'due_date', 'birthday', 'amount', 'other')
  ),
  event_date date,
  description text,
  amount numeric,
  created_at timestamptz not null default now()
);

-- 5. Notes and tasks: manually added by the user, shown on the dashboard alongside extracted_events
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  due_date date,
  created_at timestamptz not null default now()
);

-- 6. Row Level Security - do this even for a college project. This is what makes
-- cross-user data leaks structurally impossible, even if your backend code has a bug.
alter table files enable row level security;
alter table chunks enable row level security;
alter table extracted_events enable row level security;
alter table notes enable row level security;
alter table tasks enable row level security;

drop policy if exists "own_files" on files;
create policy "own_files" on files for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own_chunks" on chunks;
create policy "own_chunks" on chunks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own_events" on extracted_events;
create policy "own_events" on extracted_events for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own_notes" on notes;
create policy "own_notes" on notes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own_tasks" on tasks;
create policy "own_tasks" on tasks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 7. Filtered hybrid search: metadata filter (user + category) FIRST, then vector similarity.
-- This single function is what makes retrieval accurate instead of naive whole-collection search.
create or replace function match_chunks(
  query_embedding vector(768),
  match_user_id uuid,
  match_category text default null,
  match_count int default 5
)
returns table (
  id uuid,
  file_id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    c.id,
    c.file_id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where c.user_id = match_user_id
    and (match_category is null or c.category = match_category)
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- 8. Storage bucket for files under the 50MB free-tier cap.
-- Create this in Dashboard -> Storage -> New bucket -> name it "files" -> set Private (not public).
-- IMPORTANT: do NOT run INSERT into storage.buckets - Supabase blocks it. Create via the dashboard.
-- See src/db/manual-setup.md for step-by-step instructions.

-- 9. Storage Row Level Security - run AFTER creating the "files" bucket in the dashboard.
-- These policies enforce per-user folder isolation: files/<user_id>/<uuid>.<ext>

-- Drop any old/broader policies that might have been applied before
drop policy if exists "Allow authenticated uploads" on storage.objects;
drop policy if exists "Allow authenticated reads" on storage.objects;
drop policy if exists "Give users access to own folder" on storage.objects;
drop policy if exists "authenticated users can upload" on storage.objects;
drop policy if exists "authenticated users can read" on storage.objects;

create policy "users upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users read own folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
