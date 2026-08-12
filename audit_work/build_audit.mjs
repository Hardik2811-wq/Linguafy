import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = path.join(process.cwd(), 'outputs', '20260812-linguafy-audit');
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const summary = workbook.worksheets.add('Summary');
const findings = workbook.worksheets.add('Findings');

const rows = [
  {
    priority: 1,
    component: 'Backend auth',
    status: 'Open',
    severity: 'Critical',
    type: 'Security bug',
    effort: '1-2d',
    file: 'backend/src/middleware/auth.js; backend/src/services/local.js',
    lines: 'auth.js:9; local.js:13-16',
    notes:
      'Any bearer token that starts with "local-" is accepted, and local.user() falls back to a default learner for unknown ids. A forged token reaches protected endpoints. VERIFIED LIVE: Bearer local-banana returned 200 with a default user profile.',
  },
  {
    priority: 2,
    component: 'Backend auth',
    status: 'Open',
    severity: 'Critical',
    type: 'Security bug',
    effort: '0.5-1d',
    file: 'backend/src/services/local.js; backend/src/routes/auth.js',
    lines: 'local.js:14; auth.js:15,30',
    notes:
      'Passwords are stored in plaintext in local mode and are returned verbatim in the signup, login, and /api/auth/me JSON responses. VERIFIED LIVE: signup and /me both echoed "password":"password123".',
  },
  {
    priority: 3,
    component: 'Backend config',
    status: 'Open',
    severity: 'High',
    type: 'Config gap',
    effort: '0.5d',
    file: 'backend/.env; backend/.env.example; backend/src/config.js',
    lines: 'config.js:17,21; .env:1-3',
    notes:
      'GROQ_API_KEY is only in the git-ignored backend/.env.local. A fresh clone has no key, so every AI route (writing, vocab, exam, conversation) returns 503 "Server is missing: groqApiKey".',
  },
  {
    priority: 4,
    component: 'Backend config',
    status: 'Open',
    severity: 'High',
    type: 'Infra risk',
    effort: '0.5d',
    file: 'backend/src/config.js; backend/src/services/groq.js',
    lines: 'config.js:2-3',
    notes:
      '.env and .env.local are loaded with CWD-relative paths. If the server is started from anywhere other than the backend/ folder, secrets silently fail to load and AI features break with no hint. VERIFIED LIVE: same code returned 503 when run from a different working directory.',
  },
  {
    priority: 5,
    component: 'Environment defaults',
    status: 'Open',
    severity: 'High',
    type: 'Validation mismatch',
    effort: '1d',
    file: 'src/api.js; backend/src/routes/exam.js; src/main.jsx',
    lines: 'api.js:1; exam.js:10; main.jsx:98',
    notes:
      'The UI claims "Write at least 250 words" and the IELTS prompt says 250, but the client only blocks under 25 words and the backend only requires 150 characters (~25 words). VERIFIED LIVE: a ~30-word essay passed validation and was accepted for scoring.',
  },
  {
    priority: 6,
    component: 'Grammar drills',
    status: 'Open',
    severity: 'High',
    type: 'Bug',
    effort: '0.5-1d',
    file: 'backend/src/routes/grammar.js',
    lines: 'grammar.js:10-12',
    notes:
      'The DB query uses .limit(1) before randomization, so the "random" drill is effectively sampled from at most one row per request. The ?pillar= filter relies on the same brittle query shape, and difficulty is never surfaced to the UI.',
  },
  {
    priority: 7,
    component: 'Vocabulary progress',
    status: 'Open',
    severity: 'High',
    type: 'Logic bug',
    effort: '0.5d',
    file: 'backend/src/routes/vocabulary.js',
    lines: 'vocabulary.js:19,23-25',
    notes:
      'Mastery is computed as correct && attempts >= 3, so the third attempt can mark a word mastered even if only the latest answer is correct. The feature promises "three correct uses" but counts attempts.',
  },
  {
    priority: 8,
    component: 'Frontend auth/session',
    status: 'Open',
    severity: 'High',
    type: 'Bug',
    effort: '1d',
    file: 'src/main.jsx; src/api.js',
    lines: 'main.jsx:33-40; api.js:3-9',
    notes:
      'Auth is hydrated only from localStorage and never revalidated with /api/auth/me on startup. Expired or stale sessions remain visible until a request fails, and there is no refresh path or forced sign-out.',
  },
  {
    priority: 9,
    component: 'Dashboard analytics',
    status: 'Open',
    severity: 'High',
    type: 'Missing feature',
    effort: '1d',
    file: 'backend/src/routes/dashboard.js',
    lines: 'dashboard.js:10-21',
    notes:
      'The response is labeled this_week, but the DB queries aggregate all rows with no date filter. The numbers are lifetime totals, so the weekly chart, accuracy, and counts are wrong.',
  },
  {
    priority: 10,
    component: 'Dashboard recommendations',
    status: 'Open',
    severity: 'Medium',
    type: 'Unused feature',
    effort: '1d',
    file: 'backend/src/routes/dashboard.js; src/main.jsx',
    lines: 'dashboard.js:20-21; main.jsx:74-77',
    notes:
      'The backend computes weak_areas and recommendations, but the frontend never reads them (grep confirmed). The Overview recommendation card is hardcoded to "subject-verb agreement" for every user.',
  },
  {
    priority: 11,
    component: 'Vocabulary spaced repetition',
    status: 'Open',
    severity: 'Medium',
    type: 'Incomplete feature',
    effort: '1-2d',
    file: 'backend/src/routes/vocabulary.js; src/main.jsx',
    lines: 'vocabulary.js:24; main.jsx:96',
    notes:
      'next_review is set on every attempt but never queried. Word of the day is chosen purely by calendar-day index (Math.floor(Date.now()/86400000) % wordCount), so mastered words resurface and the "Spaced repetition" UI card is pure theater.',
  },
  {
    priority: 12,
    component: 'Overview / Sidebar UI',
    status: 'Open',
    severity: 'Medium',
    type: 'Hardcoded UI',
    effort: '0.5-1d',
    file: 'src/main.jsx',
    lines: 'main.jsx:63-64,74,77,83',
    notes:
      'The 12-day streak, Upgrade plan CTA, Vocabulary "3" badge, hero chart heights, "Next question" progress (45%/100%), and the inert "View report" button are static. "Save this rule" and "End & review notes" only show a toast; nothing is saved or ended.',
  },
  {
    priority: 13,
    component: 'Roleplay',
    status: 'Open',
    severity: 'Medium',
    type: 'Incomplete feature',
    effort: '1-2d',
    file: 'src/main.jsx; backend/src/routes/conversation.js',
    lines: 'main.jsx:100; conversation.js:10-18',
    notes:
      'Scenario is hardcoded to job_interview, there is no session list, resume flow, or end-session summary. In local mode history lives in an in-memory Map (lost on restart) and the frontend never reloads a persisted history on refresh.',
  },
  {
    priority: 14,
    component: 'Writing coach',
    status: 'Open',
    severity: 'Medium',
    type: 'Prompt quality',
    effort: '1d',
    file: 'backend/src/services/groq.js; backend/src/routes/writing.js; src/main.jsx',
    lines: 'groq.js:19; writing.js:13; main.jsx:88,92',
    notes:
      'VERIFIED LIVE: a clean sentence ("I am a software developer and I work on this project every day") was flagged with two "errors" that are actually style rewrites ("As a software developer", "every day" -> "daily"), and scored tone 40/100 as "informal". Style improvements are being mislabeled as grammar errors and shown as red wrong->right corrections.',
  },
  {
    priority: 15,
    component: 'Vocabulary originality',
    status: 'Open',
    severity: 'Medium',
    type: 'Prompt quality',
    effort: '1d',
    file: 'backend/src/services/groq.js; backend/src/routes/vocabulary.js',
    lines: 'groq.js:20; vocabulary.js:19,21',
    notes:
      'VERIFIED LIVE: submitting the exact copied context example verbatim returned correct:true with sophistication 8/10. No originality/similarity check exists before or inside the Groq call (no string-similarity guard, no "reword it" instruction).',
  },
  {
    priority: 16,
    component: 'Build output',
    status: 'Open',
    severity: 'Low',
    type: 'Deployment risk',
    effort: '0.5d',
    file: 'dist/assets/index-DsUaU2xf.js',
    lines: 'baked API URL',
    notes:
      'The dist/ build on disk has http://localhost:4000 baked in as the API URL. It is stale and must be rebuilt (with VITE_API_URL set) before any deploy.',
  },
  {
    priority: 17,
    component: 'Engineering process',
    status: 'Open',
    severity: 'Low',
    type: 'Missing tooling',
    effort: '1-2d',
    file: 'package.json; backend/package.json',
    lines: 'scripts',
    notes:
      'No automated tests, linter, or CI are configured on either side. Nothing guards regressions like the auth bypass or word-count mismatch.',
  },
  {
    priority: 18,
    component: 'Route mounting',
    status: 'Open',
    severity: 'Low',
    type: 'Structural fragility',
    effort: '0.5d',
    file: 'backend/src/index.js',
    lines: 'index.js:53-58',
    notes:
      'Three routers mount under /api/feedback (writing, grammar, vocabulary) and the shared path carries no versioning. Today the POST paths are unique, but any future path overlap silently shadows an endpoint.',
  },
  {
    priority: 19,
    component: 'Code hygiene',
    status: 'Open',
    severity: 'Low',
    type: 'Dead code',
    effort: '0.5d',
    file: 'src/main.jsx; src/api.js',
    lines: 'main.jsx:12-23; api.js',
    notes:
      'The unused `feedback` mock constant (lines 12-23) and the unused Play icon import remain from the prototype. Also the frontend has no URL router: refresh always lands on Overview.',
  },
];

