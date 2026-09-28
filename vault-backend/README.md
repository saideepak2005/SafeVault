# Vault backend - setup guide

This is Day 1 of the 3-day plan: Supabase project, upload pipeline, classification,
storage, embeddings. Chat and dashboard endpoints are already wired up too, since
they share the same data these route through.

## 1. Create the Supabase project (5 min)

1. Go to supabase.com -> New project. Pick any region, set a DB password (save it).
2. Wait for it to finish provisioning.
3. Left sidebar -> SQL Editor -> New query -> paste the entire contents of
   `src/db/schema.sql` -> Run. This creates every table, enables pgvector, turns
   on RLS, and creates the `match_chunks` search function.
4. Left sidebar -> Storage -> New bucket -> name it exactly `files` -> **uncheck** "Public bucket" -> Create.
5. Left sidebar -> Settings -> API. Copy:
   - "Project URL" -> this is `SUPABASE_URL`
   - "anon public" key -> this is `SUPABASE_ANON_KEY`

## 2. Get your Gemini API key (2 min)

1. Go to aistudio.google.com -> Get API key -> Create API key. Copy it -> `GEMINI_API_KEY`.
2. **Important**: in the Google Cloud project behind that key, link a billing
   account (Console -> Billing). This does not start charging you unless you
   exceed the free quota - it just raises your free rate limit dramatically,
   which is the single biggest thing standing between you and a rate-limit
   error during your demo.
3. The `.env.example` already has the correct current model IDs
   (`gemini-2.5-flash-lite`, `text-embedding-004`). If either ever returns a
   404, check https://ai.google.dev/gemini-api/docs/models for the replacement.

## 3. Get your Groq key (fallback LLM, optional but recommended - 1 min)

1. console.groq.com/keys -> Create API key -> `GROQ_API_KEY`.
2. No card required for the free tier.

## 4. Configure and install

```bash
cp .env.example .env
# now fill in SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY, GROQ_API_KEY

npm install
npm run dev
```

You should see: `Vault backend listening on port 4000`

## 5. Get a test JWT (so you can call the protected routes)

The backend expects `Authorization: Bearer <supabase_access_token>` on every
request. Easiest way to get one for testing, using Supabase's REST auth API directly:

```bash
# sign up a test user (replace with your project values)
curl -X POST 'https://YOUR_PROJECT.supabase.co/auth/v1/signup' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

The response JSON has `access_token` - copy that value. Use it as `<TOKEN>` below.
(If your Supabase project has email confirmation on, either turn it off for
testing in Authentication -> Providers -> Email, or use the confirmation link
from the Auth logs.)

## 6. Test each endpoint

```bash
TOKEN="paste your access_token here"

# Upload a file
curl -X POST http://localhost:4000/api/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/some.pdf"

# Ask the chatbot
curl -X POST http://localhost:4000/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "When does my insurance renew?"}'

# Load the dashboard
curl http://localhost:4000/api/dashboard -H "Authorization: Bearer $TOKEN"

# Add a manual note / task
curl -X POST http://localhost:4000/api/dashboard/notes \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"content": "Remember to renew my library card"}'

curl -X POST http://localhost:4000/api/dashboard/tasks \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title": "Submit assignment", "due_date": "2026-10-01"}'
```

## What to verify actually worked (don't skip this)

1. In Supabase -> Table Editor -> `files`: your uploaded file's row exists with
   the right `category`.
2. -> `chunks`: has rows with a non-null `embedding` column.
3. -> `extracted_events`: has rows if your test file mentioned a date/deadline.
4. The `/api/chat` response's `sources` array names the correct file you uploaded.
5. Sign up a **second** test user, upload a different file, and confirm
   `/api/dashboard` for user A never shows user B's data. This is RLS actually
   working - test it, don't just trust it.

## What's deliberately not built yet (by design, not oversight)

- **Frontend** - this is API-only right now. Next step.
- **Cloudflare R2** - only wire this up if you actually upload a file over 50MB
  during testing. `storageService.js` already has the routing logic in place;
  you'd only need to install `@aws-sdk/client-s3` and fill in the R2 env vars.
- **Reranking** - the retrieval works without it; add a cross-encoder later if
  you have time and want to squeeze out more accuracy.
- **Keep-alive ping** - add a GitHub Actions cron hitting `/health` every few
  days once you're past your deadline, so Supabase doesn't auto-pause between
  uses.

## Deploying to Render

1. Push this folder to a GitHub repo.
2. render.com -> New -> Web Service -> connect the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Add all the same variables from your `.env` in Render's Environment tab.
5. Deploy. First request after any idle period takes 30-60s (free tier cold start) - expected, not a bug.
