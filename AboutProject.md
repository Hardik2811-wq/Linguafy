# AboutProject.md — Linguafy English Trainer

A simple developer guide to what the app does, how it works, and how it is built.

---

## 1. What is this project?

**Linguafy** is a web app for practicing English. It covers 6 areas:

1. Dashboard (Overview)
2. Writing studio
3. Grammar lab
4. Vocabulary
5. Exam prep (IELTS)
6. Roleplay / conversation

Users sign up, practice in any module, and get AI-style feedback powered by **Groq**. Their progress is saved to a **PostgreSQL** database via **Supabase**.

---

## 2. Tech stack (the short version)

| Layer | Tool |
|-------|------|
| Frontend | React (JSX) + Vite |
| Backend | Node.js + Express |
| Database | PostgreSQL via Supabase |
| AI | Groq API (`groq-sdk`) |
| Validation | zod |
| Auth | Supabase Auth (JWT) |

---

## 3. The two ways the app runs

The backend works **even with no database or API keys**. Every route checks:

```
Is Supabase configured? (SUPABASE_URL + keys in backend/.env)
  ├─ YES  → use the real Supabase database + Groq
  └─ NO   → use "local mode" (in-memory storage, still calls Groq)
```

- **Local mode** uses `backend/src/services/local.js`: users, grammar drills,
  and vocabulary words live in memory. Data is lost on server restart.
- **Supabase mode** is the real setup — everything is persisted.

This means the app is easy to demo and test before wiring up a real database.

---

## 4. Frontend — modules and functionality

All frontend code lives in `src/`. Components are single-purpose and wired to the
backend via the `api()` helper in `src/api.js`.

### App shell
- **Sidebar** — navigation between modules. Shows the signed-in user and level.
- **Auth screen** (`Auth` in `src/main.jsx`) — sign up / log in form.
  - Signup asks for: name, email, password, language level (A1–C2, default B2).
  - The level is **self-reported** and currently only displayed, never used to
    adapt content.
- **Toast** — small notification messages from any module.

### Overview (Dashboard)
- Fetches progress from `GET /api/user/progress` and shows:
  - Stats (writing sessions, grammar drills, grammar accuracy, words mastered)
  - Skill progress bars (Writing / Grammar / Vocabulary / Exam prep)
  - Weekly activity total
  - A recommendation card ("Practice now" jumps to Grammar)

### Writing studio
- Textarea + a context dropdown (email, essay, casual, cover letter).
- "Get feedback" → `POST /api/feedback/analyze-text`.
- Shows a score (0–100), a note, a list of issues (wrong → right), and
  vocabulary alternatives.

### Grammar lab
- Loads a random drill from `GET /api/drills/grammar`.
- User picks an answer → `POST /api/feedback/grammar-drill`.
- Shows correct/wrong state, an explanation, and running accuracy for the pillar.

### Vocabulary
- Loads the word of the day from `GET /api/vocabulary/daily` (same word for
  everyone on a given day).
- User writes a sentence using the word → `POST /api/feedback/vocabulary-check`.
- Shows correctness, a sophistication score (1–10), and feedback.
- A word is "mastered" after 3 correct uses.
- Speaker button reads the word aloud (browser speech synthesis).

### Exam prep (IELTS)
- A real 40-minute countdown timer.
- Essay textarea with live word count.
- "Submit for scoring" → `POST /api/exam/submit`.
- Shows estimated IELTS band (0–9) plus per-criterion scores.

### Roleplay (conversation)
- Chat UI for a job-interview scenario.
- Sends `POST /api/conversation/send` and keeps a `session_id` for the chat.
- Silently collects grammar notes from the AI as you talk.

---

## 5. Backend — routes (API)

Entry: `backend/src/index.js`. All JSON, all require auth unless noted.

| Method & Path | File | What it does |
|---------------|------|--------------|
| `GET /health` | index.js | Health check (no auth) |
| `POST /api/auth/signup` | routes/auth.js | Create account |
| `POST /api/auth/login` | routes/auth.js | Log in |
| `GET /api/auth/me` | routes/auth.js | Current user info |
| `POST /api/feedback/analyze-text` | routes/writing.js | Groq writing feedback + save |
| `GET /api/drills/grammar` | routes/grammar.js | Random grammar drill |
| `POST /api/feedback/grammar-drill` | routes/grammar.js | Check an answer + save attempt |
| `GET /api/vocabulary/daily` | routes/vocabulary.js | Word of the day |
| `POST /api/feedback/vocabulary-check` | routes/vocabulary.js | Validate a sentence + save |
| `POST /api/exam/submit` | routes/exam.js | Score an IELTS essay + save |
| `POST /api/conversation/send` | routes/conversation.js | Get an AI reply + save turn |
| `GET /api/user/progress` | routes/dashboard.js | Aggregated stats |

