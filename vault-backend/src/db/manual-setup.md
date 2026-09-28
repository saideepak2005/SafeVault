# Manual Supabase Setup

Do these steps **once**, in order, before starting the backend.

---

## 1. Create the "files" Storage Bucket

1. Open your Supabase project → **Storage** (left sidebar).
2. Click **New bucket**.
3. Name: `files`
4. **Public bucket**: leave **unchecked** (Private).
5. Click **Save**.

> **Why private?** Files are served only via short-lived signed URLs scoped to each authenticated user. A public bucket would let anyone with a path guess read any file.

---

## 2. Run the Storage Row Level Security Policies

Open **SQL Editor → New query**, paste the entire block below, and click **Run**.

```sql
-- Drop any previously created broad/generic storage policies
-- (run even if they don't exist — the IF EXISTS makes it safe)
drop policy if exists "Allow authenticated uploads" on storage.objects;
drop policy if exists "Allow authenticated reads" on storage.objects;
drop policy if exists "Give users access to own folder" on storage.objects;
drop policy if exists "authenticated users can upload" on storage.objects;
drop policy if exists "authenticated users can read" on storage.objects;

-- Users may upload only into their own folder: files/<their_user_id>/...
create policy "users upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users may read only their own files
create policy "users read own folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

> **Important:** Run this AFTER creating the bucket in step 1, or the policies will error because the bucket doesn't exist yet.

---

## 3. Verify

After running the SQL:

- In **Storage → files → Policies**, you should see two policies:
  - `users upload own folder` (INSERT)
  - `users read own folder` (SELECT)

That's all the manual work. The rest of the schema (tables, RLS, pgvector function) is already in `src/db/schema.sql` and was applied when you ran that file.
