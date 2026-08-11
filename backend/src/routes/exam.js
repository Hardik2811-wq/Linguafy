import { Router } from 'express';
import { z } from 'zod';
import { scoreEssay } from '../services/groq.js';
import { admin, dbError } from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { isSupabaseConfigured } from '../config.js';
import { local } from '../services/local.js';
const router = Router();
router.post('/submit', requireAuth, async (req, res, next) => { try {
  const parsed = z.object({ exam_type: z.string().default('IELTS'), task_type: z.string().default('Writing Task 2'), essay_text: z.string().trim().min(150).max(4000) }).safeParse(req.body);
  if (!parsed.success) throw Object.assign(new Error('Your essay needs at least 150 characters.'), { status: 400 });
  const words = parsed.data.essay_text.split(/\s+/).length; const score = await scoreEssay(parsed.data.essay_text);
  if (!isSupabaseConfigured()) { const attempt_id = crypto.randomUUID(); local.exams.push({ id: attempt_id, user_id: req.user.id, band_estimate: score.band_estimate }); return res.json({ success: true, scores: { task_achievement: score.task_achievement, coherence: score.coherence_cohesion, lexical: score.lexical_resource, grammar: score.grammatical_accuracy, band_estimate: score.band_estimate }, feedback: score.feedback, common_errors: score.common_errors || [], attempt_id, local_mode: true }); }
  const attempt = await dbError(await admin().from('exam_attempts').insert({ user_id: req.user.id, exam_type: parsed.data.exam_type, task_type: parsed.data.task_type, essay_text: parsed.data.essay_text, word_count: words, task_achievement: score.task_achievement, coherence_cohesion: score.coherence_cohesion, lexical_resource: score.lexical_resource, grammatical_accuracy: score.grammatical_accuracy, band_estimate: score.band_estimate, feedback: { feedback: score.feedback, common_errors: score.common_errors || [] } }).select('id').single());
  res.json({ success: true, scores: { task_achievement: score.task_achievement, coherence: score.coherence_cohesion, lexical: score.lexical_resource, grammar: score.grammatical_accuracy, band_estimate: score.band_estimate }, feedback: score.feedback, common_errors: score.common_errors || [], attempt_id: attempt.id });
} catch (error) { next(error); } });
export default router;
