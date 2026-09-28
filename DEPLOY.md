# Deployment Guide — Single Monorepo (Render Backend + Vercel Frontend)

This guide assumes your single GitHub repository contains both `vault-backend/` and `vault-frontend/` folders.

> **Prerequisite:** Complete [`src/db/manual-setup.md`](file:///s:/projects/supabase/vault-backend/src/db/manual-setup.md) (Supabase private `files` bucket + RLS policies) before deploying.

---

## 1. Push Your Monorepo to GitHub

From the project root:

```bash
git init
git add .
git commit -m "feat: complete personal vault ai setup"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/personal-vault.git
git push -u origin main
```

---

## 2. Deploy Backend → Render (Web Service)

1. Sign in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Web Service**.
3. Connect your GitHub account and select your repository (`personal-vault`).
4. Configure the service settings:
   - **Name:** `vault-backend` (or your choice)
   - **Language:** `Node`
   - **Branch:** `main`
   - **Root Directory:** `vault-backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
5. Click **Advanced** and set the **Health Check Path** to: `/health`
6. Under **Environment Variables**, add:

| Variable | Value | Notes |
|:---|:---|:---|
| `PORT` | `4000` | Port Express listens on |
| `NODE_ENV` | `production` | Production mode |
| `SUPABASE_URL` | `https://<your-project>.supabase.co` | From Supabase Project Settings → API |
| `SUPABASE_ANON_KEY` | `<your-anon-publishable-key>` | From Supabase Project Settings → API |
| `GEMINI_API_KEY` | `<your-gemini-api-key>` | Google AI Studio API key |
| `GEMINI_CHAT_MODEL` | `gemini-3.5-flash-lite` | Default LLM chat model |
| `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-001` | Deprecation-safe embedding model |
| `GEMINI_EMBEDDING_DIMS` | `768` | Matches schema `vector(768)` column |
| `GROQ_API_KEY` | `<your-groq-api-key>` | (Optional) Fallback LLM on rate limits |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | (Optional) Fallback model ID |
| `MAX_SUPABASE_FILE_BYTES` | `52428800` | 50 MB Supabase free storage cap |
| `FRONTEND_ORIGIN` | *(leave empty for now)* | Fill in after Vercel deployment |

7. Click **Create Web Service**.
8. Once built and live, copy your Render URL (e.g. `https://vault-backend-xxxx.onrender.com`).

---

## 3. Deploy Frontend → Vercel

1. Sign in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** → **Project**.
3. Import your GitHub repository (`personal-vault`).
4. In the project configuration:
   - **Framework Preset:** `Next.js`
   - **Root Directory:** Click **Edit** → select `vault-frontend` → click **Continue**.
   - **Build Command:** `next build` (default)
   - **Output Directory:** `.next` (default)
   - **Install Command:** `npm install` (default)
5. Expand **Environment Variables** and add:

| Variable | Value | Notes |
|:---|:---|:---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<your-project>.supabase.co` | Same as backend |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<your-anon-publishable-key>` | Same as backend |
| `NEXT_PUBLIC_API_URL` | `https://vault-backend-xxxx.onrender.com` | Your Render backend URL |

6. Click **Deploy**.
7. Once deployed, copy your production Vercel URL (e.g. `https://personal-vault-xxxx.vercel.app`).

---

## 4. Link Frontend Origin to Backend (CORS)

1. Return to [Render Dashboard](https://dashboard.render.com) → your `vault-backend` service.
2. Go to the **Environment** tab.
3. Edit `FRONTEND_ORIGIN` and paste your Vercel URL:
   ```
   FRONTEND_ORIGIN=https://personal-vault-xxxx.vercel.app
   ```
4. Click **Save Changes**. Render will automatically redeploy with the allowed CORS origin.

---

## 5. Verification Checklist

1. **Backend Health Check:**
   ```bash
   curl https://vault-backend-xxxx.onrender.com/health
   # Returns: {"status":"ok"}
   ```
2. **Frontend Walkthrough:**
   - Open `https://personal-vault-xxxx.vercel.app`
   - Sign up with a fresh email and password.
   - Upload a test document from the dashboard.
   - Test chat and dashboard event/note/task updates.
