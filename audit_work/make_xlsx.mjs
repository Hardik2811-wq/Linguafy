import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const ROOT = 'D:/hardi/English Trainer';
const outputDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'outputs', '20260812-linguafy-audit');
fs.mkdirSync(outputDir, { recursive: true });

const fileHref = (files) => {
  const first = String(files).split(';')[0].trim().replace(/\\/g, '/');
  return `file:///${ROOT}/${first}`;
};

const rows = [
  { id: 'F-01', priority: 1, module: 'Auth', component: 'Backend auth', status: 'Open', severity: 'Critical', type: 'Security bug', effort: '1-2d', hours: 12, file: 'backend/src/middleware/auth.js; backend/src/services/local.js', lines: 'auth.js:9; local.js:13-16', broken: 'The login check accepts any token starting with "local-", and unknown ids fall back to a default "Learner" account instead of being rejected.', impact: 'Any client can access every protected endpoint without an account, and reads/writes data under a shared default identity.', evidence: 'VERIFIED LIVE: sent "Authorization: Bearer local-banana" -> server returned 200 with a default user profile + progress.', fix: 'Issue signed tokens (HMAC) mapped to real user ids; return 401/404 when the id is unknown. Never fall back to a default account.', test: 'curl -H "Authorization: Bearer local-banana" http://localhost:4000/api/user/progress -> now 200, must be 401.' },
  { id: 'F-02', priority: 2, module: 'Auth', component: 'Backend auth', status: 'Open', severity: 'Critical', type: 'Security bug', effort: '0.5-1d', hours: 6, file: 'backend/src/services/local.js; backend/src/routes/auth.js', lines: 'local.js:14; auth.js:15,30', broken: 'Passwords are stored unhashed in local mode and are returned verbatim in the signup, login and /me responses.', impact: 'If the store or any API response is exposed or sniffed, credentials leak in cleartext.', evidence: 'VERIFIED LIVE: signup and /me both echoed "password":"password123".', fix: 'Hash with bcrypt/argon2; never serialize the password field in any JSON response. (Supabase mode already hashes via admin.createUser.)', test: 'Sign up in local mode and inspect the response body for the raw password.' },
  { id: 'F-03', priority: 3, module: 'Config', component: 'Backend config', status: 'Open', severity: 'High', type: 'Config gap', effort: '0.5d', hours: 4, file: 'backend/.env; backend/.env.example; backend/src/config.js', lines: 'config.js:17,21; .env:1-3', broken: 'GROQ_API_KEY only exists in the git-ignored backend/.env.local. A fresh clone has no key.', impact: 'Every AI route (writing, vocab, exam, conversation) returns 503 "Server is missing: groqApiKey".', evidence: 'VERIFIED LIVE: reproduced the 503 for all four AI routes.', fix: 'Document the key requirement in README + .env.example; add a startup warning when the key is absent.', test: 'Clone fresh, run backend, call /api/feedback/analyze-text.' },
  { id: 'F-04', priority: 4, module: 'Config', component: 'Backend config', status: 'Open', severity: 'High', type: 'Infra risk', effort: '0.5d', hours: 4, file: 'backend/src/config.js; backend/src/services/groq.js', lines: 'config.js:2-3', broken: '.env and .env.local are loaded with CWD-relative paths, so the secrets only load when the server is started from the backend/ folder.', impact: 'Process managers, test harnesses, or deployments launched from another folder silently lose all secrets -> confusing AI outages.', evidence: 'VERIFIED LIVE: same code returned 503 groqApiKey from a different working directory, worked when CWD = backend/.', fix: 'Resolve env paths relative to the module (import.meta.url) or fail fast with a clear error.', test: 'Start "node src/index.js" from the repo root instead of backend/.' },
  { id: 'F-05', priority: 5, module: 'Exam', component: 'Environment defaults', status: 'Open', severity: 'High', type: 'Validation mismatch', effort: '1d', hours: 8, file: 'src/api.js; backend/src/routes/exam.js; src/main.jsx', lines: 'api.js:1; exam.js:10; main.jsx:98', broken: 'UI says "Write at least 250 words", but the client only blocks under 25 words and the backend only requires 150 characters (~25 words). When the 40-min timer hits 0 it just stops counting; work is never auto-submitted.', impact: 'Undersized essays get scored with unreliable band estimates; a user can lose work silently at timeout.', evidence: 'VERIFIED LIVE: a ~30-word essay passed validation and was accepted for scoring.', fix: 'Enforce 250 words on both client and server; decide timer-expiry behaviour (auto-submit or clear warning).', test: 'Submit a 30-word essay -> currently accepted.' },
  { id: 'F-06', priority: 6, module: 'Grammar', component: 'Grammar drills', status: 'Open', severity: 'High', type: 'Bug', effort: '0.5-1d', hours: 6, file: 'backend/src/routes/grammar.js', lines: 'grammar.js:10-12', broken: 'The query applies .limit(1) BEFORE choosing randomly, so the "random" drill is sampled from at most one row. The ?pillar= filter shares the same flaw and difficulty is never surfaced.', impact: 'Users effectively see a single drill; pillar/difficulty filters do not work as intended.', evidence: 'Static + local-mode trace (local mode correctly uses the full array; Supabase mode is broken by the query shape).', fix: 'Fetch the candidate set (or a random offset) then pick randomly; return difficulty.', test: 'Call GET /api/drills/grammar?pillar=subjunctive repeatedly in Supabase mode -> same row.' },
  { id: 'F-07', priority: 7, module: 'Vocabulary', component: 'Vocabulary progress', status: 'Open', severity: 'High', type: 'Logic bug', effort: '0.5d', hours: 4, file: 'backend/src/routes/vocabulary.js', lines: 'vocabulary.js:19,23-25', broken: 'Mastery = correct && attempts >= 3, so the third attempt can mark a word "mastered" even if only the latest answer is correct. The feature promises "three correct uses".', impact: 'Words are falsely mastered; the dashboard "words mastered" stat is inflated.', evidence: 'Static: code path traced for both local and Supabase modes.', fix: 'Count actual correct uses (streak or cumulative corrects) instead of attempts.', test: 'Answer wrong, wrong, right -> currently mastered=true.' },
  { id: 'F-08', priority: 8, module: 'Auth', component: 'Frontend auth/session', status: 'Open', severity: 'High', type: 'Bug', effort: '1d', hours: 8, file: 'src/main.jsx; src/api.js', lines: 'main.jsx:33-40; api.js:3-9', broken: 'Auth is hydrated only from localStorage and never revalidated with /api/auth/me on startup. Expired/stale tokens keep showing a logged-in user until a request fails.', impact: 'Users see a stale session; no refresh path or forced sign-out.', evidence: 'Grep confirmed /api/auth/me is never called by the frontend.', fix: 'On mount, if a token exists call /api/auth/me; on failure clear the session.', test: 'Inject a bogus token in localStorage and reload the app.' },
  { id: 'F-09', priority: 9, module: 'Dashboard', component: 'Dashboard analytics', status: 'Open', severity: 'High', type: 'Missing feature', effort: '1d', hours: 8, file: 'backend/src/routes/dashboard.js', lines: 'dashboard.js:10-21', broken: 'The response is labeled this_week but the DB queries aggregate all rows with no date filter.', impact: 'Weekly chart, accuracy, and counts are lifetime totals and never reset each week.', evidence: 'Static: no created_at filter anywhere in dashboard.js.', fix: 'Add created_at >= now() - interval \'7 days\' to each aggregate.', test: 'Query /api/user/progress, wait a week, numbers never reset.' },
  { id: 'F-10', priority: 10, module: 'Dashboard', component: 'Dashboard recommendations', status: 'Open', severity: 'Medium', type: 'Unused feature', effort: '1d', hours: 8, file: 'backend/src/routes/dashboard.js; src/main.jsx', lines: 'dashboard.js:20-21; main.jsx:74-77', broken: 'The backend computes weak_areas/recommendations but the frontend never reads them. The Overview "Recommended for you" card is hardcoded to "subject-verb agreement" for every user.', impact: 'Personalized recommendations are shown to no one; every user sees the same suggestion.', evidence: 'Grep confirmed the frontend uses neither weak_areas nor recommendations.', fix: 'Wire Overview to weak_areas and render real recommendation text.', test: 'Complete a drill on a pillar; check the Overview recommendation changes.' },
  { id: 'F-11', priority: 11, module: 'Vocabulary', component: 'Vocabulary spaced repetition', status: 'Open', severity: 'Medium', type: 'Incomplete feature', effort: '1-2d', hours: 12, file: 'backend/src/routes/vocabulary.js; src/main.jsx', lines: 'vocabulary.js:24; main.jsx:96', broken: 'next_review is set on every attempt but never queried. "Word of the day" is chosen purely by calendar-day index (floor(time/86400000) % wordCount), so mastered words resurface and the "Spaced repetition" UI card does nothing.', impact: 'The learning science behind the feature is fake; mastered words come back at random.', evidence: 'Static: next_review is written but never read anywhere.', fix: 'Query next_review to select review words; implement a real SRS schedule.', test: 'Master a word, then wait for the calendar index to cycle back to it.' },
  { id: 'F-12', priority: 12, module: 'UI', component: 'Overview / Sidebar UI', status: 'Open', severity: 'Medium', type: 'Hardcoded UI', effort: '0.5-1d', hours: 6, file: 'src/main.jsx', lines: 'main.jsx:63-64,74,77,83', broken: 'The 12-day streak, Upgrade CTA, Vocabulary "3" badge, hero chart heights, "Next question" 45%/100% progress and the inert "View report" button are static. "Save this rule" and "End & review notes" only fire a toast.', impact: 'UI displays fake stats and dead buttons, misleading users.', evidence: 'Static: values are literals in main.jsx.', fix: 'Drive streak/badges/chart from real data; wire or remove dead buttons.', test: 'Click "End & review notes" -> nothing is saved or ended.' },
  { id: 'F-13', priority: 13, module: 'Roleplay', component: 'Roleplay', status: 'Open', severity: 'Medium', type: 'Incomplete feature', effort: '1-2d', hours: 12, file: 'src/main.jsx; backend/src/routes/conversation.js', lines: 'main.jsx:100; conversation.js:10-18', broken: 'Scenario hardcoded to job_interview; no session list, resume flow, or end summary. Local-mode history is an in-memory Map (lost on restart) and the frontend never reloads persisted history on refresh.', impact: 'Conversations cannot be resumed or reviewed after leaving the page.', evidence: 'Live-tested: AI stays in character and keeps context across turns (works); persistence/resume is the gap.', fix: 'Add scenario selection, persist session_id, reload history on mount, implement end-session summary.', test: 'Have a chat, refresh the page -> history resets to the opening line.' },
  { id: 'F-14', priority: 14, module: 'Writing', component: 'Writing coach', status: 'Open', severity: 'Medium', type: 'Prompt quality', effort: '1d', hours: 8, file: 'backend/src/services/groq.js; backend/src/routes/writing.js; src/main.jsx', lines: 'groq.js:19; writing.js:13; main.jsx:88,92', broken: 'Style rewrites are returned as grammar "errors". A clean sentence was flagged with two "errors" (style rewrites) and scored tone 40/100 as "informal".', impact: 'Users are told correct English is wrong, eroding trust in the app.', evidence: 'VERIFIED LIVE: "I am a software developer and I work on this project every day" -> flagged "As a software developer", "every day"->"daily", tone informal.', fix: 'Split true grammar errors from style suggestions; only render genuine errors as corrections; neutral tone scoring.', test: 'Submit a clean professional sentence in Writing studio.' },
  { id: 'F-15', priority: 15, module: 'Vocabulary', component: 'Vocabulary originality', status: 'Open', severity: 'Medium', type: 'Prompt quality', effort: '1d', hours: 8, file: 'backend/src/services/groq.js; backend/src/routes/vocabulary.js', lines: 'groq.js:20; vocabulary.js:19,21', broken: 'Submitting the exact copied context example is accepted as a great original answer. No originality/similarity check exists before or inside the Groq call.', impact: 'Students can copy the sample sentence and receive top marks; the "original use" promise is unenforced.', evidence: 'VERIFIED LIVE: verbatim example -> correct:true, sophistication 8/10.', fix: 'Add a string/embedding similarity guard against examples before calling Groq; instruct Groq to penalize near-duplicates.', test: 'Copy the on-screen example sentence and submit it.' },
  { id: 'F-16', priority: 16, module: 'Build', component: 'Build output', status: 'Open', severity: 'Low', type: 'Deployment risk', effort: '0.5d', hours: 4, file: 'dist/assets/index-DsUaU2xf.js', lines: 'baked API URL', broken: 'The dist/ build on disk has http://localhost:4000 baked in as the API URL.', impact: 'A deploy of the stale dist/ talks to a local address and breaks the live site.', evidence: 'Inspection of dist JS bundle.', fix: 'Rebuild with VITE_API_URL set before deploying.', test: 'grep localhost:4000 dist/assets/*.js.' },
  { id: 'F-17', priority: 17, module: 'Process', component: 'Engineering process', status: 'Open', severity: 'Low', type: 'Missing tooling', effort: '1-2d', hours: 12, file: 'package.json; backend/package.json', lines: 'scripts', broken: 'No automated tests, linter, or CI on either side.', impact: 'Nothing guards regressions; security bugs like F-01 can quietly return.', evidence: 'package.json scripts contain only dev/build/preview/start.', fix: 'Add Vitest + supertest, ESLint, and a GitHub Actions CI pipeline.', test: 'n/a - tooling setup.' },
  { id: 'F-18', priority: 18, module: 'Backend', component: 'Route mounting', status: 'Open', severity: 'Low', type: 'Structural fragility', effort: '0.5d', hours: 4, file: 'backend/src/index.js', lines: 'index.js:53-58', broken: 'Three routers mount under /api/feedback (writing, grammar, vocabulary) with no versioning.', impact: 'Fine today, but any future path overlap silently shadows an endpoint.', evidence: 'Static: three app.use("/api/feedback", router) lines.', fix: 'Version the API (e.g. /api/v1/...) and give each router a unique prefix.', test: 'n/a - refactor.' },
  { id: 'F-19', priority: 19, module: 'Frontend', component: 'Code hygiene', status: 'Open', severity: 'Low', type: 'Dead code', effort: '0.5d', hours: 4, file: 'src/main.jsx; src/api.js', lines: 'main.jsx:12-23', broken: 'Unused `feedback` mock constant and unused Play icon import remain. No URL router, so refresh always lands on Overview.', impact: 'Confusing code; users lose their current view on refresh.', evidence: 'Static: feedback constant is not referenced by any component.', fix: 'Delete the mock; add react-router or a simple hash router.', test: 'Click a module, refresh the page -> view resets.' },
];

