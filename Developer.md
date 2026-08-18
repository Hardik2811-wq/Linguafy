# Developer.md — Linguafy English Trainer

Technical reference for developers working on this project. It describes the
**current** state of the codebase (full-stack: React + Vite frontend, Express
API, Groq AI, optional Supabase database).

> Read this alongside:
> - `AboutProject.md` — shorter, product-focused guide (what each module does).
> - `Linguafy_Development_Plan_V2.md` — the 8-week plan that was actually
>   executed to build the backend. Mostly historical now, but useful for
>   context and the "Next Steps (Post-MVP)" section.
> - `English_Learning_App_Development_Plan.md` — the original product/architecture
>   blueprint (superseded by V2 for backend decisions).
> - `README.md` — run guide + deployment steps for the live site.
> - `GitWorkFlow.md` — how to branch, PR, and merge.
> - `CODE_AUDIT_REPORT.md` — 19-item forensic audit (security, correctness,
>   UI, tooling) produced against the running app; the basis for the
>   `audit_work/` artefacts.

---

## 1. Project Overview

**What this project is**

Linguafy is a full-stack English-learning web app. Users sign up/log in, then
practice six modules and receive AI-style feedback powered by **Groq**. Their
progress is saved to **PostgreSQL** via **Supabase** (or held in memory when
running without a database).

**Modules**

1. **Dashboard (Overview)** — live stats pulled from saved activity + diagnostic test summary.
2. **Placement test (Adaptive CPV)** — 30-question adaptive diagnostic covering all 15 grammar topics ($15 \times 2 = 30$), pace analysis, confidence scoring, interactive heatmap, and instant CEFR level assessment.
3. **Writing studio** — text + context → Groq grammar/tone/vocabulary feedback.
4. **Grammar lab** — random drill from a question bank, instant answer checking.
5. **Vocabulary** — word of the day + AI-validated sentence writing.
6. **Exam prep (IELTS)** — real 40-minute timer + Groq band scoring.
7. **Roleplay / conversation** — multi-turn chat with an AI interview partner.

**What the project is NOT (yet)**

- There is **no URL router** — view switching is pure `useState` in `<App>`
  (refresh always lands on Overview).
- **No automated tests, linter, or CI** are configured.
- The **whole frontend still lives in one file** (`src/main.jsx`). The planned
  split into `components/` + `pages/` (see §9) has not happened yet.
- `language_level` (A1–C2) is calibrated and assigned automatically upon completing the Placement Test.

**Tech stack (as implemented)**

| Layer        | Choice                                                        |
|--------------|---------------------------------------------------------------|
| Frontend     | React 19 (latest) via JSX, no TypeScript, Vite (latest)       |
| Styling      | Hand-written CSS: `src/styles.css` + `src/auth.css`           |
| Icons        | `lucide-react`                                                |
| API client   | `src/api.js` (fetch wrapper, `VITE_API_URL`)                  |
| Backend      | Node.js + Express (ESM) in `backend/`                         |
| Validation   | `zod`                                                         |
| AI           | `groq-sdk` (JSON mode, `llama-3.3-70b-versatile`)             |
| Database     | PostgreSQL via `@supabase/supabase-js` (optional)             |
| Auth         | Supabase Auth (JWT) in prod; in-memory tokens in local mode   |
| Hosting      | Vercel — frontend + backend as two separate projects          |

---

## 2. Repository Structure

