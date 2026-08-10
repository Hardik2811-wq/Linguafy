# Developer.md — Linguafy English Trainer

Technical reference for developers working on this project. Read this alongside
`English_Learning_App_Development_Plan.md`, which describes the product vision,
phases, and the planned backend/database/AI architecture.

---

## 1. Project Overview

**What this project is for**

Linguafy is an interactive English learning web app (an MVP). It combines the
"8 pillars" of English learning — writing, grammar, vocabulary, speaking,
conversation, exam prep, listening, and accuracy — into a single dashboard-style
UI. Users pick a module, practice, and get feedback that looks like it comes
from an AI coach.

**What the project is NOT (yet)**

- There is **no backend**. No Express server, no database, no API routes.
- There is **no real AI integration**. No Groq / OpenAI calls happen. All
  feedback is hard-coded mock data or generated locally in the browser.
- Everything runs **client-side only** (Vite dev server + React).

The roadmap for turning this into a real full-stack app (Express + Supabase +
Groq) lives in `English_Learning_App_Development_Plan.md`.

**Tech stack (as implemented)**

| Concern        | Choice                                            |
|----------------|---------------------------------------------------|
| Framework      | React 19 (latest) via JSX, no TypeScript          |
| Build tool     | Vite (latest)                                     |
| Entry point    | `index.html` → `src/main.jsx`                     |
| Styling        | Hand-written CSS in `src/styles.css` (single file)|
| Icons          | `lucide-react`                                    |
| State          | Local React state only (`useState`), no store     |
| Router         | None — view switching via `useState` in `<App>`   |

---

## 2. Repository Structure

```
English Trainer/
├── index.html                              # HTML shell; mounts the React app
├── package.json                            # name, scripts, dependencies
├── package-lock.json                       # generated lockfile (do not edit)
├── .gitignore                              # node_modules, dist, .env ignored
├── README.md                               # short user-facing run guide
├── English_Learning_App_Development_Plan.md# product/architecture roadmap
├── Developer.md                            # this file
├── node_modules/                           # installed deps (generated)
├── dist/                                   # production build output (generated)
└── src/
    ├── main.jsx   # ENTIRE application logic (components + render)
    └── styles.css # ALL styling for the app (minified single-line rules)
```

> The whole UI lives in **one file**, `src/main.jsx`, which is intentionally a
> prototype approach. See "Future refactor" at the end of this document.

---

## 3. File-by-File Documentation

### 3.1 `index.html`

| Item         | Detail                                      |
|--------------|---------------------------------------------|
| Location     | project root                                |
| Purpose      | HTML entry point for Vite                   |
| Contents     | `<div id="root"></div>` + `<script type="module" src="/src/main.jsx">` |
| How it works | Vite serves this file in dev (`npm run dev`) and bundles `main.jsx` as the entry module. React renders into `#root`. |

### 3.2 `package.json`

| Item     | Detail |
|----------|--------|
| Name     | `linguafy-english-trainer`, version `1.0.0`, `private: true`, `type: module` (ESM) |
| Scripts  | `dev` → `vite`, `build` → `vite build`, `preview` → `vite preview` |
| Runtime deps | `@vitejs/plugin-react`, `vite`, `react`, `react-dom`, `lucide-react` (all `latest`) |

### 3.3 `.gitignore`

Ignores `node_modules`, `dist`, and `.env` (prep for future API keys).

### 3.4 `README.md`

Short user-facing guide: how to install and run, plus a note that feedback is
currently deterministic/local and must be wired to the planned
Express/Supabase/Groq API before production.

### 3.5 `English_Learning_App_Development_Plan.md`

The product + architecture blueprint (4 phases, DB schema, API routes, Groq
prompt designs, deployment strategy). Refer here for anything this MVP does
not yet implement.

### 3.6 `src/main.jsx` — application logic

The entire component tree. Detailed in **Section 4** below.