const verified = [
  { item: 'Validation (writing)', evidence: 'Empty / 3-char input returns 400, does not reach Groq.', status: 'Working' },
  { item: 'Auth gating - no token', evidence: 'Requests without any token correctly return 401.', status: 'Working' },
  { item: 'Exam band consistency', evidence: 'A full essay scored 8 across all four criteria and band_estimate = 8 (no 0-9 vs 1-10 mix-up).', status: 'Working' },
  { item: 'Conversation AI', evidence: "AI stays in character as interviewer; context carries across turns; grammar notes accurate (i->I, dont->don't).", status: 'Working' },
  { item: 'Vocab nonsense detection', evidence: '"ephemeral is ephemeral" correctly flagged incorrect, sophistication 2/10.', status: 'Working' },
  { item: 'Error handling shape', evidence: 'All routes return a consistent { success:false, error } JSON via errorHandler.', status: 'Working' },
];

const dbChecks = [
  { check: 'Count grammar_drills rows', why: 'Seed has 3; local mode has 2. Confirm production count and pillar coverage.', how: 'SELECT count(*), pillar FROM grammar_drills GROUP BY pillar;' },
  { check: 'Confirm grammar_attempts rows are being written', why: 'Verify attempts actually persist per user.', how: 'SELECT count(*), user_id FROM grammar_attempts GROUP BY user_id;' },
  { check: 'Count vocabulary_words rows', why: 'Seed has 3. Word-of-day cycling depends on this count.', how: 'SELECT count(*) FROM vocabulary_words;' },
  { check: 'vocabulary_progress next_review NULL rate', why: 'If never set, spaced repetition is untestable.', how: 'SELECT count(*) FILTER (WHERE next_review IS NULL), count(*) FROM vocabulary_progress;' },
  { check: 'Count exam_attempts with all 4 criterion scores', why: 'Ensure Groq scores are actually saved.', how: 'SELECT count(*) FILTER (WHERE task_achievement IS NULL OR coherence_cohesion IS NULL OR lexical_resource IS NULL OR grammatical_accuracy IS NULL), count(*) FROM exam_attempts;' },
  { check: 'Count conversation_turns + grammar_notes stored', why: 'Verify turns and notes persist in production.', how: 'SELECT count(*), count(grammar_notes) FROM conversation_turns;' },
  { check: 'writing_submissions score_breakdown populated', why: 'Check score_breakdown is not empty for saved rows.', how: 'SELECT count(*) FILTER (WHERE score_breakdown = \'{}\'::jsonb), count(*) FROM writing_submissions;' },
  { check: 'Check users.language_level distribution', why: 'Confirm signups set a level; check for NULL/empty.', how: 'SELECT language_level, count(*) FROM users GROUP BY language_level;' },
  { check: 'Confirm RLS + orphan handling', why: 'Validate FK constraints prevent orphaned submissions.', how: '\\d writing_submissions' },
].map((r, i) => ({ id: `DB-${i + 1}`, ...r }));