```
English Trainer/
├── index.html                        # HTML shell; mounts the React app
├── package.json                      # frontend name, scripts, dependencies
├── package-lock.json                 # generated lockfile (do not edit)
├── .gitignore                        # node_modules, dist, .env, .env.local
├── .env.local                        # LOCAL ONLY: VITE_API_URL (never commit)
│                                       (no vite.config file — Vite defaults)
├── README.md                         # run guide + Vercel deployment steps
├── AboutProject.md                   # product guide: modules, API, schema
├── CODE_AUDIT_REPORT.md              # 19-item forensic code audit (2026-08-12)
├── Developer.md                      # this file
├── English_Learning_App_Development_Plan.md   # original product blueprint
├── Linguafy_Development_Plan_V2.md            # executed 8-week build plan
├── GitWorkFlow.md                    # branch/PR/merge guide
├── linguafy_upload.zip               # committed: old dist/ build (archived)
├── linguafy-brand-assets.zip         # committed: favicon + app icon PNGs
├── audit_work/                       # audit builder + artefacts (see §6.6)
│   ├── package.json                  # exceljs (only dependency)
│   ├── build_audit.mjs               # WIP generator — imports non-existent pkg; broken
│   ├── make_xlsx.mjs                 # working generator (exceljs) → outputs/
│   └── outputs/20260812-linguafy-audit/
│       ├── linguafy-code-audit.xlsx  # 5-sheet Excel report (Dashboard, Findings,
│       │                             #   Fix Roadmap, Verified Working, DB Checks)
│       └── findings.json             # machine-readable copy of the 19 findings
├── scripts/
│   ├── push_to_github.ps1            # helper: stage, commit, rebase, push
│   └── test_placement.mjs            # diagnostic test: simulates 30-Q adaptive placement test
├── supabase/
│   ├── schema.sql                    # DB schema (run in Supabase SQL editor; includes placement tables)
│   └── seed.sql                      # 3 grammar drills + 3 vocabulary words
├── src/
│   ├── main.jsx                      # ENTIRE frontend (components + render, including PlacementTest)
│   ├── api.js                        # fetch wrapper, token/session helpers
│   ├── styles.css                    # all app styling
│   ├── auth.css                      # auth page + exam result styles
│   ├── insights.css                  # profile learning insights
│   └── placement.css                 # 4-phase placement test styles (welcome, countdown, test, results)
├── backend/                          # Express API (separate Vercel project)
│   ├── package.json                  # express, cors, dotenv, zod, groq-sdk, supabase-js
│   ├── package-lock.json             # generated lockfile (do not edit)
│   ├── .env                          # non-secret config (PORT, FRONTEND_ORIGIN, GROQ_MODEL)
│   ├── .env.example                  # template for backend/.env
│   ├── .env.local                    # LOCAL ONLY: secrets (GROQ_API_KEY) — never commit
│   └── src/
│       ├── index.js                  # app bootstrap, CORS, route mounting
│       ├── config.js                 # env parsing, normalizeOrigin, isSupabaseConfigured
│       ├── data/
│       │   └── placement_questions.json # 400 CPV questions (134 C, 133 P, 133 V across 15 topics)
│       ├── middleware/
│       │   ├── auth.js               # requireAuth (JWT or local token)
│       │   └── errors.js             # notFound + errorHandler
│       ├── routes/
│       │   ├── auth.js               # signup / login / me
│       │   ├── placement.js          # POST /api/placement/start, /submit-answer, GET /latest
│       │   ├── writing.js            # POST /api/feedback/analyze-text
│       │   ├── grammar.js            # GET /api/drills/grammar, POST /api/feedback/grammar-drill
│       │   ├── vocabulary.js         # GET /api/vocabulary/daily, POST /api/feedback/vocabulary-check
│       │   ├── exam.js               # POST /api/exam/submit
│       │   ├── conversation.js       # POST /api/conversation/send
│       │   └── dashboard.js          # GET /api/user/progress
│       └── services/
│           ├── placement.js          # 30-from-400 adaptive engine, 15-topic balancer, CEFR scorer
│           ├── groq.js               # Groq JSON completions (4 task prompts)
│           ├── supabase.js           # admin + public client factories, dbError
│           └── local.js              # in-memory "local mode" fallback storage
├── dist/                             # production build output (generated)
└── node_modules/                     # installed deps (generated)
```

---

## 3. Configuration & Environment Variables

There are **three** env-file locations. Know which is which:

| File                 | Holds                                        | Used by     | Committed? |
|----------------------|----------------------------------------------|-------------|------------|
| `backend/.env`       | `PORT`, `FRONTEND_ORIGIN`, `GROQ_MODEL`      | backend     | no (gitignored) |
| `backend/.env.local` | secrets — `GROQ_API_KEY` (+ Supabase keys)   | backend     | **never** |
| `.env.local` (root)  | `VITE_API_URL`                               | frontend    | **never** |