const severityOrder = ['Critical', 'High', 'Medium', 'Low'];
const severityColors = {
  Critical: { fill: '#7F1D1D', font: '#FFFFFF' },
  High: { fill: '#C2410C', font: '#FFFFFF' },
  Medium: { fill: '#A16207', font: '#FFFFFF' },
  Low: { fill: '#1D4ED8', font: '#FFFFFF' },
};

const dataStart = 5;
const lastRow = dataStart + rows.length - 1; // 23 for 19 findings

// Summary sheet
summary.showGridLines = false;
summary.getRange('A1:H1').merge();
summary.getRange('A1').values = [['Linguafy Code Audit']];
summary.getRange('A2:H2').merge();
summary.getRange('A2').values = [['Prioritized findings from the current code snapshot. Items marked VERIFIED LIVE were reproduced against the running backend.']];
summary.getRange('A3:H3').merge();
summary.getRange('A3').values = [['Counts are driven directly from the Findings sheet below.']];

summary.getRange('A4:B4').merge();
summary.getRange('A4').values = [['Critical']];
summary.getRange('A5:B6').merge();
summary.getRange('A5').formulas = [[`=COUNTIF('Findings'!$D$${dataStart}:$D$${lastRow},"Critical")`]];

summary.getRange('C4:D4').merge();
summary.getRange('C4').values = [['High']];
summary.getRange('C5:D6').merge();
summary.getRange('C5').formulas = [[`=COUNTIF('Findings'!$D$${dataStart}:$D$${lastRow},"High")`]];