const roadmap = [
  { phase: 'Phase 1 - Critical fixes', order: 1, id: 'F-01', action: 'Kill the local- token auth bypass; signed sessions only.', severity: 'Critical', h: 12 },
  { phase: 'Phase 1 - Critical fixes', order: 2, id: 'F-02', action: 'Hash local-mode passwords; stop echoing passwords in API.', severity: 'Critical', h: 6 },
  { phase: 'Phase 1 - Critical fixes', order: 3, id: 'F-08', action: 'Revalidate session on load via /api/auth/me.', severity: 'High', h: 8 },
  { phase: 'Phase 1 - Critical fixes', order: 4, id: 'F-05', action: 'Enforce 250-word exam minimum; handle timer expiry.', severity: 'High', h: 8 },
  { phase: 'Phase 2 - Correctness', order: 5, id: 'F-04', action: 'Make .env loading path-independent.', severity: 'High', h: 4 },
  { phase: 'Phase 2 - Correctness', order: 6, id: 'F-06', action: 'Make grammar drill selection truly random + pass difficulty.', severity: 'High', h: 6 },
  { phase: 'Phase 2 - Correctness', order: 7, id: 'F-07', action: 'Count correct uses, not attempts, for vocab mastery.', severity: 'High', h: 4 },
  { phase: 'Phase 2 - Correctness', order: 8, id: 'F-09', action: 'Add 7-day date filter to dashboard aggregates.', severity: 'High', h: 8 },
  { phase: 'Phase 2 - Correctness', order: 9, id: 'F-14', action: 'Split grammar errors vs style suggestions in writing prompt + UI.', severity: 'Medium', h: 8 },
  { phase: 'Phase 2 - Correctness', order: 10, id: 'F-15', action: 'Add originality/similarity guard for vocab submissions.', severity: 'Medium', h: 8 },
  { phase: 'Phase 3 - Features', order: 11, id: 'F-10', action: 'Wire weak_areas/recommendations into the Overview.', severity: 'Medium', h: 8 },
  { phase: 'Phase 3 - Features', order: 12, id: 'F-11', action: 'Implement spaced repetition using next_review.', severity: 'Medium', h: 12 },
  { phase: 'Phase 3 - Features', order: 13, id: 'F-13', action: 'Scenario selection + conversation resume + end summary.', severity: 'Medium', h: 12 },
  { phase: 'Phase 3 - Features', order: 14, id: 'F-12', action: 'Replace hardcoded dashboard/sidebar UI with real data.', severity: 'Medium', h: 6 },
  { phase: 'Phase 4 - Hygiene & deploy', order: 15, id: 'F-03', action: 'Document GROQ key requirement + startup check.', severity: 'High', h: 4 },
  { phase: 'Phase 4 - Hygiene & deploy', order: 16, id: 'F-16', action: 'Rebuild dist/ with correct VITE_API_URL.', severity: 'Low', h: 4 },
  { phase: 'Phase 4 - Hygiene & deploy', order: 17, id: 'F-18', action: 'Version API routes; unique prefixes.', severity: 'Low', h: 4 },
  { phase: 'Phase 4 - Hygiene & deploy', order: 18, id: 'F-19', action: 'Delete dead code; add URL routing.', severity: 'Low', h: 4 },
  { phase: 'Phase 4 - Hygiene & deploy', order: 19, id: 'F-17', action: 'Add tests, lint, and CI.', severity: 'Low', h: 12 },
];