`backend/src/config.js` loads `.env` first, then `.env.local` with `override: true`,
so `.env.local` always wins. This lets non-secret defaults live in `.env`
(trackable) while real keys stay in `.env.local`.

### Key variables

| Variable                 | Where            | Purpose                                             | Default                        |
|--------------------------|------------------|-----------------------------------------------------|--------------------------------|
| `PORT`                   | `backend/.env`   | API port                                            | `4000`                         |
| `FRONTEND_ORIGIN`        | `backend/.env`   | Comma-separated allowed CORS origins (e.g. the Vercel frontend URL) | `http://localhost:5173` |
| `ALLOW_ALL_ORIGINS`      | `backend/.env`   | `"true"` bypasses CORS allow-list (dev/testing only) | unset                          |
| `GROQ_MODEL`             | `backend/.env`   | Groq model used for all AI calls                    | `llama-3.3-70b-versatile`      |
| `GROQ_FAST_MODEL`        | `backend/.env`   | Cheaper/faster model for simple AI tasks (vocab check); falls back to `GROQ_MODEL` | `GROQ_MODEL` |
| `GROQ_API_KEY`           | `backend/.env.local` | Groq API key (required for AI feedback)          | —                              |
| `SUPABASE_URL`           | `backend/.env.local` | Supabase project URL                             | —                              |
| `SUPABASE_ANON_KEY`      | `backend/.env.local` | Public anon key (login only)                     | —                              |
| `SUPABASE_SERVICE_ROLE_KEY` | `backend/.env.local` | Service-role key (bypasses RLS — never ship to browser) | —                     |
| `VITE_API_URL`           | root `.env.local` | Backend base URL used by `src/api.js` (must also be set in Vercel) | `http://localhost:4000` |

> The backend runs in **local mode** when `SUPABASE_URL`/`SUPABASE_ANON_KEY`/
> `SUPABASE_SERVICE_ROLE_KEY` are missing, but **still needs `GROQ_API_KEY`** for
> writing/vocab/exam/conversation feedback.

---

## 4. The Two Runtime Modes

Every route checks `isSupabaseConfigured()` (all three Supabase vars present):

```
Is Supabase configured?
  ├─ YES → use real Supabase DB + Supabase Auth + Groq
  └─ NO  → "local mode": in-memory storage (services/local.js), local tokens
```

- **Local mode** (`backend/src/services/local.js`): `users` (Map), `writing`,
  `grammarAttempts`, `vocabulary`, `exams` (arrays), `conversations`
  (Map session→turns). Ships with 2 grammar drills and 2 vocabulary words so
  Grammar/Vocabulary work even without seed data. All data is **lost on restart**.
  Auth tokens are `local-<user-id>`; `requireAuth` accepts anything starting
  with `local-`.
- **Supabase mode**: real PostgreSQL tables + JWT auth. The service-role key is
  used for DB writes (bypasses RLS) and `publicAuth` for password sign-in.
- Responses include a `local_mode: true` flag so callers know which backend
  handled them.

---

## 5. Frontend

All frontend code lives in `src/`. Components are single-purpose and wired to
the backend through `src/api.js`.

### 5.1 `src/api.js` — API client & session helpers

| Export          | What it does                                                        |
|-----------------|---------------------------------------------------------------------|
| `getToken()`    | Reads `linguafy_token` from localStorage                            |
| `getStoredUser()`| Reads `linguafy_user` (JSON) from localStorage                      |
| `setSession()`  | Persists `{ token, user }` to localStorage                          |
| `clearSession()`| Removes both localStorage keys                                      |
| `api(path, opts)`| Fetch wrapper: base `VITE_API_URL` (trailing slashes stripped), JSON headers, `Authorization: Bearer <token>`, throws on non-OK. |

### 5.2 `src/main.jsx` — components

The entire component tree is in this one file. No router — `<App>` switches
views via `useState`.

