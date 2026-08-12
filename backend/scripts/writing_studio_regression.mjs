import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeWriting } from '../src/services/groq.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CASES = [
  // ---- Category A: CLEAN text (expect ~0 errors, high score) ----
  { id: 'A1', category: 'clean', context: 'Essay', text: 'Yesterday, I read the novel "To Kill a Mockingbird".', expectErrors: 0, note: 'Optional comma before quotation — style, not an error.' },
  { id: 'A2', category: 'clean', context: 'Essay', text: 'Yesterday, I read the novel To Kill a Mockingbird.', expectErrors: 0, note: 'Same sentence, no comma variant — also correct.' },
  { id: 'A3', category: 'clean', context: 'Professional email', text: 'I am a software developer and I work on this project every day.', expectErrors: 0, note: 'Clean professional sentence (audit #14 case).' },
  { id: 'A4', category: 'clean', context: 'Essay', text: 'The results of the experiment were consistent across all three trials, which suggests the method is reliable.', expectErrors: 0, note: 'Clean academic sentence.' },
  { id: 'A5', category: 'clean', context: 'Casual message', text: 'hey how are you doing today hope your weekend was good', expectErrors: 0, note: 'Informal/casual but not ungrammatical for that register.' },
  { id: 'A6', category: 'clean', context: 'Professional email', text: 'Please find attached the quarterly report. Let me know if you have any questions.', expectErrors: 0, note: 'Standard business email.' },
  { id: 'A7', category: 'clean', context: 'Essay', text: 'In conclusion, the evidence presented throughout this essay demonstrates that while technology introduces genuine challenges, its benefits in education, healthcare, and communication far outweigh the drawbacks when applied thoughtfully.', expectErrors: 0, note: 'Long clean formal essay paragraph.' },

  // ---- Category B: REAL grammar errors (expect >=1 error caught) ----
  { id: 'B1', category: 'errors', context: 'Professional email', text: "She don't like coffee, so we should not order any for the meeting.", expectErrorIn: ['don', 'does not'], note: 'Subject-verb agreement (3rd person singular).' },
  { id: 'B2', category: 'errors', context: 'Essay', text: 'Yesterday I go to the store and buy a book about history.', expectErrorIn: ['go', 'went'], note: 'Past tense mismatch.' },
  { id: 'B3', category: 'errors', context: 'Essay', text: 'I have car and I drive it to work every morning.', expectErrorIn: ['car', 'a car'], note: 'Missing article.' },
  { id: 'B4', category: 'errors', context: 'Essay', text: 'There was many people at the conference last week.', expectErrorIn: ['was', 'were'], note: 'There was/were agreement.' },
  { id: 'B5', category: 'errors', context: 'Cover letter', text: 'I am writing to apply for the position witch I saw advertised on your website.', expectErrorIn: ['witch', 'which'], note: 'Wrong word (witch vs which).' },
  { id: 'B6', category: 'errors', context: 'Professional email', text: 'The list of items were reviewed, and the shipment was dispatched this morning.', expectErrorIn: ['were', 'was'], note: 'Head-noun agreement (list ... was).' },
  { id: 'B7', category: 'errors', context: 'Essay', text: 'Each of the students were given a copy of the instructions before the test began.', expectErrorIn: ['were', 'was'], note: 'Each of ... singular verb.' },

  // ---- Category C: STYLE / mechanical choices (should be suggestions, NOT errors) ----
  { id: 'C1', category: 'style', context: 'Professional email', text: 'Please find attached my report. It was written by my team.', expectErrors: 0, note: 'Passive voice is sometimes fine; suggest active voice as suggestion only.' },
  { id: 'C2', category: 'style', context: 'Professional email', text: 'We are very happy to inform you that the project is going very well.', expectErrors: 0, note: '"very" + weak adverb is a style preference, not an error.' },
  { id: 'C3', category: 'style', context: 'Essay', text: 'In conclusion, the evidence shows that technology has made our lives more complicated.', expectErrors: 0, note: 'Standard signposting; fine as-is.' },
  { id: 'C4', category: 'style', context: 'Casual message', text: "Im going to the gym after work, wanna come?", expectErrors: 0, note: 'Contractions/missing apostrophe in casual register — style vs error judgment call.' },
  { id: 'C5', category: 'style', context: 'Professional email', text: 'Due to the fact that we are experiencing a high volume of requests, our team will be responding as soon as possible.', expectErrors: 0, note: 'Wordy but grammatical — flag as concision suggestion, not error.' },

  // ---- Category D: MIXED — real long text with embedded errors + enough length ----
  { id: 'D1', category: 'mixed', context: 'Essay', text: 'In modern society, technology have changed the way we live. Many people thinks that this is a bad development, but I disagree. For example, the internet allow us to communicate instantly with people all over the world. On the other hand, some argue that we spend to much time looking at screens. In my opinion, we should use these tools wisely rather than rejecting them completely.', expectErrors: 3, expectErrorIn: ['have', 'thinks', 'allow', 'to much'], note: 'Several embedded errors + decent length.' },
  { id: 'D2', category: 'mixed', context: 'Cover letter', text: 'Dear Hiring Manager, I am writing to express my interest in the Product Manager position. I have five years of experience in this field and I led a team that launch three successful products. I am confident that my skills would make me a valuable addition to your company. Please find my resume attached.', expectErrors: 1, expectErrorIn: ['launch', 'launched'], note: 'Business tone with one verb-tense error.' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callWithRetry(fn, { label, attempts = 6, baseMs = 1500 } = {}) {
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(); }
    catch (err) {
      const retryAfter = /429|rate_limit_exceeded|tokens per minute/i.test(String(err.message || err));
      if (!retryAfter || i === attempts) throw err;
      const wait = baseMs * Math.pow(2, i - 1);
      console.log(`   … 429 for ${label}, retrying in ${Math.round(wait)}ms (try ${i}/${attempts})`);
      await sleep(wait);
    }
  }
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