const sevColor = { Critical: '7F1D1D', High: 'C2410C', Medium: 'A16207', Low: '1D4ED8' };
const sevOrder = ['Critical', 'High', 'Medium', 'Low'];
const counts = Object.fromEntries(sevOrder.map((s) => [s, rows.filter((r) => r.severity === s).length]));
const totalHours = rows.reduce((s, r) => s + r.hours, 0);

const wb = new ExcelJS.Workbook();
wb.creator = 'Linguafy Audit';
wb.created = new Date();
wb.company = 'Linguafy';

const PANEL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
const darkText = { argb: 'FF111827' };

// ================= Sheet 1: DASHBOARD =================
const dash = wb.addWorksheet('Dashboard');
dash.properties.defaultRowHeight = 22;

dash.mergeCells('A1:H1');
const t = dash.getCell('A1');
t.value = 'Linguafy Code Audit — Dashboard';
t.font = { bold: true, size: 22, color: { argb: 'FFFFFFFF' } };
t.fill = PANEL;
t.alignment = { horizontal: 'center', vertical: 'middle' };
dash.getRow(1).height = 36;

dash.mergeCells('A2:H2');
const s2 = dash.getCell('A2');
s2.value = '19 findings · 2 Critical · 7 High · 6 Medium · 4 Low · ~138 h estimated effort · 4 fix phases';
s2.font = { italic: true, color: { argb: 'FF374151' } };
s2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
s2.alignment = { horizontal: 'center', vertical: 'middle' };

dash.mergeCells('A4:B4');
dash.getCell('A4').value = 'Severity totals';
dash.getCell('A4').font = { bold: true, size: 13 };
const sevLabels = [['C', 'Critical'], ['E', 'High'], ['G', 'Medium'], ['I', 'Low']];
sevLabels.forEach(([col, sev], i) => {
  const lc = dash.getCell(5, i * 2 + 1);
  lc.value = sev;
  lc.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${sevColor[sev]}` } };
  lc.alignment = { horizontal: 'center', vertical: 'middle' };
  const vc = dash.getCell(6, i * 2 + 1);
  vc.value = counts[sev];
  vc.font = { bold: true, size: 20, color: { argb: `FF${sevColor[sev]}` } };
  vc.alignment = { horizontal: 'center', vertical: 'middle' };
  dash.getRow(6).height = 40;
});

dash.mergeCells('A8:B8');
dash.getCell('A8').value = 'Findings by module';
dash.getCell('A8').font = { bold: true, size: 13 };
const modCounts = {};
rows.forEach((r) => { modCounts[r.module] = (modCounts[r.module] || 0) + 1; });
const mods = Object.entries(modCounts).sort((a, b) => b[1] - a[1]);
dash.getCell('A9').value = 'Module';
dash.getCell('B9').value = 'Count';
['A9', 'B9'].forEach((a) => { dash.getCell(a).font = { bold: true }; dash.getCell(a).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }; });
mods.forEach(([m, n], i) => {
  dash.getCell(10 + i, 1).value = m;
  dash.getCell(10 + i, 2).value = n;
  dash.getCell(10 + i, 2).alignment = { horizontal: 'center' };
});

dash.mergeCells('A18:B18');
dash.getCell('A18').value = 'Findings by type';
dash.getCell('A18').font = { bold: true, size: 13 };
const typeCounts = {};
rows.forEach((r) => { typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });
const types = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
dash.getCell('A19').value = 'Type';
dash.getCell('B19').value = 'Count';
['A19', 'B19'].forEach((a) => { dash.getCell(a).font = { bold: true }; dash.getCell(a).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }; });
types.forEach(([ty, n], i) => {
  dash.getCell(20 + i, 1).value = ty;
  dash.getCell(20 + i, 2).value = n;
  dash.getCell(20 + i, 2).alignment = { horizontal: 'center' };
});

// Top risks panel
dash.mergeCells('D4:H4');
dash.getCell('D4').value = 'Top 5 risks — start here';
dash.getCell('D4').font = { bold: true, size: 13 };
const topHdr = ['Priority', 'Component', 'Severity', 'Effort', 'What breaks'];
topHdr.forEach((h, i) => {
  const c = dash.getCell(5, 4 + i);
  c.value = h;
  c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  c.alignment = { horizontal: 'center', vertical: 'middle' };
});
rows.slice(0, 5).forEach((r, i) => {
  const ln = 6 + i;
  dash.getCell(ln, 4).value = r.priority;
  dash.getCell(ln, 4).alignment = { horizontal: 'center', vertical: 'top' };
  dash.getCell(ln, 5).value = r.component;
  dash.getCell(ln, 5).alignment = { vertical: 'top', wrapText: true };
  const sc = dash.getCell(ln, 6);
  sc.value = r.severity;
  sc.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${sevColor[r.severity]}` } };
  sc.alignment = { horizontal: 'center', vertical: 'middle' };
  dash.getCell(ln, 7).value = r.effort;
  dash.getCell(ln, 7).alignment = { horizontal: 'center', vertical: 'top' };
  dash.getCell(ln, 8).value = r.broken;
  dash.getCell(ln, 8).alignment = { vertical: 'top', wrapText: true };
  dash.getRow(ln).height = 60;
});

