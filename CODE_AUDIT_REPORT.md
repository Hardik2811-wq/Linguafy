# Linguafy — Complete Forensic Audit Report

**Date:** 2026-08-12
**Scope:** Full frontend + backend + schema + seed, with live behavioral testing against the running API and real Groq AI calls.
**Method:** Read every file line-by-line, then booted the backend and reproduced findings with real HTTP requests and real Groq completions (not just static reading).

> **Security note for the project owner:** your Groq API key was exposed during this audit (it lives in `backend/.env.local`, which is correctly git-ignored, but it was printed in plain form this session). Rotate it on the Groq dashboard when convenient.

---

## Summary of Findings (19 total)

| Severity | Count |
|----------|-------|
| 🔴 Critical | 2 |
| 🟠 High | 7 |
| 🟡 Medium | 6 |
| 🟢 Low | 4 |

Full machine-readable list: `audit_work/outputs/20260812-linguafy-audit/findings.json` and `linguafy-code-audit.xlsx`

---

## 🔴 CRITICAL

### 1 — Auth Bypass (any `local-` token works)
- **What's broken:** `requireAuth` accepts *any* token starting with `local-`, and `local.user()` returns a default "Learner" for unknown ids instead of rejecting.
- **Where:** `backend/src/middleware/auth.js:9`, `backend/src/services/local.js:13-16`
- **Impact:** A client can reach every protected endpoint without an account, and see/mutate data under a shared default identity.
- **Proven live:** Sent `Authorization: Bearer local-banana` → server returned `200` with a default user profile and progress.
- **Quick fix:** Issue signed tokens (e.g. HMAC) or map sessions to real user ids and return 401/404 when the id is unknown — never fall back to a default account.
- **Test:** `curl -H "Authorization: Bearer local-banana" http://localhost:4000/api/user/progress` → currently `200`; must be `401`.

### 2 — Plaintext Passwords Stored & Leaked
- **What's broken:** Local mode stores passwords unhashed and returns them verbatim in API JSON.
- **Where:** `backend/src/services/local.js:14` (storage), `backend/src/routes/auth.js:15` (signup response), `auth.js:25` (login), `auth.js:30` (`/me`)
- **Proven live:** signup response contained `"password":"password123"`; `/me` echoed it too.
- **Impact:** If the local store or any API response is exposed/sniffed, credentials leak in cleartext.
- **Quick fix:** Hash with `bcrypt`/`argon2`; never return the `password` field in any response. (Supabase mode already hashes via `admin.createUser` — local mode must too.)
- **Test:** sign up in local mode and inspect the response body.

---

## 🟠 HIGH

### 3 — Machine-Fresh Clone Can't Use AI (missing key)
- **What's broken:** `GROQ_API_KEY` lives only in git-ignored `backend/.env.local`. A fresh clone has no key.
- **Where:** `backend/.env`, `backend/src/config.js:17,21`, `backend/src/services/groq.js:5`
- **Impact:** Writing, vocabulary, exam, and conversation all return `503 "Server is missing: groqApiKey"`.
- **Proven live:** reproduced the 503 for every AI route.
- **Quick fix:** Document the key requirement in the README + `.env.example`; add a startup check that prints a clear message when the key is absent.

### 4 — Secrets Fail to Load Depending on Working Directory
- **What's broken:** `config.js` loads `.env`/`.env.local` with **CWD-relative** paths.
- **Where:** `backend/src/config.js:2-3`
- **Proven live:** The exact same backend code returned `503 groqApiKey` when started from a directory other than `backend/`, and worked when CWD = `backend/`.
- **Impact:** Any process manager, test harness, or deployment that launches from a different folder silently loses all secrets → confusing AI outages.
- **Quick fix:** Resolve env paths relative to the module (`import.meta.url` or `process.cwd()` root) or fail fast with a clear error.