### How auth works
- The signed-in token (`linguafy_token` in localStorage) is sent as
  `Authorization: Bearer <token>`.
- `middleware/auth.js` (`requireAuth`) verifies it:
  - Supabase mode → `supabase.auth.getUser(token)`.
  - Local mode → checks the token starts with `local-`.

### How the AI works
- `services/groq.js` sends a system prompt ("You are a precise English teacher.
  Return only valid JSON") plus a task prompt, using JSON mode.
- Each module has its own prompt: writing analysis, vocabulary check, IELTS
  scoring, conversation reply.
- Invalid/empty AI JSON returns a friendly 502 error.

### Local mode storage (`services/local.js`)
- `users` (Map), `writing`, `grammarAttempts`, `vocabulary`, `exams` (arrays),
  `conversations` (Map of session → turns).
- Contains 2 hardcoded grammar drills and 2 vocabulary words so you can test
  Grammar and Vocabulary even without Supabase seed data.

---

## 6. Database design (Supabase tables)

Schema lives in `supabase/schema.sql`. Everyone belongs back to `users`.

```
users
├── id (uuid, FK → auth.users)
├── email (unique)
├── name
├── language_level (A1–C2, default B2)

writing_submissions
├── user_id → users
├── text, context
├── errors (jsonb), suggestions (jsonb)
├── tone_assessment
├── vocabulary_alternatives (jsonb)
├── score (0–100), score_breakdown (jsonb)

grammar_drills              (question bank, no user id)
├── id (bigint identity)
├── pillar, question_text, options (jsonb)
├── correct_answer, explanation, difficulty (1–5)

grammar_attempts
├── user_id → users, drill_id → grammar_drills
├── user_answer, correct

vocabulary_words            (word bank, no user id)
├── id, word (unique), definition, context_sentence
├── context_examples (jsonb), difficulty (1–5), category

vocabulary_progress
├── user_id, word_id  (unique pair)
├── user_sentence, correct, score (1–10)
├── attempts, mastered, last_attempt, next_review

exam_attempts
├── user_id → users
├── exam_type, task_type, essay_text, word_count
├── task_achievement, coherence_cohesion, lexical_resource,
│   grammatical_accuracy, band_estimate   (0–9 scale)
├── feedback (jsonb)

conversation_sessions
├── user_id → users, scenario, ended_at

conversation_turns
├── session_id → conversation_sessions
├── user_message, bot_response
├── grammar_notes (jsonb), turn_number
```

- Seed data is in `supabase/seed.sql` (3 grammar drills, 3 vocabulary words).
- RLS is enabled on all tables; the backend uses the **service-role key**, which
  bypasses RLS — that key must never go in the browser.
- Key columns are indexed (e.g. `idx_writing_user` on `user_id`).

---

## 7. How a request flows (one example)

Writing "Get feedback":

1. Frontend calls `POST /api/feedback/analyze-text` with `{ text, context }`.
2. `requireAuth` verifies the token → sets `req.user`.
3. Route validates input (8–2000 chars) with zod.
4. `services/groq.js` asks Groq for JSON feedback.
5. Score is computed from `score_breakdown` (avg of grammar/tone/vocabulary).
6. In Supabase mode the submission is inserted into `writing_submissions`.
   In local mode it's pushed into `local.writing`.
7. Feedback + score are returned to the frontend and displayed.

---

## 8. Run it locally

```bash
# Frontend (root)
npm install
npm run dev            # → http://localhost:5173

# Backend (backend/)
cd backend
npm install
cp .env.example .env   # optional: fill in Supabase + Groq keys
npm run dev            # → http://localhost:4000
```

- Without `backend/.env`, the app runs in **local mode** (auth, drills, words
  all in memory) — but Groq is still needed for writing/vocab/exam/conversation
  feedback. Signups still work locally.
- Set `VITE_API_URL` if the backend is not on `http://localhost:4000`.

---

## 9. Things worth knowing

- The level (A1–C2) is only stored and shown; it does not change content yet.
- `src/main.jsx` still contains an unused mock `feedback` object from the
  earlier prototype (safe to delete).
- There are no automated tests or linter configured yet.
- The `dist/` build can get stale — run `npm run build` before deploying.