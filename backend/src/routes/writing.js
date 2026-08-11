import { Router } from 'express';
import { z } from 'zod';
import { analyzeWriting } from '../services/groq.js';
import { admin, dbError } from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { isSupabaseConfigured } from '../config.js';
import { local } from '../services/local.js';
const router = Router();
const input = z.object({ text: z.string().trim().min(8).max(2000), context: z.string().trim().min(2).max(50) });
router.post('/analyze-text', requireAuth, async (req, res, next) => { try {
  const parsed = input.safeParse(req.body); if (!parsed.success) throw Object.assign(new Error('Write between 8 and 2,000 characters.'), { status: 400 });
  const result = await analyzeWriting(parsed.data.text, parsed.data.context);
  const breakdown = result.score_breakdown || {}; const score = Math.round((Number(breakdown.grammar || 70) + Number(breakdown.tone || 70) + Number(breakdown.vocabulary || 70)) / 3);
  if (!isSupabaseConfigured()) { const submission_id = crypto.randomUUID(); local.writing.push({ id: submission_id, user_id: req.user.id, score, created_at: new Date().toISOString() }); return res.json({ success: true, feedback: result, score, submission_id, local_mode: true }); }
  const saved = await dbError(await admin().from('writing_submissions').insert({ user_id: req.user.id, text: parsed.data.text, context: parsed.data.context, errors: result.errors || [], suggestions: result.suggestions || [], tone_assessment: result.tone_feedback || result.tone, vocabulary_alternatives: result.alternatives || [], score, score_breakdown: breakdown }).select('id').single());
  res.json({ success: true, feedback: result, score, submission_id: saved.id });
} catch (error) { next(error); } });
export default router;