// Legend / how to use
dash.mergeCells('D12:H12');
dash.getCell('D12').value = 'How to use this workbook';
dash.getCell('D12').font = { bold: true, size: 13 };
dash.mergeCells('D13:H17');
dash.getCell('D13').value =
  '1. Findings tab = the full ledger. Every column is filterable (header arrows).\n' +
  '2. The Status column has a dropdown (Open / In Progress / Fixed / Won\'t Fix). Pick a value — the row auto-colors.\n' +
  '3. Priority and Effort columns have visual bars (drive planning).\n' +
  '4. File cells are hyperlinks — click to jump to the source file.\n' +
  '5. Fix Roadmap tab = the recommended order to fix things (4 phases).\n' +
  '6. Verified Working tab = what passed live testing. DB Checks tab = what still needs the real Supabase DB to confirm.';
dash.getCell('D13').alignment = { vertical: 'top', wrapText: true };
dash.getCell('D13').font = { color: darkText };

dash.mergeCells('A26:D26');
dash.getCell('A26').value = 'Scope: current repository snapshot. Items marked VERIFIED LIVE were reproduced against the running backend. DB row counts could not be verified locally (no Supabase keys configured) — see the DB Checks tab.';
dash.getCell('A26').font = { italic: true, color: { argb: 'FF4B5563' } };
dash.getCell('A26').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
dash.getCell('A26').alignment = { horizontal: 'left', vertical: 'middle' };

dash.getColumn(1).width = 14;
dash.getColumn(2).width = 16;
dash.getColumn(3).width = 3;
dash.getColumn(4).width = 10;
dash.getColumn(5).width = 26;
dash.getColumn(6).width = 12;
dash.getColumn(7).width = 14;
dash.getColumn(8).width = 70;

// ================= Sheet 2: FINDINGS =================
const f = wb.addWorksheet('Findings');
f.views = [{ state: 'frozen', xSplit: 2, ySplit: 4, topLeftCell: 'C5' }];
f.properties.defaultRowHeight = 52;
f.autoFilter = { from: 'A4', to: 'P23' };

f.mergeCells('A1:P1');
f.getCell('A1').value = 'Findings ledger';
f.getCell('A1').font = { bold: true, size: 20, color: { argb: 'FFFFFFFF' } };
f.getCell('A1').fill = PANEL;
f.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
f.getRow(1).height = 34;

f.mergeCells('A2:P2');
f.getCell('A2').value = `Each row is a verified issue, missing feature, or hardcoded value (${rows.length} findings). Status is live-editable via the dropdown in column E.`;
f.getCell('A2').font = { italic: true, color: { argb: 'FF374151' } };
f.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
f.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
f.getRow(2).height = 24;

f.mergeCells('A3:P3');
f.getCell('A3').value = 'Columns: A id · B priority · C module · D component · E status (dropdown) · F severity · G type · H effort · I hours · J file(s) · K lines · L what is broken · M impact · N evidence · O quick fix · P test case';
f.getCell('A3').font = { size: 9, color: { argb: 'FF4338CA' } };
f.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
f.getCell('A3').alignment = { horizontal: 'left', vertical: 'middle' };