| Component        | Backend wiring (current)                                           |
|------------------|--------------------------------------------------------------------|
| `App`            | Shell + view/toast state. Shows `<Auth>` until `user` is set.      |
| `Auth`           | `POST /api/auth/signup` or `/login`; on success persists session.  |
| `Sidebar`        | Nav + user + streak/upgrade UI (includes Placement Test item).      |
| `Overview`       | `GET /api/user/progress` + `GET /api/placement/latest` → fills stats, skill bars, and diagnostic level banner. |
| `PlacementTest`  | `POST /api/placement/start`, `POST /api/placement/submit-answer`, `GET /api/placement/latest`. 4-phase adaptive test flow (Welcome, 3-2-1 Countdown, 30-Q adaptive test with confidence chips, Celebratory diagnostic results with clickable 15-topic Grammar Heatmap modal). |
| `Writing`        | `POST /api/feedback/analyze-text` → maps `feedback.errors`/`alternatives` into the feedback panel. |
| `FeedbackPanel`  | Pure presentational; renders `{ score, note, issues[], alternatives[] }`. |
| `Grammar`        | `GET /api/drills/grammar` (load), `POST /api/feedback/grammar-drill` (check). Shows running `accuracy_this_pillar`. |
| `Vocabulary`     | `GET /api/vocabulary/daily`, `POST /api/feedback/vocabulary-check`. Speaker button uses browser `speechSynthesis`. |
| `Exam`           | Real countdown timer (`setInterval`, starts at 40:00), live word count, `POST /api/exam/submit` → band + per-criterion scores. |
| `Roleplay`       | `POST /api/conversation/send` with `session_id`; accumulates `grammar_notes`. |

**Dead code worth knowing about:** the `feedback` mock constant at the top of
`src/main.jsx` (lines 12–23) is no longer referenced by any component — safe to
delete. The `nav` array drives the sidebar.

### 5.3 Styling

- `src/styles.css` — single minified stylesheet: `:root` design tokens
  (`--ink`, `--violet`, `--green`, etc.), full app styling, two media queries
  (≤1000px tablet, ≤700px mobile).
- `src/auth.css` — auth page/card styles plus `.exam-result` (IELTS score card).
- `src/placement.css` — 4-phase placement test styles (welcome rules grid, countdown screen, 30-segment progress bar, category tags, confidence chips, celebratory reveal, CPV breakdown, interactive heatmap grid, and drilldown modal).
- `src/insights.css` — learning profile insights.
- Fonts: **DM Sans** (UI) + **Playfair Display** (headings) via Google Fonts `@import`.

---

## 6. Backend

### 6.1 Entry — `backend/src/index.js`

- Express app, `x-powered-by` disabled, JSON body limit 1 MB.
- **CORS**: if `ALLOW_ALL_ORIGINS=true`, allow everything (dev only). Otherwise
  allow origins from `FRONTEND_ORIGIN` (comma-separated) plus hard-coded local
  dev origins (`localhost:5173/4173` and `127.0.0.1` variants).
- Routes mounted:

```
GET  /                     service info + endpoint list
GET  /health               health check (no auth)
POST /api/auth/signup      create account
POST /api/auth/login       log in
GET  /api/auth/me          current user info
POST /api/placement/start  initialize 30-Q adaptive placement session
POST /api/placement/submit-answer submit answer + confidence rating, get next Q or final results
GET  /api/placement/latest get user's latest placement test diagnostic report
POST /api/feedback/analyze-text       writing feedback
GET  /api/drills/grammar             random grammar drill
POST /api/feedback/grammar-drill     check a drill answer
GET  /api/vocabulary/daily           word of the day
POST /api/feedback/vocabulary-check  validate a sentence
POST /api/exam/submit                score an IELTS essay
POST /api/conversation/send          AI conversation reply
GET  /api/user/progress              aggregated dashboard stats
```

- `notFound` + `errorHandler` catch everything else (JSON errors, `error.status` respected).

### 6.2 `config.js`

Parses env; exposes `config` (port, origins, keys, groq model), `requireConfig()`
(throws 503 when a needed key is missing), `isSupabaseConfigured()`.

### 6.3 Middleware

- **`auth.js`** — `requireAuth`: reads `Authorization: Bearer <token>`.
  Local mode: token must start with `local-`, looks up `local.user(id)`.
  Supabase mode: `admin().auth.getUser(token)`. Sets `req.user`; else 401.
- **`errors.js`** — `notFound` (404 JSON) and `errorHandler` (logs + JSON error).

