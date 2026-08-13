# Linguafy — English Trainer

Hi, Hardik Here,Full-stack English-learning app: React + Vite frontend, Express API, Groq feedback, and an optional Supabase production database/auth layer.

---

## Important links & info

| What | Where |
|------|-------|
| **Live app (frontend)** | https://linguafy.vercel.app/ |
| **Live API (backend)** | https://linguafy-backend.vercel.app/ |
| **API health check** | https://linguafy-backend.vercel.app/health |
| **GitHub repo** | https://github.com/Hardik2811-wq/Linguafy |
| **API reference** | See the [backend routes](AboutProject.md#5-backend--routes-api) in `AboutProject.md` |

### Where things are configured

| Item | Location |
|------|----------|
| Backend port, Supabase + Groq keys, allowed frontend origin | `backend/.env` (copy from `backend/.env.example`, **never commit it**) |
| Frontend API URL | `src/api.js` uses `VITE_API_URL` (defaults to `http://localhost:4000`) |
| Database schema | `supabase/schema.sql` |
| Seed data (drills + words) | `supabase/seed.sql` |

> Set `VITE_API_URL=https://linguafy-backend.vercel.app` if you want the local
> frontend to talk to the hosted backend instead of your local API.

### Test user

Use this account to try the live app without signing up:

| | |
|---|---|
| Email | `test@dev.com` |
| Password | `123!@#qwe` |

> This is a shared dummy account for testing only — don't use it for real data.

## Run locally

In one terminal, start the API:

```bash
cd backend
npm install
npm run dev
```

In another terminal, start the web app:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Create an account, then use Writing, Grammar, Vocabulary, Exam Prep, and Roleplay.

## Configuration

`backend/.env` contains server-only settings and is ignored by Git. Groq is configured there. With no Supabase variables the app runs in local development mode: accounts and progress exist for the current API session so every learning flow can be tested.

For persistent production users, create a Supabase project, run [supabase/schema.sql](supabase/schema.sql) and [supabase/seed.sql](supabase/seed.sql), then add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to `backend/.env` (see `backend/.env.example`). Never put those secrets or the Groq key in Vite environment variables.

## How to update the frontend via git push (simple steps)

The live site (`https://linguafy.vercel.app/`) is linked to the GitHub repo. It
updates automatically when you push to `main` — **no manual upload needed**.

### Step 1 — Prepare the frontend `.env.local` file

In the **project root** (the frontend folder), create a file called `.env.local`:

```
VITE_API_URL=https://linguafy-backend.vercel.app
```

Replace `https://linguafy-backend.vercel.app` with your actual backend URL
(see "Important links" above).

- **Why:** this is the local version of the API URL, used by `src/api.js`.
- **Do NOT commit this file** — it's local-only and already ignored by Git
  (`.gitignore` ignores `.env`; `.env.local` behaves the same way).
- **For the live site:** because `.env.local` never reaches Vercel, you must
  also add `VITE_API_URL` as an Environment Variable in the Vercel dashboard
  (project → **Settings → Environment Variables**, key `VITE_API_URL`, value
  the same backend URL). This gets baked into the production build.

### Step 2 — Make your changes

Edit the frontend files, then test locally:

```bash
npm run dev
```

### Step 3 — Build locally first (catches errors)

```bash
npm run build
```

If this fails, fix the errors before pushing. A failing build is the #1 reason
Vercel keeps showing the old version.

### Step 4 — Commit and push to `main`

```bash
git add .
git commit -m "Describe your change"
git push origin main
```

### Step 5 — Vercel auto-deploys

1. Vercel sees the push, runs `npm run build`, and deploys automatically.
2. Wait 1–2 minutes, then open `https://linguafy.vercel.app/`.
3. Still see the old version? **Hard-refresh** your browser to skip the cache:
   - Windows: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

Check these, in order:

1. **Is the push really on `main`?** Run `git log --oneline -3` and `git status`.
   If you pushed to a `feature/*` branch instead, nothing deploys.

2. **Did the deploy succeed?** Open the **Deployments** tab in the Vercel project
   dashboard (vercel.com → your project → Deployments). A red ❌ or "Error"
   means the build failed and Vercel keeps the last good version. Click the
   failed build to see the error log.

3. **Is the Vercel project connected to this repo and branch?**
   Dashboard → **Settings → Git** — the connected repo must be
   `Hardik2811-wq/Linguafy` and the production branch must be `main`.

4. **Are the build settings correct?** Dashboard → **Settings → Build & Deployment**:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   (Vercel usually detects these automatically, but double-check if it was set up manually.)

5. **Force a manual redeploy** (quickest fix when the build is fine but nothing
   updated): In the Deployments tab, find the latest commit, click the `⋯` menu,
   and choose **Redeploy**.

6. **Is `VITE_API_URL` set in Vercel?** If the site loads but calls the wrong
   backend, check the Environment Variables (see Step 1). After changing an
   environment variable, trigger a **Redeploy** — it does not apply to an old
   build.

> Note: the web UI and the API are **two separate Vercel projects**:
> - **Frontend** → `linguafy.vercel.app` (from the repo root)
> - **Backend** → `linguafy-backend.vercel.app` (from the `backend/` folder)
>
> Updating one does not change the other — each deploys independently from its
> own folder. The live frontend must be pointed at the live backend, so check
> the `VITE_API_URL` used when the frontend was built.