summary.getRange('E4:F4').merge();
summary.getRange('E4').values = [['Medium']];
summary.getRange('E5:F6').merge();
summary.getRange('E5').formulas = [[`=COUNTIF('Findings'!$D$${dataStart}:$D$${lastRow},"Medium")`]];

summary.getRange('G4:H4').merge();
summary.getRange('G4').values = [['Low']];
summary.getRange('G5:H6').merge();
summary.getRange('G5').formulas = [[`=COUNTIF('Findings'!$D$${dataStart}:$D$${lastRow},"Low")`]];

summary.getRange('A8:F8').merge();
summary.getRange('A8').values = [['Top risks']];
summary.getRange('A9:F9').values = [[
  'Priority',
  'Component',
  'Severity',
  'Type',
  'Effort',
  'Issue snapshot',
]];

for (let i = 0; i < 5; i += 1) {
  const row = 10 + i;
  const sourceRow = dataStart + i;
  summary.getRange(`A${row}`).formulas = [[`='Findings'!A${sourceRow}`]];
  summary.getRange(`B${row}`).formulas = [[`='Findings'!B${sourceRow}`]];
  summary.getRange(`C${row}`).formulas = [[`='Findings'!D${sourceRow}`]];
  summary.getRange(`D${row}`).formulas = [[`='Findings'!E${sourceRow}`]];
  summary.getRange(`E${row}`).formulas = [[`='Findings'!F${sourceRow}`]];
  summary.getRange(`F${row}`).formulas = [[`='Findings'!I${sourceRow}`]];
}

summary.getRange('A16:F16').merge();
summary.getRange('A16').values = [['Scope: current repository snapshot only. Estimates are rough implementation effort, not elapsed time. DB row counts could not be verified locally (no Supabase keys configured).']];

summary.getRange('A1:H16').format.font = { name: 'Aptos', size: 11, color: '#1F2937' };
summary.getRange('A1:H1').format = {
  fill: '#111827',
  font: { bold: true, color: '#FFFFFF', size: 20 },
  alignment: { horizontal: 'center', vertical: 'center' },
};
summary.getRange('A2:H2').format = {
  fill: '#F3F4F6',
  font: { color: '#374151', italic: true },
  alignment: { horizontal: 'center', vertical: 'center' },
};
summary.getRange('A3:H3').format = {
  fill: '#EEF2FF',
  font: { color: '#4338CA' },
  alignment: { horizontal: 'center', vertical: 'center' },
};

for (const [labelRange, valueRange, color] of [
  ['A4:B4', 'A5:B6', '#7F1D1D'],
  ['C4:D4', 'C5:D6', '#C2410C'],
  ['E4:F4', 'E5:F6', '#A16207'],
  ['G4:H4', 'G5:H6', '#1D4ED8'],
]) {
  summary.getRange(labelRange).format = {
    fill: color,
    font: { bold: true, color: '#FFFFFF' },
    alignment: { horizontal: 'center', vertical: 'center' },
  };
  summary.getRange(valueRange).format = {
    fill: '#FFFFFF',
    font: { bold: true, size: 18, color: color },
    alignment: { horizontal: 'center', vertical: 'center' },
  };
}

summary.getRange('A8:F8').format = {
  fill: '#0F172A',
  font: { bold: true, color: '#FFFFFF' },
  alignment: { horizontal: 'left', vertical: 'center' },
};
summary.getRange('A9:F9').format = {
  fill: '#E5E7EB',
  font: { bold: true, color: '#111827' },
  alignment: { horizontal: 'center', vertical: 'center' },
};
summary.getRange('A10:F14').format = {
  alignment: { vertical: 'top' },
  wrapText: true,
};
summary.getRange('A16:F16').format = {
  fill: '#F9FAFB',
  font: { italic: true, color: '#4B5563' },
  alignment: { horizontal: 'left', vertical: 'center' },
};

summary.getRange('A').format.columnWidthPx = 78;
summary.getRange('B').format.columnWidthPx = 156;
summary.getRange('C').format.columnWidthPx = 88;
summary.getRange('D').format.columnWidthPx = 112;
summary.getRange('E').format.columnWidthPx = 76;
summary.getRange('F').format.columnWidthPx = 280;
summary.getRange('A1:H16').format.rowHeightPx = 24;
summary.getRange('A5:H6').format.rowHeightPx = 36;
summary.getRange('A10:F14').format.rowHeightPx = 42;
summary.getRange('A16:F16').format.rowHeightPx = 30;

// Findings sheet
findings.showGridLines = false;
findings.freezePanes.freezeRows(4);
findings.getRange('A1:I1').merge();
findings.getRange('A1').values = [['Findings']];
findings.getRange('A2:I2').merge();
findings.getRange('A2').values = [[`Each row is a verified issue, missing feature, or hardcoded value found in the current code snapshot (${rows.length} findings). Items marked VERIFIED LIVE were reproduced against the running backend.`]];
findings.getRange('A3:I3').merge();
findings.getRange('A3').values = [['Status is kept open because these are audit findings, not fixed items.']];

findings.getRange('A4:I4').values = [[
  'Priority',
  'Component',
  'Status',
  'Severity',
  'Type',
  'Effort',
  'File',
  'Lines',
  'Notes',
]];

for (let i = 0; i < rows.length; i += 1) {
  const r = rows[i];
  const rowNum = dataStart + i;
  findings.getRange(`A${rowNum}:I${rowNum}`).values = [[
    r.priority,
    r.component,
    r.status,
    r.severity,
    r.type,
    r.effort,
    r.file,
    r.lines,
    r.notes,
  ]];

  const sev = severityColors[r.severity] || severityColors.Low;
  findings.getRange(`D${rowNum}`).format = {
    fill: sev.fill,
    font: { bold: true, color: sev.font },
    alignment: { horizontal: 'center', vertical: 'center' },
  };

  findings.getRange(`A${rowNum}:C${rowNum}`).format = {
    alignment: { vertical: 'top' },
  };
  findings.getRange(`E${rowNum}:H${rowNum}`).format = {
    alignment: { vertical: 'top' },
  };
  findings.getRange(`I${rowNum}`).format = {
    alignment: { vertical: 'top' },
    wrapText: true,
  };

  if (i % 2 === 1) {
    findings.getRange(`A${rowNum}:I${rowNum}`).format = {
      fill: '#FAFAFC',
      alignment: { vertical: 'top' },
      wrapText: true,
    };
    findings.getRange(`D${rowNum}`).format = {
      fill: sev.fill,
      font: { bold: true, color: sev.font },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
  }
}

findings.getRange('A1:I1').format = {
  fill: '#111827',
  font: { bold: true, color: '#FFFFFF', size: 20 },
  alignment: { horizontal: 'center', vertical: 'center' },
};
findings.getRange('A2:I2').format = {
  fill: '#F3F4F6',
  font: { color: '#374151', italic: true },
  alignment: { horizontal: 'center', vertical: 'center' },
};
findings.getRange('A3:I3').format = {
  fill: '#EEF2FF',
  font: { color: '#4338CA' },
  alignment: { horizontal: 'center', vertical: 'center' },
};
findings.getRange('A4:I4').format = {
  fill: '#E5E7EB',
  font: { bold: true, color: '#111827' },
  alignment: { horizontal: 'center', vertical: 'center' },
};

findings.getRange('A').format.columnWidthPx = 70;
findings.getRange('B').format.columnWidthPx = 146;
findings.getRange('C').format.columnWidthPx = 86;
findings.getRange('D').format.columnWidthPx = 88;
findings.getRange('E').format.columnWidthPx = 124;
findings.getRange('F').format.columnWidthPx = 84;
findings.getRange('G').format.columnWidthPx = 220;
findings.getRange('H').format.columnWidthPx = 182;
findings.getRange('I').format.columnWidthPx = 420;
findings.getRange(`A1:I${lastRow}`).format.rowHeightPx = 28;
findings.getRange(`A${dataStart}:I${lastRow}`).format.rowHeightPx = 44;

await workbook.inspect({
  kind: 'workbook,sheet',
  maxChars: 4000,
  tableMaxRows: 4,
  tableMaxCols: 8,
  tableMaxCellChars: 60,
});

for (const [sheetName, range] of [
  ['Summary', 'A1:F16'],
  ['Findings', `A1:I${lastRow}`],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1.1, format: 'png', autoCrop: 'all' });
  await fs.writeFile(path.join(outputDir, `${sheetName.toLowerCase()}-preview.png`), new Uint8Array(await preview.arrayBuffer()));
}

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(path.join(outputDir, 'linguafy-code-audit.xlsx'));

console.log(`Saved to ${path.join(outputDir, 'linguafy-code-audit.xlsx')}`);