### 5 — Exam "250 words" Is Not Enforced
- **What's broken:** UI says "Write at least 250 words"; the client only blocks <25 words and the backend only requires 150 **characters** (~25 words).
- **Where:** `src/main.jsx:98` (`words<25`), `backend/src/routes/exam.js:10` (`min(150)` chars)
- **Proven live:** a ~30-word essay passed validation and was accepted for scoring.
- **Impact:** Undersized/meaningless essays get scored; band estimates unreliable. Also: when the 40-min timer hits 0 the app just stops the interval — it never auto-submits, so work can be silently lost.
- **Quick fix:** Enforce 250 words on both client and server; decide and implement timer-expiry behavior (auto-submit or clear warning).

### 6 — "Random" Grammar Drill Isn't Random
- **What's broken:** `.limit(1)` is applied *before* picking randomly, so the server can only sample from a single row.
- **Where:** `backend/src/routes/grammar.js:10-12`
- **Impact:** Users effectively get one drill; the `?pillar=` filter shares the same flaw and `difficulty` is never sent to the UI.
- **Quick fix:** Select the full candidate set (or a random offset) then pick randomly; return `difficulty`.
- **Test:** call `GET /api/drills/grammar?pillar=subjunctive` repeatedly → currently returns a fixed/near-fixed row.

### 7 — Vocabulary Mastery Counts Attempts, Not Correct Uses
- **What's broken:** `mastered = correct && attempts >= 3` — the 3rd attempt marks mastery even if only the latest is right.
- **Where:** `backend/src/routes/vocabulary.js:19` (local), `:23-24` (supabase)
- **Impact:** Words are falsely "mastered"; the dashboard "words mastered" stat is inflated.
- **Quick fix:** Count actual correct uses (e.g. a 3-correct streak or cumulative correct count).

### 8 — Sessions Never Revalidated on Page Load
- **What's broken:** Auth is hydrated only from localStorage; `/api/auth/me` is never called on startup.
- **Where:** `src/main.jsx:33-40`, `src/api.js:3-9`
- **Impact:** Expired/stale tokens continue to look logged-in until a request fails; no refresh/sign-out path.
- **Quick fix:** On mount, if a token exists, call `/api/auth/me`; on failure clear the session.

### 9 — Dashboard "This Week" Is Actually All-Time
- **What's broken:** `dashboard.js` labels the data `this_week` but applies no date filter — it aggregates lifetime rows.
- **Where:** `backend/src/routes/dashboard.js:10-21`
- **Impact:** Weekly stats/chart/accuracy are wrong (they never reset weekly).
- **Quick fix:** Add a `created_at >= now() - interval '7 days'` filter.

---

## 🟡 MEDIUM

### 10 — weak_areas / recommendations Computed but Never Used
- The backend computes `weak_areas` and `recommendations` (`dashboard.js:20-21`) but the frontend never reads them (grep confirmed). The Overview "Recommended for you" card is **hardcoded** to "Strengthen subject-verb agreement" for every user (`main.jsx:77`).
- **Fix:** Wire Overview to `weak_areas`; show real recommendations.

### 11 — Spaced Repetition Is Theater
- `next_review` is set on every vocab attempt (`vocabulary.js:24`) but never queried. Word-of-day is chosen purely by calendar-day index (`Math.floor(Date.now()/86400000) % wordCount`), so mastered words resurface and the "Spaced repetition" UI card (`main.jsx:96`) does nothing.
- **Fix:** Query `next_review` to select review words; implement a real SRS schedule.

### 12 — Hardcoded UI Theater
- 12-day streak, "Upgrade plan" CTA, Vocabulary "3" badge, hero chart heights, "Next question" progress (45%→100%), inert "View report" button (`main.jsx:63-64,74,83`). "Save this rule" and "End & review notes" only fire a toast — nothing saved/ended (`main.jsx:94,100`).
- **Fix:** Drive streak, badges, and chart from real data; wire the buttons to real actions or remove them.

### 13 — Roleplay: Single Scenario, No Persistence/Resume
- Scenario hardcoded to `job_interview`; no session list, no resume flow, no end summary (`main.jsx:100`, `conversation.js:12`). In local mode history is an in-memory `Map`, lost on restart; the frontend never reloads a persisted history after refresh.
- **Verification (live):** The AI *does* stay in character and carry context correctly across turns, and grammar notes were accurate (e.g. `i`→`I`, `dont`→`don't`) — those parts work. The gaps are scenario choice and persistence/resume.