### 3.7 `src/styles.css` — all styling

A single minified CSS file. Detailed in **Section 5** below.

---

## 4. `src/main.jsx` — Full Function Reference

### 4.0 Module-level constants (executed once on load)

| Constant  | Line | Type  | Definition and behavior |
|-----------|------|-------|--------------------------|
| `feedback`| 10–21| Object| **Mock AI feedback** returned by the Writing module. Shape: `score` (number, e.g. `82`), `corrected` (string, rewritten sentence), `note` (string summary), `issues` (array of `{ wrong, right, label, text }` — the before/after error pairs shown in the feedback list), `suggestions` (array of strings), `alternatives` (array of vocabulary alternatives to the word "confident"). |
| `nav`     | 23–26| Array | Navigation definition: 6 entries of `[id, label, Icon]` used by the sidebar. IDs: `overview`, `writing`, `grammar`, `vocabulary`, `exam`, `roleplay`. The icon component (from `lucide-react`) is stored directly in the tuple. |

---

### 4.1 `function App()`

|          | Detail |
|----------|--------|
| Line     | 28–46  |
| Purpose  | Root component. Owns global view state and the toast notification system, and renders the persistent shell. |
| State    | `view` — which module is shown (`'overview'` by default). `toast` — message string shown in the corner notification. |
| Closure  | `notify(message)` — sets `toast`, then clears it after **2600 ms** via `setTimeout`. Passed down to every module so any module can raise a toast. |
| Renders  | `sidebar` layout → `<Sidebar>`; `<main className="main">` → `<Topbar>` + exactly one module selected by `view`: `Overview`, `Writing`, `Grammar`, `Vocabulary`, `Exam`, `Roleplay`. Finally renders the toast overlay (`<div className="toast">` with a green check icon) if `toast` is non-empty. |
| Notes    | This is the app's "router" — view switching is pure `useState`, not URL-based. `setView` is passed to `Sidebar`, `Overview`, `Grammar`, and `Exam` so those components can navigate. |

### 4.2 `function Sidebar({ view, setView })`

|          | Detail |
|----------|--------|
| Line     | 48–55  |
| Props    | `view` (active id string), `setView` (setter to switch modules) |
| Purpose  | Fixed left navigation rail. |
| Renders  | Brand (`Linguafy` + sparkles mark); a "workspace" switcher chip (avatar `AH`, "Arjun's space", "Upper intermediate", chevron); the `<nav>` built by mapping `nav` into buttons with icons/labels and an active class (`view === id`); a "3" badge on the Vocabulary item; the bottom block with a streak card ("12 day streak", flame icon), an "Upgrade plan" button, and the profile row ("Arjun H.", "Free plan"). |
| Behavior | Clicking a nav button calls `setView(id)`, re-rendering `App` to show the matching module and re-styling the active link. |

### 4.3 `function Topbar()`

|          | Detail |
|----------|--------|
| Line     | 57    |
| Purpose  | Sticky-style top header. |
| Renders  | A mobile-only logo, a speaker/icon button, a "?" help button, and an avatar. |
| Notes    | No state, no props; purely presentational. |

### 4.4 `function Overview({ setView })`

|          | Detail |
|----------|--------|
| Line     | 59–67  |
| Props    | `setView` (to jump to Writing or Grammar via CTA buttons) |
| Purpose  | Dashboard landing page. |
| Renders  | **Welcome row** (eyeobrow date, "Good morning, Arjun", "Continue learning" button → Writing). **Hero card** with a static CSS "paper" illustration + a comment bubble, CTA "Start writing practice" → Writing. **"Your learning pulse"** section with a 4-tile `Metric` grid (day streak, time practiced, average accuracy, total XP). **Dashboard grid** with a skill-progress card (4 `Skill` bars) and a weekly-activity card (`ActivityChart` + totals). **Recommendation banner** — "Strengthen subject–verb agreement" with a "Practice now" button → Grammar. |
| Notes    | All numbers are hard-coded mocks. Two buttons call `setView` to navigate the user into another module. |

### 4.5 `function Metric({ icon, tint, value, label, trend })`

|          | Detail |
|----------|--------|
| Line     | 69    |
| Props    | `icon` (React node), `tint` (`orange`/`purple`/`green`/`yellow` = icon color class), `value`, `label`, `trend` |
| Purpose  | Small stat card for the stats grid. |
| Behavior | Renders a colored icon chip plus `value` (bold), `label`, and `trend` (small text). Pure presentational. |

### 4.6 `function Skill({ name, value, color, note })`

|          | Detail |
|----------|--------|
| Line     | 69    |
| Props    | `name`, `value` (percentage), `color` (progress bar class), `note` ("Strong"/"Growing"/etc.) |
| Purpose  | Single progress bar row on the skill card. |
| Behavior | Renders label + `value%` + `note`, and a `.progress` bar whose inner `<i>` width is `value%` with the given color class. |

### 4.7 `function ActivityChart()`

|          | Detail |
|----------|--------|
| Line     | 69    |
| Purpose  | 7-day bar chart. |
| Behavior | Hard-coded heights `[44,76,58,92,68,83,51]` mapped to bars whose inline `height` style is the percentage; day labels `M T W T F S S` under each bar. No data props — purely decorative mock. |

### 4.8 `function Writing({ notify })`

|          | Detail |
|----------|--------|
| Line     | 73–78  |
| Props    | `notify` (toast helper) |
| Purpose  | "Writing studio" module — the planned MVP feature. Simulates `GET FEEDBACK` on a user's text. |
| State    | `text` (draft, pre-filled with a sample), `context` (`'Professional email'` default), `result` (the feedback object, `null` before analysis), `loading` (spinner state). |
| Closure  | `analyze()` — guards empty input by calling `notify('Write a few words first')`; otherwise sets `loading = true`, then after **850 ms** (simulated network) sets `loading = false` and `result = feedback` (the hard-coded mock). |
| Renders  | Breadcrumb, heading row with session chip; a two-column layout: **Editor card** (context `<select>` with 4 options, `<textarea>`, live word count computed via `text.trim().split(/\s+/).length`, and a "Get feedback" primary button that is `disabled` while loading and shows a spinner). Right column shows `<FeedbackPanel>` if `result` exists, else an empty-state card ("Your feedback will appear here" + grammar/clarity/tone check chips). Bottom: a coach tip row. |
| Notes    | The `context` value is currently **not used** in the mock. Reset handler (`onReset`) clears `result` and toasts "Ready for another draft". |

### 4.9 `function FeedbackPanel({ result, onReset })`

|          | Detail |
|----------|--------|
| Line     | 80    |
| Props    | `result` (the feedback object), `onReset` (callback) |
| Purpose  | Displays the simulated AI writing feedback. |
| Renders  | Score header (big circular `82 / 100`); the coach note; "3 issues found" list built by mapping `result.issues` (each shows a number chip, uppercase label, `wrong → right` with a `<del>` / arrow / `<strong>`, and the rule explanation text); an "alternatives" strip rendering buttons from `result.alternatives`; a "Start another draft" reset button. |

### 4.10 `function Grammar({ notify })`

|          | Detail |
|----------|--------|
| Line     | 82    |
| Props    | `notify` |
| Purpose  | "Grammar lab" — one interactive drill with instant self-check. |
| State    | `choice` (user-selected answer), `answered` (whether the answer has been locked in). `correct` is hard-coded to `'are'`. |
| Closure  | `select(value)` — sets `choice` and flips `answered = true`. |
| Renders  | Intro ("Grammar lab · 3 minutes" with question 4 of 10 + tiny progress bar). The drill sentence: *"Neither the manager nor the employees `___` available for comment."* with `choice` inserted in the blank. Two answer buttons (`is` / `are`). After answering, the clicked + correct buttons get `correct`/`wrong`/`selected` classes and a green explanation panel appears ("The verb agrees with the noun closest to it…"). A "Next question" button resets `choice`/`answered` and toasts "New drill loaded". Right column: "Today's concept" card (subject–verb agreement rule, example, "Save this rule" → toasts). |
| Notes    | Only one fixed question; "Next question" does not actually load anything new. |