### 6.4 Services

- **`placement.js`** — Adaptive testing and diagnostic assessment engine:
  - **400-Question CPV Bank**: Loads from `backend/src/data/placement_questions.json` (134 Conversation `C`, 133 Passage `P`, 133 Vocabulary `V`).
  - **Guaranteed 15-Topic Full Coverage**: The selection algorithm enforces that across the 30 questions, **every single one of the 15 grammar topics is tested exactly 2 times ($15 \times 2 = 30$)**, with no topic missed (0 Qs) or over-sampled.
  - **Adaptive Difficulty Targeting**: Uses running `abilityScore` mapped to continuous target difficulty (`±0.10`).
  - **Confidence-Weighted Scoring**: Evaluates answers with user confidence (*Certain*, *Fairly Sure*, *Not Sure*), shifting ability score from `-3` to `+3`.
  - **Pacing Engine**: Real-time pace evaluation (`on_pace`, `slow`, `very_slow`) based on category time bands (C: 15-40s, V: 10-35s, P: 45-120s).
  - **Diagnostic Report Generator**: Generates 15-topic grammar heatmap (with drilldown review of each answered question), CPV sub-scores, Champion vs Growth zones, CEFR level assignment (A1–C2), and custom course recommendations.
- **`groq.js`** — lazy `Groq` client (throws 503 if no key). `jsonCompletion`
  uses `response_format: { type: 'json_object' }`, temp 0.2; JSON.parse failures
  become a friendly 502. Writing/vocab/exam results are cached in an in-memory
  `Map` (FIFO, 300 entries) keyed by `task|input`, so identical re-submissions
  skip the API. `checkVocabulary` runs on `GROQ_FAST_MODEL`; the rest use
  `GROQ_MODEL`.
- **`supabase.js`** — `admin()` (service-role client), `publicAuth()` (anon client),
  `dbError(result)` (throws 502 on Supabase errors).
- **`local.js`** — in-memory store for local mode + placement attempts + user level updater.

### 6.5 Routes

| File              | Endpoint(s)                                | Notes |
|-------------------|--------------------------------------------|-------|
| `auth.js`         | signup / login / me                        | signup validates level A1–C2, creates Supabase auth user + profile row, then signs in to return a JWT. Login returns profile from `users` table. |
| `placement.js`    | `/start`, `/submit-answer`, `/latest`      | Starts session, delivers sanitized questions (no spoilers), evaluates confidence scoring, generates deep diagnostic report, updates user level. |
| `writing.js`      | `POST /feedback/analyze-text`              | zod: 8–2000 chars. Score = avg of grammar/tone/vocabulary breakdown. Inserts `writing_submissions`. |
| `grammar.js`      | `GET /drills/grammar`, `POST /feedback/grammar-drill` | Random drill (optional `?pillar=`); answer checked against `correct_answer`, attempt saved, per-pillar accuracy returned. |
| `vocabulary.js`   | `GET /vocabulary/daily`, `POST /feedback/vocabulary-check` | Daily word chosen by day-index over all words. Sentence first pre-checked locally for the target word — if absent, returns "you haven't used the word" without calling Groq. Otherwise AI-checked; upserts `vocabulary_progress`; "mastered" after 3 correct uses. |
| `exam.js`         | `POST /exam/submit`                        | zod: ≥150 chars. Groq band scoring; inserts `exam_attempts`. |
| `conversation.js` | `POST /conversation/send`                  | Creates session on first turn (or reuses `session_id`), stores all turns but only the last 6 are sent to Groq each turn, stores turn + grammar notes. |
| `dashboard.js`    | `GET /user/progress`                       | Aggregates writing/grammar/vocab/exam/conversation per user into `this_week` stats + `weak_areas` + `recommendations`. |

### 6.6 `audit_work/` — code audit builder

Separate throwaway Node project (its own `package.json`, only dep is `exceljs`).
Generates the 19-finding audit report from `CODE_AUDIT_REPORT.md`.

---

## 7. Database Design (Supabase)

Schema lives in `supabase/schema.sql` (run the whole file in the Supabase SQL
editor). Every table references `users` back to `auth.users`.