const headers = ['ID', 'Priority', 'Module', 'Component', 'Status', 'Severity', 'Type', 'Effort', 'Hours', 'File(s)', 'Lines', 'What is broken', 'Impact', 'Evidence', 'Quick fix', 'Test case'];
headers.forEach((h, i) => {
  const c = f.getCell(4, i + 1);
  c.value = h;
  c.font = { bold: true, color: { argb: 'FF111827' } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D5DB' } };
  c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
});
f.getRow(4).height = 30;

rows.forEach((r, i) => {
  const ln = 5 + i;
  const vals = [r.id, r.priority, r.module, r.component, r.status, r.severity, r.type, r.effort, r.hours, r.file, r.lines, r.broken, r.impact, r.evidence, r.fix, r.test];
  vals.forEach((v, ci) => {
    const c = f.getCell(ln, ci + 1);
    c.value = v;
    c.alignment = { vertical: 'top', wrapText: ci >= 10 };
  });
  // severity cell
  const sc = f.getCell(ln, 6);
  sc.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${sevColor[r.severity]}` } };
  sc.alignment = { horizontal: 'center', vertical: 'middle' };
  // center some columns
  [2, 3, 5, 9].forEach((ci) => { const c = f.getCell(ln, ci); c.alignment = Object.assign({}, c.alignment, { horizontal: 'center', vertical: 'top' }); });
  // hyperlink on file cell
  const fc = f.getCell(ln, 10);
  fc.value = { text: r.file, hyperlink: fileHref(r.file), tooltip: 'Open in editor' };
  fc.font = { color: { argb: 'FF0563C1' }, underline: true };
  f.getRow(ln).height = 64;

  // status dropdown alignment (validation added once as a single range below)
  const st = f.getCell(ln, 5);
  st.alignment = { horizontal: 'center', vertical: 'middle' };
  if (i % 2 === 1) { f.getRow(ln).eachCell({ includeEmpty: false }, (c) => { if (!c.fill || c.fill.fgColor === null || c.fill.fgColor === undefined) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFC' } }; }); }
});

// Single non-overlapping dropdown range for the Status column (avoids the
// overlapping data-validation ranges that make Excel want to repair the file).
f.dataValidations.add('E5:E23', { type: 'list', allowBlank: false, showErrorMessage: true, formulae: ['"Open,In Progress,Fixed,Won\'t Fix"'] });

// Totals row (formulas)
const totals = f.getRow(24);
totals.values = [ 'TOTAL', null, null, 'Findings by severity', null, null, null, 'Total hours', totalHours, null, null,
  { formula: `COUNTIF(F5:F23,"Critical")&" critical / "&COUNTIF(F5:F23,"High")&" high / "&COUNTIF(F5:F23,"Medium")&" medium / "&COUNTIF(F5:F23,"Low")&" low"`, result: `${counts.Critical} critical / ${counts.High} high / ${counts.Medium} medium / ${counts.Low} low` },
  null, null, null, null];
totals.font = { bold: true };
totals.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };

const fWidths = [6, 8, 12, 22, 12, 11, 18, 10, 8, 36, 20, 48, 40, 46, 46, 40];
fWidths.forEach((w, i) => { f.getColumn(i + 1).width = w; });

// Conditional formatting: status coloring (E5:E23)
f.addConditionalFormatting({
  ref: 'E5:E23',
  rules: [
    { type: 'cellIs', operator: 'equal', formulae: ['"Open"'], priority: 1, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFEBEE' }, fgColor: { argb: 'FFFFEBEE' } }, font: { color: { argb: 'FFB71C1C' }, bold: true } } },
    { type: 'cellIs', operator: 'equal', formulae: ['"In Progress"'], priority: 2, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFF8E1' }, fgColor: { argb: 'FFFFF8E1' } }, font: { color: { argb: 'FF9A6C00' }, bold: true } } },
    { type: 'cellIs', operator: 'equal', formulae: ['"Fixed"'], priority: 3, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFE8F5E9' }, fgColor: { argb: 'FFE8F5E9' } }, font: { color: { argb: 'FF1B5E20' }, bold: true } } },
    { type: 'cellIs', operator: 'equal', formulae: ['"Won\'t Fix"'], priority: 4, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFECEFF1' }, fgColor: { argb: 'FFECEFF1' } }, font: { color: { argb: 'FF455A64' }, italic: true } } },
  ],
});

// Data bars on priority and hours — OMITTED on purpose:
// ExcelJS 4.4.0 writes a dataBar <extLst> with an empty/gapped x14:id that Excel
// flags for repair (HRESULT 0x8000ffff on sheet2.xml). Replaced with static
// color coding on the Priority and Hours cells instead, keeping the file valid.
[2, 9].forEach((ci) => {
  for (let ln = 5; ln <= 23; ln++) {
    const cell = f.getCell(ln, ci);
    if (!cell.font) cell.font = {};
    cell.font = { ...cell.font, color: ci === 2 ? { argb: 'FF0D47A1' } : { argb: 'FF37474F' } };
    cell.alignment = Object.assign({}, cell.alignment, { horizontal: 'center', vertical: 'top' });
  }
});

// ================= Sheet 3: FIX ROADMAP =================
const rm = wb.addWorksheet('Fix Roadmap');
rm.views = [{ state: 'frozen', ySplit: 3 }];
rm.properties.defaultRowHeight = 30;
rm.autoFilter = { from: 'A3', to: 'G21' };

rm.mergeCells('A1:G1');
rm.getCell('A1').value = 'Fix Roadmap — recommended order of work';
rm.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
rm.getCell('A1').fill = PANEL;
rm.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
rm.getRow(1).height = 32;

rm.mergeCells('A2:G2');
rm.getCell('A2').value = 'Start with security, then correctness, then features, then hygiene. Each phase ends in a deployable state. ~138 hours total ≈ 3-4 weeks of focused part-time work.';
rm.getCell('A2').font = { italic: true, color: { argb: 'FF374151' } };
rm.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
rm.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

['Phase', '#', 'Finding', 'Recommended action', 'Severity', 'Hours', 'Blocker / note'].forEach((h, i) => {
  const c = rm.getCell(3, i + 1);
  c.value = h;
  c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  c.alignment = { horizontal: 'center', vertical: 'middle' };
});
const phaseColor = { 'Phase 1 - Critical fixes': 'FF7F1D1D', 'Phase 2 - Correctness': 'FFC2410C', 'Phase 3 - Features': 'FFA16207', 'Phase 4 - Hygiene & deploy': 'FF1D4ED8' };
roadmap.forEach((r, i) => {
  const ln = 4 + i;
  rm.getCell(ln, 1).value = r.phase;
  rm.getCell(ln, 1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rm.getCell(ln, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: phaseColor[r.phase] } };
  rm.getCell(ln, 1).alignment = { horizontal: 'center', vertical: 'middle' };
  rm.getCell(ln, 2).value = r.order;
  rm.getCell(ln, 2).alignment = { horizontal: 'center', vertical: 'top' };
  rm.getCell(ln, 3).value = r.id;
  rm.getCell(ln, 3).alignment = { horizontal: 'center', vertical: 'top' };
  rm.getCell(ln, 3).font = { bold: true };
  rm.getCell(ln, 4).value = r.action;
  rm.getCell(ln, 4).alignment = { vertical: 'top', wrapText: true };
  const sc = rm.getCell(ln, 5);
  sc.value = r.severity;
  sc.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${sevColor[r.severity]}` } };
  sc.alignment = { horizontal: 'center', vertical: 'middle' };
  rm.getCell(ln, 6).value = r.h;
  rm.getCell(ln, 6).alignment = { horizontal: 'center', vertical: 'top' };
  const note = rows.find((x) => x.id === r.id);
  rm.getCell(ln, 7).value = note ? note.fix : '';
  rm.getCell(ln, 7).alignment = { vertical: 'top', wrapText: true };
  rm.getRow(ln).height = 40;
});