### 4.11 `function Vocabulary({ notify })`

|          | Detail |
|----------|--------|
| Line     | 84    |
| Props    | `notify` |
| Purpose  | Word-of-the-day + sentence validation practice. |
| State    | `sentence` (user's sentence), `checked` (whether validation result is visible). |
| Renders  | Left: "word of the day" card for **meticulous** — pronunciation, definition, a context quote, and synonym tags (precise / thorough / careful). Right: "Your turn" card — textarea (with `sentence.length/200` counter), "Check my sentence" button which guards empty input (`notify('Write a sentence first')`) then sets `checked = true`. When checked, a green success box shows "Strong use of the word!" + "9/10" (hard-coded). Bottom: a "Spaced repetition — 3 words ready for review" card with a "Start review" button that only toasts. |

### 4.12 `function Exam({ notify })`

|          | Detail |
|----------|--------|
| Line     | 86    |
| Props    | `notify` |
| Purpose  | IELTS Writing Task 2 simulator shell. |
| State    | `running` (timer toggle), `time` (minutes, hard-coded start at `40`). |
| Renders  | Heading with a timer chip displaying `{time}:00` and a Start/Pause button that toggles `running` (the actual countdown is **not** implemented — the number never ticks). A prompt card (Writing Task 2 essay question + meta "40 minutes", "250 words"). An essay card with a textarea and a "Submit for scoring" button that only toasts "Add at least 250 words to submit your essay". A criteria strip (Task response / Coherence / Lexical resource / Grammar range). |
| Notes    | Timer and scorer are placeholders: `time` state is never decremented and no scoring logic exists. |

### 4.13 `function Roleplay({ notify })`

|          | Detail |
|----------|--------|
| Line     | 88    |
| Props    | `notify` |
| Purpose  | Conversation practice with a simulated AI partner. |
| State    | `messages` (array of `{ side: 'bot'|'user', text }`, seeded with a bot greeting about a job interview), `draft` (the input box text). |
| Closure  | `send()` — ignores empty drafts; appends the user message plus a hard-coded bot follow-up ("That sounds promising. Could you give me a specific example…"), then clears `draft`. |
| Renders  | Chat header (job-interview scenario, live-practice dot). A scrollable `.messages` list rendering each message with side-specific alignment/avatar (bot icon vs "AH"). A chat input row — Enter key also triggers `send()`. Right column: "Your coach is listening" card listing what gets checked, with an "End & get feedback" button that only toasts. |
| Notes    | The bot replies are a hard-coded script; there is no conversation intelligence and no end-of-roleplay feedback. |

### 4.14 Application bootstrap

|          | Detail |
|----------|--------|
| Line     | 90    |
| Code     | `createRoot(document.getElementById('root')).render(<App/>);` |
| Behavior | Uses React 19 `createRoot` from `react-dom/client` to mount `<App/>` into the `#root` node defined in `index.html`. |

---

## 5. `src/styles.css` — Style Reference

Single minified stylesheet (one giant rule block + two media queries). Loaded via
`@import` of Google Fonts **DM Sans** (body UI) and **Playfair Display** (headings).

### 5.1 Design tokens (`:root` CSS custom properties)

| Variable        | Value      | Use            |
|-----------------|------------|----------------|
| `--ink`         | `#1f2540`  | main text      |
| `--muted`       | `#747a91`  | secondary text |
| `--line`        | `#e7e8f0`  | borders        |
| `--bg`          | `#f8f8fc`  | page background|
| `--violet`      | `#7057e8`  | primary accent |
| `--violet-dark` | `#5d44d8`  | hover accent   |
| `--soft-violet` | `#f0edff`  | active states  |
| `--green`       | `#39a77e`  | success accents|
| `--card`        | `#fff`     | card background|

### 5.2 Style sections (in file order)

| Section | Key selectors | What it styles |
|---------|---------------|----------------|
| Reset & base | `*` (box-sizing), `body` | global resets, background, DM Sans base |
| Shell & sidebar | `.shell`, `.sidebar`, `.brand`, `.brand-mark`, `.workspace`, `.avatar`, `.nav-link`, `.streak`, `.upgrade`, `.profile` | full-height shell, fixed 256px sidebar, navigation buttons + active state, streak banner, upgrade button, profile row |
| Main & topbar | `.main`, `.topbar`, `.top-actions`, `.icon-button`, `.help`, `.mobile-logo` | content area offset by sidebar, sticky-style header, mobile logo |
| Page scaffolding | `.page`, `.welcome`, `.eyebrow`, headings, `.primary/.secondary/.light-button`, `.text-button` | shared layout, typography (Playfair headings), button variants |
| Overview hero | `.hero-card`, `.hero-copy`, `.pill`, `.paper`, `.line`, `.highlight-line`, `.comment-bubble`, widths `w90/w80/w70` | gradient hero banner with the CSS-drawn "writing paper" illustration |
| Stats & dashboards | `.stats-grid`, `.metric`, `.metric-icon` (orange/purple/green/yellow), `.dashboard-grid`, `.progress-card`, `.skill`, `.progress` (violet/blue/teal/orange), `.chart`, `.bar`, `.bar-wrap`, `.legend`, `.activity-total` | the 4 stat tiles, the skill bars, the weekly bar chart |
| Recommendation | `.recommend`, `.recommend-icon` | "Recommended for you" banner |
| Writing studio | `.studio`, `.breadcrumb`, `.studio-heading`, `.session-chip`, `.writing-layout`, `.editor`, `.editor-top`, `.editor textarea`, `.editor-foot`, `.feedback-empty`, `.empty-spark`, `.checks`, `.tip-row`, `.feedback-panel`, `.score-header`, `.score`, `.feedback-note`, `.feedback-tabs`, `.issue`, `.issue-num`, `.alternatives`, `.reset-button`, `.loader` + `@keyframes spin` | the writing editor, empty/feedback panels, issues list, alternatives, loading spinner |
| Grammar lab | `.module`, `.module-intro`, `.module-grid`, `.drill`, `.drill-top`, `.tiny-progress`, `.sentence`, `.blank`, `.choices`, `correct/wrong/selected`, `.explanation`, `.concept`, `.concept-icon`, `.example` | drill card, answer buttons + feedback states, concept sidebar |
| Vocabulary   | `.vocab-layout`, `.word-card`, `.word-card-top`, `.pronounce`, `.definition`, `.context-quote`, `.word-tags`, `.use-card`, `.use-footer`, `.vocab-result`, `.review-card` | dark word card, user sentence card, success result, review card |
| Exam prep    | `.exam-heading`, `.timer`, `.exam-workspace`, `.prompt`, `.prompt-label`, `.exam-meta`, `.essay`, `.criteria` | IELTS prompt + essay panels, timer chip, criteria strip |
| Roleplay     | `.roleplay-layout`, `.chat`, `.chat-header`, `.live`, `.messages`, `.message` (`.user`), `.message-avatar`, `.chat-input`, `.coach-card`, `.coach-list` | chat window, bot/user bubbles, coach sidebar |
| Toast        | `.toast` | bottom-right corner notification |

### 5.3 Responsive behavior

| Breakpoint      | Changes |
|-----------------|---------|
| `≤1000px` (tablet)| sidebar narrows to 210px; 4-col stats become 2 cols; writing/grammar/vocab/exam/roleplay two-column grids collapse to one column; `.concept` sidebar hidden; exam layout stacks |
| `≤700px` (mobile) | sidebar hidden entirely; mobile logo shown in topbar; pages switch to stacked layout; hero visual hidden; stats become 2-col; full-width buttons; chat fixed height |

---

## 6. Data Flow & State Model

**State is entirely local.** There is one `useState` per concern, lifted only as
far as needed:

```
App
 ├─ view      → drives which module renders (acts as router)
 ├─ toast     → global notification
 ├─ Sidebar   → receives { view, setView } (navigation)
 ├─ Overview  → receives { setView } ({CTA navigation)
 ├─ Writing   → text, context, result, loading (all internal)
 ├─ Grammar   → choice, answered (internal)
 ├─ Vocabulary→ sentence, checked (internal)
 ├─ Exam      → running, time (internal, timer not wired)
 └─ Roleplay  → messages, draft (internal)
```

Cross-component communication happens **only** via:
- Props (e.g. `setView`, `notify` passed from `App`)
- Context is **not** used (redundant imports of `useMemo` exist but are unused)

---

## 7. Known Limitations & Next Steps

**Limitations (prototype behavior)**
- No backend / database / authentication — all data is mocked or ephemeral.
- No AI calls: `Writing` returns the static `feedback` object; `Roleplay` uses a
  scripted reply; `Grammar`/`Vocabulary`/`Exam` have fixed content and canned
  results.
- No real timer, no real word-count scoring, no persistence between reloads.
- No URL routing (refresh always lands on Overview).
- `context` selected in Writing is unused by the mock.

**Recommended next steps (from the development plan)**
1. Backend: Express + TypeScript server with Groq SDK; routes
   `/api/auth/*`, `/api/feedback/analyze-text`, `/api/feedback/grammar-drill`,
   `/api/feedback/vocabulary-check` (see plan §1.3).
2. Database: Supabase schema for users / learning_sessions / submissions /
   vocabulary_progress / exam_attempts (plan §1.2).
3. Replace `feedback` mock in `Writing` with a real call to the backend.
4. Wire Exam timer + scoring, Vocab validation, Roleplay end-feedback to the API.

**Future refactor of `src/main.jsx`**
The single file will become unmanageable as features grow. Recommended
structure (from the plan):

```
src/
├── main.jsx                    # bootstrap only
├── App.jsx                     # shell + router
├── components/
│   ├── Sidebar.jsx
│   ├── Topbar.jsx
│   ├── FeedbackPanel.jsx
│   └── ui/  (Metric, Skill, ActivityChart, etc.)
└── pages/
    ├── Overview.jsx
    ├── Writing.jsx
    ├── Grammar.jsx
    ├── Vocabulary.jsx
    ├── Exam.jsx
    └── Roleplay.jsx
```

---

## 8. Quick Reference Cheat-Sheet

| What do you need?          | Where to look |
|----------------------------|---------------|
| Add or change a module     | `src/main.jsx` — `App` render block (lines 37–42) + `nav` (lines 23–26) |
| Change the mock AI feedback | `src/main.jsx` — `feedback` constant (lines 10–21) |
| Change colors/theming       | `src/styles.css` — `:root` tokens (line 2) |
| Add a route/page            | not yet possible (no router) — see §7 refactor |
| Understand the product plan | `English_Learning_App_Development_Plan.md` |
| Run the app                 | `npm install` → `npm run dev` |

---

## 9. Present But Not Functional — Inventory

Everything in React is a **component**, so a button exists as long as it renders.
This section is a concrete checklist of UI/controls that **look present but do
nothing real** yet. Use it to scope what still needs to be wired up.

### 9.1 Sidebar & shell

| Item | Location (main.jsx) | State | Expected future behavior |
|------|---------------------|-------|---------------------------|
| Workspace switcher chip ("Arjun's space") | `Sidebar`, line 51 | Renders; chevron click does nothing | Switch between workspaces/profiles |
| Vocabulary "3" notification badge | `Sidebar`, line 52 | Hard-coded static number | Real count of words due for review |
| Streak card ("12 day streak") | `Sidebar`, line 53 | Static mock data | Live streak from daily activity |
| "Upgrade plan" button | `Sidebar`, line 53 | No `onClick` | Pricing/plan flow |
| Profile "MoreHorizontal" menu | `Sidebar`, line 53 | No `onClick` | Profile/menu dropdown |
| Topbar speaker button | `Topbar`, line 57 | No `onClick` | Voice/callback, notifications |
| Topbar "?" help button | `Topbar`, line 57 | No `onClick` | Help modal or onboarding |

### 9.2 Overview / dashboard

| Item | Location | State | Future behavior |
|------|----------|-------|-----------------|
| All welcome/hero copy ("Good morning, Arjun", date, "TODAY'S FOCUS") | `Overview`, line 60–61 | Static text | Personalized from user + daily focus |
| Stat tiles (streak, 4.6h, 78%, 1,240 XP) | `Overview`, line 63 | Hard-coded values | Aggregated from learning_sessions/submissions |
| Skill progress bars (82/68/74/55%) | `Overview`, line 64 | Hard-coded | Computed accuracy per pillar |
| Weekly activity chart | `Overview`, line 64 (`ActivityChart`) | Hard-coded array `[44,76,58,92,68,83,51]` | Real minutes from DB |
| "View report" text button | `Overview`, line 62 | No `onClick` | Report page/download |
| Recommendation banner (subject–verb agreement) | `Overview`, line 65 | Static; only the "Practice now" button navigates | Generated from weak-area analysis |
| "Practice now" / "Continue learning" navigation | `Overview` | Works only as in-app view switching | Real module/lesson routing |

### 9.3 Writing studio

| Item | Location | State | Future behavior |
|------|----------|-------|-----------------|
| **Whole "Get feedback" flow** | `Writing`, line 76 (`analyze`) | Returns hard-coded `feedback` object after a fake 850 ms timeout | POST `/api/feedback/analyze-text` → real Groq feedback |
| Context dropdown (email/essay/casual/cover letter) | `Writing`, line 77 | Selected but **never used** by the mock | Sent to the API to tune register/tone feedback |
| Word counter | `Writing`, line 77 | Works (splits text on whitespace) but purely cosmetic | Input stats for the API/limits |
| Loading spinner + disabled button | `Writing`, line 77 | Works as UI only | Real pending state while awaiting API |
| Score (82/100) & corrected rewrite | `FeedbackPanel`, line 80 | Hard-coded in `feedback` | From Groq analysis |
| "3 issues found" + `del → strong` pairs | `FeedbackPanel`, line 80 | Hard-coded | Highlighted errors from API response |
| "Alternatives" word buttons | `FeedbackPanel`, line 80 | Static; buttons have no behavior | Vocabulary alternatives; clicking could add to vocab list |
| "Start another draft" reset | `FeedbackPanel`, line 80 | Only clears local `result` | Resets + maybe archives the draft |
| Coach tip row | `Writing`, line 77 | Static text | Context-aware tip |

### 9.4 Grammar lab

| Item | Location | State | Future behavior |
|------|----------|-------|-----------------|
| **One fixed drill only** | `Grammar`, line 82 | Always the "neither…nor / are" question | Bank of drills from DB or Groq |
| "Question 4 of 10" + 40% progress bar | `Grammar`, line 82 | Hard-coded, never changes | Real question index/progress |
| "Next question" button | `Grammar`, line 82 | Resets state but loads the **same** question | Load next drill |
| Answer buttons (`is`/`are`) + classes | `Grammar`, line 82 | Local only; feedback is the same every time | Real answer checking + accuracy tracking per concept |
| Explanation panel | `Grammar`, line 82 | Hard-coded rule text | Groq-generated rule + examples |
| "Today's concept" sidebar | `Grammar`, line 82 | Static; hidden ≤1000px | Pulled per drill/lesson |
| "Save this rule" button | `Grammar`, line 82 | Only toasts | Persist to lesson library |

### 9.5 Vocabulary

| Item | Location | State | Future behavior |
|------|----------|-------|-----------------|
| Word of the day (meticulous) | `Vocabulary`, line 84 | Hard-coded | Daily word from user list / DB |
| Speaker (Volume2) button on word card | `Vocabulary`, line 84 | No `onClick` | TTS pronunciation |
| "Check my sentence" flow | `Vocabulary`, line 84 | Shows a canned "Strong use… 9/10" success box | POST `/api/feedback/vocabulary-check`, real correctness + suggestions + score |
| Character counter (n/200) | `Vocabulary`, line 84 | Cosmetic limit display; no enforcement | Input validation |
| Spaced repetition card ("3 words ready") | `Vocabulary`, line 84 | Static text; "Start review" only toasts | SM-2 algorithm + real queue |
| Vocabulary badge back in sidebar | `Sidebar` | Static "3" | Real due-word count |

### 9.6 Exam prep (IELTS)

| Item | Location | State | Future behavior |
|------|----------|-------|-----------------|
| **Timer** ("Start / Pause", `40:00`) | `Exam`, line 86 | Toggles `running` but `time` is **never decremented** — clock never ticks | Real countdown (setInterval) |
| Essay textarea + word counter ("0 / 250 words") | `Exam`, line 86 | Counter is static "0 / 250" — never updates with typing | Live word count + min-length gate |
| "Submit for scoring" button | `Exam`, line 86 | Only toasts | POST exam attempt → Groq band scoring (task / coherence / lexical / grammar) |
| Scoring criteria strip | `Exam`, line 86 | Static labels | Real per-criterion results + band estimate |
| Prompt | `Exam`, line 86 | One fixed question | Question bank / random generator |

### 9.7 Roleplay / conversation

| Item | Location | State | Future behavior |
|------|----------|-------|-----------------|
| **Bot replies** | `Roleplay`, line 88 (`send`) | Hard-coded script — every reply is the same canned follow-up | Groq as conversation partner; context-aware multi-turn replies |
| "Live practice" green dot | `Roleplay`, line 88 | Static | Real session state |
| Scenario title/level | `Roleplay`, line 88 | Static (job interview / intermediate) | User-selectable scenarios |
| "End & get feedback" button | `Roleplay`, line 88 | Only toasts | Summarize errors + suggest better turns |
| Coach "listening" card | `Roleplay`, line 88 | Static checklist | Preview of what the end-feedback will contain |

### 9.8 Global / infrastructure (missing entirely)

| Item | State |
|------|-------|
| Backend API (Express/Fastify) | Does not exist — see plan §1.3 |
| Database (Supabase) | Does not exist — see plan §1.2 |
| Authentication / user accounts | Does not exist — profile is hard-coded "Arjun" |
| Real AI (Groq/OpenAI) calls | Does not exist — all feedback is mock/local |
| URL routing / deep links | Does not exist — view switching via `useState` only |
| Persistence (localStorage/DB) | Does not exist — state is lost on refresh |
| Timer logic, scoring logic | Not implemented (see 9.6) |
| Tests, linter, CI | Not set up — only `dev`/`build`/`preview` scripts |
| Environment variables / `.env` use | `.env` is git-ignored but nothing reads it yet |

> **Summary:** everything that "looks done" but has no real logic is either a
> button without an `onClick`, a hard-coded constant, a `setTimeout` stand-in,
> or a `notify(...)` toast pretending an action happened. Cross-reference this
> list with **Section 6** (state model) and **Section 7** (next steps) to plan
> the backlog.