```
users
├── id (uuid, PK → auth.users)
├── email (unique), name
├── language_level (A1–C2, calibrated via placement test)

placement_questions          (400-question bank)
├── id, external_id (unique), category (C, P, V)
├── grammar_topic (15 topics), vocab_tier (tier1, tier2)
├── estimated_difficulty (0.0-1.0), cefr_reference (A1-C2)
├── question, passage, options (jsonb), explanation, expected_time_seconds

placement_attempts
├── id, user_id → users, started_at, completed_at
├── ability_score, final_level (A1-C2), cpv_scores (jsonb)
├── grammar_heatmap (jsonb), vocab_tier_reached, category_counts (jsonb), is_completed

placement_responses
├── id, attempt_id → placement_attempts, question_id → placement_questions
├── user_answer, is_correct, confidence (certain, fairly_sure, not_sure)
├── time_taken_seconds, pace_signal, score_movement (-3 to +3), ability_score_after

writing_submissions
├── user_id → users
├── text, context, errors (jsonb), suggestions (jsonb)
├── tone_assessment, vocabulary_alternatives (jsonb), score (0–100), score_breakdown (jsonb)

grammar_drills               (question bank, no user id)
├── id (bigint identity), pillar, question_text, options (jsonb)
├── correct_answer, explanation, difficulty (1–5)

grammar_attempts
├── user_id → users, drill_id → grammar_drills
├── user_answer, correct, confidence, awarded_points, time_spent_seconds

vocabulary_words            (word bank, no user id)
├── id, word (unique), definition, context_sentence, context_examples (jsonb), difficulty (1–5), category

vocabulary_progress
├── user_id, word_id (unique pair)
├── user_sentence, correct, score (1–10), attempts, mastered, last_attempt, next_review

exam_attempts
├── user_id → users, exam_type, task_type, essay_text, word_count
├── task_achievement, coherence_cohesion, lexical_resource, grammatical_accuracy, band_estimate (0–9 scale), feedback (jsonb)

conversation_sessions
├── user_id → users, scenario, created_at, ended_at

conversation_turns
├── session_id → conversation_sessions, user_message, bot_response, grammar_notes (jsonb), turn_number
```

- Seed data is in `supabase/seed.sql`: **3 grammar drills** (subject-verb
  agreement, subjunctive, inversion) and **3 vocabulary words** (meticulous,
  ephemeral, articulate).
- **RLS is enabled on all tables** — the backend uses the service-role key which
  bypasses RLS, so that key must never reach the browser.
- Key `user_id` columns are indexed (`idx_writing_user`, `idx_grammar_user`, …).

---

## 8. How a Request Flows (one example)

Writing "Get feedback":

1. `Writing` component calls `api('/api/feedback/analyze-text', { method: 'POST', body: { text, context } })`.
2. `requireAuth` verifies the JWT (Supabase) or `local-` token → sets `req.user`.
3. `zod` validates (8–2000 chars) — 400 otherwise.
4. `services/groq.js` asks Groq (JSON mode) for errors/suggestions/tone/alternatives/score_breakdown.
5. Score = rounded average of grammar/tone/vocabulary breakdown.
6. Supabase mode → row inserted into `writing_submissions`; local mode → pushed into `local.writing`.
7. `{ feedback, score, submission_id }` returned → `FeedbackPanel` renders issues and alternatives.

---

## 9. Known Limitations & Next Steps

**Current limitations**
- Frontend still a single file; no URL routing (refresh lands on Overview).
- No automated tests, linter, or CI.
- Sidebar streak ("12 day streak"), "Upgrade plan", and the Vocabulary "3" badge
  are static (not driven by real data). The Overview recommendation banner and
  activity chart heights are static too.
- `language_level` never adapts content; roleplay scenario is fixed to
  job interview; exam prompt is a single fixed question.
- Groq calls are synchronous within a request (no streaming); a Groq outage or
  invalid JSON yields 502/503 to the UI.
- The old `feedback` mock constant in `src/main.jsx` is dead code.
- The `dist/` build currently on disk is **stale** — it baked in
  `http://localhost:4000` as the API URL. Always `npm run build` before
  deploying (the live Vercel frontend uses its own `VITE_API_URL` env var).
