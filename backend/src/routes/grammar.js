import { Router } from 'express';
import { z } from 'zod';
import { admin, dbError } from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { isSupabaseConfigured } from '../config.js';
import { local } from '../services/local.js';

const router = Router();
const attemptSchema = z.object({
  drill_id: z.number().int().positive(),
  user_answer: z.string().length(1),
  confidence: z.enum(['sure', 'not_sure']),
  time_spent_seconds: z.number().int().min(0).max(7200)
});
const percentage = (value, total) => total ? Math.round((value / total) * 100) : 0;
const scoreAttempt = (correct, confidence) => correct && confidence === 'sure' ? 1 : 0;

router.get('/grammar', requireAuth, async (req, res, next) => { try {
  const pillar = typeof req.query.pillar === 'string' && req.query.pillar !== 'all' ? req.query.pillar : null;
  if (!isSupabaseConfigured()) {
    const choices = pillar ? local.drills.filter((drill) => drill.pillar === pillar) : local.drills;
    const drill = choices[Math.floor(Math.random() * choices.length)];
    if (!drill) throw Object.assign(new Error('No drills are available for this grammar topic.'), { status: 404 });
    return res.json({ id: drill.id, question: drill.question, options: drill.options, pillar: drill.pillar, difficulty: drill.difficulty, local_mode: true });
  }
  let query = admin().from('grammar_drills').select('id,pillar,question_text,options,difficulty');
  if (pillar) query = query.eq('pillar', pillar);
  const drills = await dbError(await query);
  const drill = drills?.[Math.floor(Math.random() * drills.length)];
  if (!drill) throw Object.assign(new Error('No drills are available for this grammar topic. Run the seed SQL.'), { status: 404 });
  res.json({ id: drill.id, question: drill.question_text, options: drill.options, pillar: drill.pillar, difficulty: drill.difficulty });
} catch (error) { next(error); } });

router.post('/grammar-drill', requireAuth, async (req, res, next) => { try {
  const parsed = attemptSchema.safeParse(req.body);
  if (!parsed.success) throw Object.assign(new Error('A drill ID, answer, confidence selection, and time are required.'), { status: 400 });
  const input = { ...parsed.data, user_answer: parsed.data.user_answer.toUpperCase() };
  if (!isSupabaseConfigured()) {
    const drill = local.drills.find((item) => item.id === input.drill_id);
    if (!drill) throw Object.assign(new Error('Drill not found.'), { status: 404 });
    const correct = drill.correct === input.user_answer;
    const awarded_points = scoreAttempt(correct, input.confidence);
    local.grammarAttempts.push({ user_id: req.user.id, drill_id: drill.id, pillar: drill.pillar, correct, awarded_points, confidence: input.confidence, time_spent_seconds: input.time_spent_seconds, created_at: new Date().toISOString() });
    const attempts = local.grammarAttempts.filter((item) => item.user_id === req.user.id && item.pillar === drill.pillar);
    const earned = attempts.reduce((sum, item) => sum + Number(item.awarded_points || 0), 0);
    const rawCorrect = attempts.filter((item) => item.correct).length;
    return res.json({ correct, awarded_points, explanation: drill.explanation, pillar: drill.pillar, accuracy_this_pillar: `${earned}/${attempts.length}`, credited_accuracy: percentage(earned, attempts.length), raw_accuracy: percentage(rawCorrect, attempts.length), average_time_seconds: Math.round(attempts.reduce((sum, item) => sum + item.time_spent_seconds, 0) / attempts.length), local_mode: true });
  }
  const drill = await dbError(await admin().from('grammar_drills').select('id,pillar,correct_answer,explanation').eq('id', input.drill_id).single());
  const correct = drill.correct_answer === input.user_answer;
  const awarded_points = scoreAttempt(correct, input.confidence);
  await dbError(await admin().from('grammar_attempts').insert({ user_id: req.user.id, drill_id: drill.id, user_answer: input.user_answer, correct, confidence: input.confidence, awarded_points, time_spent_seconds: input.time_spent_seconds }));
  const attempts = await dbError(await admin().from('grammar_attempts').select('correct,awarded_points,time_spent_seconds,grammar_drills!inner(pillar)').eq('user_id', req.user.id).eq('grammar_drills.pillar', drill.pillar));
  const earned = attempts.reduce((sum, item) => sum + Number(item.awarded_points ?? (item.correct ? 1 : 0)), 0);
  const rawCorrect = attempts.filter((item) => item.correct).length;
  res.json({ correct, awarded_points, explanation: drill.explanation, pillar: drill.pillar, accuracy_this_pillar: `${earned}/${attempts.length}`, credited_accuracy: percentage(earned, attempts.length), raw_accuracy: percentage(rawCorrect, attempts.length), average_time_seconds: Math.round(attempts.reduce((sum, item) => sum + Number(item.time_spent_seconds || 0), 0) / attempts.length) });
} catch (error) { next(error); } });

export default router;