### 14 — Writing Coach: Style Rewrites Flagged as Grammar Errors
- **What's broken (verified live):** A clean sentence — *"I am a software developer and I work on this project every day"* — was tagged with two "errors" that are actually style rewrites (`"I am a software developer"` → `"As a software developer"`, `"every day"` → `"daily"`), and scored `tone: 40/100` as "informal".
- **Where:** `groq.js:19` (prompt asks for "errors"), `main.jsx:88,92` (renders them as red wrong→right)
- **Impact:** A user gets told correct English is wrong → erodes trust in the app.
- **Fix:** Split the prompt into true grammar errors vs. style suggestions; only render genuine errors as corrections. Tone should not be scored as "wrong" on neutral professional text.

### 15 — Vocabulary Accepts Copy-Pasted Examples (no originality check)
- **What's broken (verified live):** Submitting the exact `context_examples[0]` verbatim returned `correct:true, sophistication 8/10`.
- **Where:** `groq.js:20`, `vocabulary.js:19,21`
- **Impact:** Students can copy the example and get top marks — the "original use" promise is unenforced.
- **Fix:** Add a similarity guard (e.g. string/embedding similarity vs. examples) before calling Groq, and instruct Groq to penalize near-duplicates.

---

## 🟢 LOW

16. **Stale `dist/` build** — `dist/assets/index-DsUaU2xf.js` has `http://localhost:4000` baked in. Rebuild (with `VITE_API_URL`) before deploying.
17. **No tests / linter / CI** on either side — nothing guards against regressions like the auth bypass returning.
18. **Route mounting fragility** — three routers mount under `/api/feedback` (`index.js:53-58`); fine today, but any future path overlap silently shadows an endpoint. Consider versioning (`/api/v1/...`).
19. **Dead code & no URL router** — unused `feedback` mock (`main.jsx:12-23`) + unused `Play` import; refresh always lands on Overview.

---

## Deliverable 2 — Incomplete Features
- Weak-area recommendations (backend done, UI hardcoded) — #10
- Spaced repetition (schema + `next_review` but never wired) — #11
- Roleplay session list / resume / end-summary — #13
- Vocabulary originality/anti-copy guard — #15
- Timer expiry behavior on exam — #5
- Session revalidation on reload — #8

## Deliverable 3 — Missing Features
- User profile editor (change A1–C2 level) — no endpoint, no UI
- Learning-goal preference (work/exam/casual) — mentioned nowhere, unused
- Account deletion — absent
- URL routing / deep linking — absent (all state via `useState`)
- Refreshing the view without losing the screen — absent
- Grammar difficulty surfaced to UI — absent

## Deliverable 4 — Hardcoded Values
- 12-day streak, Upgrade CTA, Vocabulary "3" badge, hero chart heights, "Next question" progress, "View report" button, recommendation card, writing sample text, initial roleplay scenario/messages, writing "45%" progress.

---

## Verified Working (not just assumed)
- ✅ Validation: empty/short writing input correctly returns 400 (`writing.js`).
- ✅ Auth gating for requests *without* any token → 401.
- ✅ Exam band consistency: a full essay scored 8 across all four criteria and band = 8 (no 0–9 vs 1–10 mix-up).
- ✅ Conversation AI: stays in character, carries context over turns, grammar notes are accurate and not fabricated.
- ✅ Vocab nonsense detection: "ephemeral is ephemeral" correctly flagged incorrect (sophistication 2).
- ✅ Consistent JSON error structure via `errorHandler`.

---

## Verification Environment / Limits
- The backend was executed live in **local mode** (no Supabase keys configured on this machine), so **DB row counts could not be queried** (drills count, table contents, NULL `next_review`, etc.). Those specific items from your prompt remain unverified and should be confirmed in the actual Supabase project.
- AI-quality items were verified with **real Groq calls** through the running backend.