- Local dev runs the backend in **local mode**: `backend/.env.local` only holds
  `GROQ_API_KEY` (no Supabase keys), so nothing persists across restarts.

**Recommended next steps**
1. Split `src/main.jsx` into `components/` + `pages/` (structure below).
2. Add tests + linting (Vitest for frontend, node:test/supertest for backend).
3. Drive the static dashboard bits from real data (weak-area recommendation,
   weekly chart, streak, vocab badge).
4. Wire the level (A1–C2) into prompt selection; expand scenarios and exam prompts.
5. Replace the "3 correct uses" mastery rule with a real spaced-repetition
   schedule (the schema already stores `next_review`).

> The prioritized fix order for all of the above (starting with the two
> Critical security findings — local-mode auth bypass and plaintext
> passwords) is tracked in `CODE_AUDIT_REPORT.md` and the "Fix Roadmap"
> sheet of `audit_work/outputs/…/linguafy-code-audit.xlsx`.

**Future refactor of `src/main.jsx`**
```
src/
├── main.jsx                    # bootstrap only
├── App.jsx                     # shell + router
├── api.js
├── components/
│   ├── Sidebar.jsx
│   ├── Topbar.jsx
│   ├── FeedbackPanel.jsx
│   └── ui/  (Metric, Skill, ActivityChart, etc.)
└── pages/
    ├── Auth.jsx
    ├── Overview.jsx
    ├── Writing.jsx
    ├── Grammar.jsx
    ├── Vocabulary.jsx
    ├── Exam.jsx
    └── Roleplay.jsx
```

---

## 10. Quick Reference Cheat-Sheet

| What do you need?                     | Where to look |
|---------------------------------------|---------------|
| Add or change a frontend module       | `src/main.jsx` — `nav` array (lines 25–28) + `App` render block (lines 41–46) |
| Change an API route                   | `backend/src/routes/*.js`; mount in `backend/src/index.js` |
| Change an AI prompt                   | `backend/src/services/groq.js` |
| Change theming                        | `src/styles.css` — `:root` tokens (line 3) |
| Change DB schema / seed data          | `supabase/schema.sql`, `supabase/seed.sql` |
| Understand product behavior           | `AboutProject.md` |
| Understand the executed build plan    | `Linguafy_Development_Plan_V2.md` |
| Run placement test simulation         | `node scripts/test_placement.mjs` (verifies 30-Q adaptive run + 100% 15-topic coverage) |
| Regenerate the audit XLSX             | `cd audit_work && node make_xlsx.mjs` |
| Run the app locally                   | `backend: npm run dev` → :4000 · `frontend: npm run dev` → :5173 |
| Deploy                                | `README.md` (Vercel; two projects — frontend + backend) |
| Git workflow                          | `GitWorkFlow.md` |

---

## 11. Run It Locally

```bash
# Backend (backend/)
cd backend
npm install
cp .env.example .env        # non-secret defaults; optional
# put GROQ_API_KEY (and optionally Supabase keys) in backend/.env.local
npm run dev                 # → http://localhost:4000

# Frontend (root)
npm install
npm run dev                 # → http://localhost:5173
```

- Without Supabase keys the app runs in **local mode** (auth, drills, words in
  memory; data lost on restart). Groq is still required for AI feedback.
- Set `VITE_API_URL` in root `.env.local` to point the frontend at a different
  backend (e.g. the hosted `https://linguafy-backend.vercel.app`).

---

## 12. Deployment

- **Frontend** → `https://linguafy.vercel.app/` (from repo root).
- **Backend** → `https://linguafy-backend.vercel.app/` (from `backend/`).
- Both auto-deploy on push to `main` (the repo is `Hardik2811-wq/Linguafy`).
  See `README.md` for the full deploy/update checklist and troubleshooting.
- `VITE_API_URL` must be set as an Environment Variable in the **frontend**
  Vercel project (it can't come from `.env.local`, which never reaches Vercel).
- Backend secrets are set in the **backend** Vercel project settings
  (`GROQ_API_KEY`, `SUPABASE_*`, `FRONTEND_ORIGIN=https://linguafy.vercel.app`).
