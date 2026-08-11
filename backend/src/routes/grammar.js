import { Router } from 'express';
import { z } from 'zod';
import { admin, dbError } from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { isSupabaseConfigured } from '../config.js';
import { local } from '../services/local.js';
const router = Router();
router.get('/grammar', requireAuth, async (req, res, next) => { try {
  if (!isSupabaseConfigured()) { const drill = local.drills[Math.floor(Math.random() * local.drills.length)]; return res.json({ id: drill.id, question: drill.question, options: drill.options, pillar: drill.pillar, difficulty: 3, local_mode: true }); }
  let query = admin().from('grammar_drills').select('id,pillar,question_text,options,difficulty').limit(1);
  if (req.query.pillar) query = query.eq('pillar', req.query.pillar);
  const drills = await dbError(await query); const drill = drills?.[Math.floor(Math.random() * drills.length)];
  if (!drill) throw Object.assign(new Error('No grammar drills are available yet. Run the seed SQL.'), { status: 404 });
  res.json({ id: drill.id, question: drill.question_text, options: drill.options, pillar: drill.pillar, difficulty: drill.difficulty });
} catch (error) { next(error); } });
router.post('/grammar-drill', requireAuth, async (req, res, next) => { try {
  const parsed = z.object({ drill_id: z.number().int().positive(), user_answer: z.string().min(1).max(1) }).safeParse(req.body);
  if (!parsed.success) throw Object.assign(new Error('A drill ID and answer are required.'), { status: 400 });
  if (!isSupabaseConfigured()) { const drill = local.drills.find((item) => item.id === parsed.data.drill_id); if (!drill) throw Object.assign(new Error('Drill not found.'), { status: 404 }); const correct = drill.correct === parsed.data.user_answer.toUpperCase(); local.grammarAttempts.push({ user_id: req.user.id, drill_id: drill.id, correct }); const attempts = local.grammarAttempts.filter((item) => item.user_id === req.user.id && item.drill_id === drill.id); return res.json({ correct, explanation: drill.explanation, pillar: drill.pillar, accuracy_this_pillar: `${attempts.filter((item) => item.correct).length}/${attempts.length}`, local_mode: true }); }
  const drill = await dbError(await admin().from('grammar_drills').select('id,pillar,correct_answer,explanation').eq('id', parsed.data.drill_id).single());
  const correct = drill.correct_answer === parsed.data.user_answer.toUpperCase();
  await dbError(await admin().from('grammar_attempts').insert({ user_id: req.user.id, drill_id: drill.id, user_answer: parsed.data.user_answer.toUpperCase(), correct }));
  const attempts = await dbError(await admin().from('grammar_attempts').select('correct').eq('user_id', req.user.id).eq('drill_id', drill.id));
  const total = attempts.length; const right = attempts.filter((row) => row.correct).length;
  res.json({ correct, explanation: drill.explanation, pillar: drill.pillar, accuracy_this_pillar: `${right}/${total}` });
} catch (error) { next(error); } });
export default router;