const rWidths = [24, 5, 8, 44, 11, 8, 60];
rWidths.forEach((w, i) => { rm.getColumn(i + 1).width = w; });

// ================= Sheet 4: VERIFIED WORKING =================
const vw = wb.addWorksheet('Verified Working');
vw.views = [{ state: 'frozen', ySplit: 2 }];
vw.properties.defaultRowHeight = 40;
vw.autoFilter = { from: 'A2', to: 'C7' };

vw.mergeCells('A1:C1');
vw.getCell('A1').value = 'Verified working — confirmed by live testing (do not "fix")';
vw.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
vw.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E20' } };
vw.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

['Item', 'Evidence', 'Status'].forEach((h, i) => {
  const c = vw.getCell(2, i + 1);
  c.value = h;
  c.font = { bold: true };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
});
verified.forEach((v, i) => {
  const ln = 3 + i;
  vw.getCell(ln, 1).value = v.item;
  vw.getCell(ln, 1).font = { bold: true };
  vw.getCell(ln, 2).value = v.evidence;
  vw.getCell(ln, 2).alignment = { vertical: 'top', wrapText: true };
  const sc = vw.getCell(ln, 3);
  sc.value = v.status;
  sc.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E20' } };
  sc.alignment = { horizontal: 'center', vertical: 'middle' };
});
vw.getColumn(1).width = 30;
vw.getColumn(2).width = 90;
vw.getColumn(3).width = 12;

// ================= Sheet 5: DB CHECKS =================
const db = wb.addWorksheet('DB Checks');
db.views = [{ state: 'frozen', ySplit: 2 }];
db.properties.defaultRowHeight = 40;
db.autoFilter = { from: 'A2', to: 'D10' };

db.mergeCells('A1:D1');
db.getCell('A1').value = 'Database checks still to run — requires the real Supabase project (SQL editor)';
db.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
db.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D47A1' } };
db.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

['Check', 'Why it matters', 'SQL to run (Supabase SQL editor)', 'Status'].forEach((h, i) => {
  const c = db.getCell(2, i + 1);
  c.value = h;
  c.font = { bold: true };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
});
dbChecks.forEach((r, i) => {
  const ln = 3 + i;
  db.getCell(ln, 1).value = r.id + ' — ' + r.check;
  db.getCell(ln, 1).font = { bold: true };
  db.getCell(ln, 1).alignment = { vertical: 'top', wrapText: true };
  db.getCell(ln, 2).value = r.why;
  db.getCell(ln, 2).alignment = { vertical: 'top', wrapText: true };
  const sql = db.getCell(ln, 3);
  sql.value = r.how;
  sql.font = { name: 'Consolas', size: 10 };
  sql.alignment = { vertical: 'top', wrapText: true };
  const st = db.getCell(ln, 4);
  st.value = 'Pending';
  st.font = { italic: true, color: { argb: 'FF9A6C00' } };
  st.alignment = { horizontal: 'center', vertical: 'top' };
});
db.dataValidations.add('D3:D11', { type: 'list', allowBlank: false, showErrorMessage: true, formulae: ['"Pending,Checked,NA"'] });
db.getColumn(1).width = 34;
db.getColumn(2).width = 50;
db.getColumn(3).width = 75;
db.getColumn(4).width = 12;

const xlsxPath = path.join(outputDir, 'linguafy-code-audit.xlsx');
await wb.xlsx.writeFile(xlsxPath);
fs.writeFileSync(path.join(outputDir, 'findings.json'), JSON.stringify(
  rows.map((r) => ({ ...r, links: { file: fileHref(r.file) } })),
  null, 2
));
console.log('WROTE', xlsxPath, fs.statSync(xlsxPath).size, 'bytes');
console.log('sheets:', wb.worksheets.map((s) => s.name).join(', '));
console.log('counts:', JSON.stringify(counts), '| total hours:', totalHours);