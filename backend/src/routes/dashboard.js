import { Router } from 'express';
import { admin, dbError } from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { isSupabaseConfigured } from '../config.js';
import { local } from '../services/local.js';
const router = Router();
const average = (rows, key) => rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length) : 0;
router.get('/progress', requireAuth, async (req, res, next) => { try {
  if (!isSupabaseConfigured()) { const writing = local.writing.filter((item) => item.user_id === req.user.id); const grammar = local.grammarAttempts.filter((item) => item.user_id === req.user.id); const vocabulary = local.vocabulary.filter((item) => item.user_id === req.user.id); const exams = local.exams.filter((item) => item.user_id === req.user.id); const grammar_accuracy = grammar.length ? Math.round(grammar.filter((item) => item.correct).length / grammar.length * 100) : 0; const writing_avg_score = average(writing, 'score'); const vocab_mastery = vocabulary.length ? Math.round(vocabulary.filter((item) => item.mastered).length / vocabulary.length * 100) : 0; return res.json({ user: { name: req.user.name, level: req.user.level }, this_week: { writing_submissions: writing.length, writing_avg_score, grammar_drills: grammar.length, grammar_accuracy, vocab_learned: vocabulary.filter((item) => item.mastered).length, vocab_mastery, exam_attempts: exams.length, exam_avg_band: average(exams, 'band_estimate'), conversations: 0 }, weak_areas: [], recommendations: [], local_mode: true }); }
  const db = admin(); const [profile, writing, grammar, vocabulary, exams, sessions] = await Promise.all([
    dbError(await db.from('users').select('name,language_level').eq('id', req.user.id).maybeSingle()),
    dbError(await db.from('writing_submissions').select('score,created_at').eq('user_id', req.user.id)),
    dbError(await db.from('grammar_attempts').select('correct,created_at').eq('user_id', req.user.id)),
    dbError(await db.from('vocabulary_progress').select('mastered,correct,created_at').eq('user_id', req.user.id)),
    dbError(await db.from('exam_attempts').select('band_estimate,created_at').eq('user_id', req.user.id)),
    dbError(await db.from('conversation_sessions').select('created_at').eq('user_id', req.user.id))
  ]);
  const grammarAccuracy = grammar.length ? Math.round(grammar.filter((row) => row.correct).length / grammar.length * 100) : 0;
  const vocabMastery = vocabulary.length ? Math.round(vocabulary.filter((row) => row.mastered).length / vocabulary.length * 100) : 0;
  const weakAreas = [{ pillar: 'Writing', accuracy: average(writing, 'score') }, { pillar: 'Grammar', accuracy: grammarAccuracy }, { pillar: 'Vocabulary', accuracy: vocabMastery }].filter((item) => item.accuracy > 0).sort((a,b) => a.accuracy - b.accuracy).slice(0, 2);
  res.json({ user: { name: profile?.name || 'Learner', level: profile?.language_level || 'B2' }, this_week: { writing_submissions: writing.length, writing_avg_score: average(writing, 'score'), grammar_drills: grammar.length, grammar_accuracy: grammarAccuracy, vocab_learned: vocabulary.filter((row) => row.mastered).length, vocab_mastery: vocabMastery, exam_attempts: exams.length, exam_avg_band: average(exams, 'band_estimate'), conversations: sessions.length }, weak_areas: weakAreas, recommendations: weakAreas.map((area) => `Practice ${area.pillar.toLowerCase()} — you're at ${area.accuracy}%.`) });
} catch (error) { next(error); } });
export default router;