function evaluate(raw) {
  const errors = raw.errors || [];
  const suggestions = raw.suggestions || [];
  const breakdown = raw.score_breakdown || {};
  const score = Math.round((Number(breakdown.grammar || 70) + Number(breakdown.tone || 70) + Number(breakdown.vocabulary || 70)) / 3);
  const alts = (raw.alternatives || []).map((a) => typeof a === 'string' ? { improved: a } : a);

  // suggestion quality: has improved field, and improved is not a verbatim echo of the suggestion text
  const goodSugg = suggestions.filter((s) => {
    const improved = String(s.improved || '').trim();
    const base = String(s.text || '').trim();
    return improved.length > base.length * 0.5 && norm(improved) !== norm(base);
  }).length;
  const echoSugg = suggestions.length - goodSugg;

  // alternative quality: word/short-phrase lexical upgrades (improved under ~8 words)
  const goodAlt = alts.filter((a) => String(a.improved || '').trim().split(/\s+/).length <= 8).length;

  return { errors, suggestions, goodSugg, echoSugg, alts, goodAlt, score };
}

async function main() {
  const results = [];
  const concurrency = 2;
  let cursor = 0;
  console.log('=== Linguafy Writing Studio — Regression (industrial quality) ===\n');

  const worker = async (idx) => {
    const c = CASES[idx];
    const started = Date.now();
    try {
      const raw = await callWithRetry(() => analyzeWriting(c.text, c.context), { label: c.id });
      const e = evaluate(raw);
      return { ...c, ok: true, ...e, ms: Date.now() - started, raw };
    } catch (err) {
      return { ...c, ok: false, error: err.message, ms: Date.now() - started };
    }
  };

  const jobs = [];
  while (cursor < CASES.length) {
    const batch = [];
    for (let i = 0; i < concurrency && cursor < CASES.length; i++) { const j = worker(cursor++); batch.push(j); if (i === 0) await sleep(250); }
    jobs.push(...await Promise.all(batch));
  }
  const all = await jobs;

  for (const r of all) {
    results.push(r);
    console.log(`[${r.ok ? 'OK ' : 'ERR'}] ${r.id} (${r.category}) ${r.ms}ms`);
    console.log(`   text: ${r.text.slice(0, 90)}${r.text.length > 90 ? '…' : ''}`);
    if (!r.ok) { console.log(`   FAIL: ${r.error}\n`); continue; }
    console.log(`   score=${r.score}  errors=${r.errors.length}  suggestions=${r.suggestions.length} (${r.goodSugg} actionable)  alternatives=${r.alts.length}`);
    if (r.errors.length) console.log(`   err : ${r.errors.slice(0, 3).map((e) => `"${e.text}"→"${e.should_be}"`).join(' · ')}`);
    if (r.suggestions.length) console.log(`   sugg: ${r.suggestions.slice(0, 2).map((s) => `[${s.type || '?'}] ${(s.improved || '(no fix)').slice(0, 70)}`).join(' ▸ ')}`);
    console.log('');
  }

  console.log('=== SUMMARY ===');
  const clean = results.filter((r) => r.ok && r.category === 'clean');
  const style = results.filter((r) => r.ok && r.category === 'style');
  const err = results.filter((r) => r.ok && r.category === 'errors');
  const mixed = results.filter((r) => r.ok && r.category === 'mixed');
  const fpClean = clean.filter((r) => r.errors.length > 0);
  const fpStyle = style.filter((r) => r.errors.length > 0);
  const recall = err.map((r) => r.errors.some((e) => r.expectErrorIn.some((k) => (norm(e.text) + ' ' + norm(e.should_be)).includes(norm(k)))));
  const mixedRecall = mixed.map((r) => ({ id: r.id, errs: r.errors.map((e) => e.text), // eslint-disable-line
    hit: r.expectErrorIn.some((k) => r.errors.some((e) => (norm(e.text) + ' ' + norm(e.should_be)).includes(norm(k)))) }));
  const allSugg = results.filter((r) => r.ok).flatMap((r) => r.suggestions);
  const actionableRate = allSugg.length ? Math.round(results.filter((r) => r.ok).reduce((s, r) => s + r.goodSugg, 0) / allSugg.length * 100) : 100;
  const altDensity = results.filter((r) => r.ok).reduce((s, r) => s + (r.alts.length ? 1 : 0), 0) / results.filter((r) => r.ok).length;
  const avgScore = Math.round(results.filter((r) => r.ok).reduce((s, r) => s + r.score, 0) / results.filter((r) => r.ok).length);

  const fp = fpClean.length + fpStyle.length;
  const casesN = results.filter((r) => r.ok).length;
  const precision = (1 - fp / casesN) * 100;
  const recallN = [...recall, ...mixedRecall.map((m) => m.hit)].filter(Boolean).length;
  const recallTotal = recall.length + mixedRecall.length;
  const IQI = Math.round((0.4 * precision) + (0.25 * (recallTotal ? (recallN / recallTotal) * 100 : 100)) + (0.2 * actionableRate) + (0.15 * (altDensity * 100)));

  console.log(`Clean false positives: ${fpClean.length}/${clean.length}   Style wrongly-flagged: ${fpStyle.length}/${style.length}`);
  console.log(`Error recall: ${recallN}/${recallTotal}   Actionable suggestions: ${actionableRate}%   Alt coverage: ${Math.round(altDensity * 100)}%   Avg score: ${avgScore}`);
  console.log(`INDUSTRIAL QUALITY INDEX (IQI) = ${IQI}/100`);
  console.log(`  → precision ${Math.round(precision)}% | recall ${Math.round(recallN / recallTotal * 100)}% | sugg-actionability ${actionableRate}% | alt-coverage ${Math.round(altDensity * 100)}%`);

  clean.forEach((r) => { if (r.errors.length) console.log(`   FP clean ${r.id}: ${r.errors.map((e) => e.text).join(' | ')}`); });
  style.forEach((r) => { if (r.errors.length) console.log(`   FP style ${r.id}: ${r.errors.map((e) => e.text).join(' | ')}`); });
  err.forEach((r) => { if (!r.ok) return; console.log(`   ${r.id} caught: ${r.errors.some((e) => r.expectErrorIn.some((k) => (norm(e.text) + ' ' + norm(e.should_be)).includes(norm(k)))) ? 'yes' : 'NO  ← ' + r.errors.map((e) => e.text).join(' | ')}`); });

  if (mixedRecall[0]) console.log(`D1 detected: ${mixedRecall[0].errs.join(' · ') || '(none)'}`);
  if (mixedRecall[1]) console.log(`D2 detected: ${mixedRecall[1].errs.join(' · ') || '(none)'}  (must include "launch")`);

  const stamped = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const outDir = path.join(__dirname, '..', '..', 'audit_work', 'outputs', '20260812-linguafy-audit');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `writing-studio-regression-${stamped}.json`);
  fs.writeFileSync(file, JSON.stringify({ timestamp: new Date().toISOString(), iqi: IQI, precision, recall: Math.round(recallN / recallTotal * 100), actionable: actionableRate, altCoverage: Math.round(altDensity * 100), cases: results.map((r) => ({ id: r.id, ok: r.ok, category: r.category, context: r.context, text: r.text, score: r.score, errors: r.errors, suggestions: r.suggestions, alternatives: r.alts })) }, null, 2));
  console.log(`\nArtifact: ${file}`);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });