import { Router } from 'express';
import { z } from 'zod';
import { checkVocabulary } from '../services/groq.js';
import { admin, dbError } from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { isSupabaseConfigured } from '../config.js';
import { local } from '../services/local.js';
const router = Router();
const usesWord = (word, sentence) => sentence.toLowerCase().includes(word.toLowerCase());
router.get('/daily', requireAuth, async (_req, res, next) => { try {
  if (!isSupabaseConfigured()) return res.json({ ...local.words[Math.floor((Date.now() / 86400000) % local.words.length)], local_mode: true });
  const words = await dbError(await admin().from('vocabulary_words').select('*').order('id'));
  if (!words?.length) throw Object.assign(new Error('No vocabulary words are available yet. Run the seed SQL.'), { status: 404 });
  const word = words[Math.floor((Date.now() / 86400000) % words.length)];
  res.json({ word_id: word.id, word: word.word, definition: word.definition, context_examples: word.context_examples || [word.context_sentence], difficulty: word.difficulty, category: word.category });
} catch (error) { next(error); } });
router.post('/vocabulary-check', requireAuth, async (req, res, next) => { try {
  const parsed = z.object({ word_id: z.number().int().positive(), user_sentence: z.string().trim().min(5).max(500) }).safeParse(req.body);
  if (!parsed.success) throw Object.assign(new Error('Write a sentence between 5 and 500 characters.'), { status: 400 });
  if (!isSupabaseConfigured()) { const word = local.words.find((item) => item.word_id === parsed.data.word_id); if (!word) throw Object.assign(new Error('Word not found.'), { status: 404 }); if (!usesWord(word.word, parsed.data.user_sentence)) return res.json({ success: true, correct: false, sophistication_score: 0, feedback: `You haven't used the word "${word.word}" yet — try writing a sentence that includes it.`, better_version: null, mastered: false, user_progress: { attempts: 0, correct: 0 }, local_mode: true }); const verdict = await checkVocabulary(word.word, parsed.data.user_sentence); const correct = Boolean(verdict.word_correct && verdict.grammar_correct); const old = local.vocabulary.find((item) => item.user_id === req.user.id && item.word_id === word.word_id); const attempts = (old?.attempts || 0) + 1; const record = { user_id: req.user.id, word_id: word.word_id, attempts, mastered: correct && attempts >= 3 }; if (old) Object.assign(old, record); else local.vocabulary.push(record); return res.json({ success: true, correct, sophistication_score: verdict.sophistication_score, feedback: verdict.feedback, better_version: verdict.better_version, mastered: record.mastered, user_progress: { attempts, correct: correct ? 1 : 0 }, local_mode: true }); }
  const word = await dbError(await admin().from('vocabulary_words').select('id,word').eq('id', parsed.data.word_id).single());
  if (!usesWord(word.word, parsed.data.user_sentence)) return res.json({ success: true, correct: false, sophistication_score: 0, feedback: `You haven't used the word "${word.word}" yet — try writing a sentence that includes it.`, better_version: null, mastered: false, user_progress: { attempts: 0, correct: 0 } });
  const verdict = await checkVocabulary(word.word, parsed.data.user_sentence);
  const correct = Boolean(verdict.word_correct && verdict.grammar_correct); const existing = await dbError(await admin().from('vocabulary_progress').select('*').eq('user_id', req.user.id).eq('word_id', word.id).maybeSingle());
  const attempts = (existing?.attempts || 0) + 1; const mastered = correct && attempts >= 3;
  const progress = await dbError(await admin().from('vocabulary_progress').upsert({ id: existing?.id, user_id: req.user.id, word_id: word.id, user_sentence: parsed.data.user_sentence, correct, score: verdict.sophistication_score, attempts, mastered, last_attempt: new Date().toISOString(), next_review: new Date(Date.now() + (mastered ? 7 : 1) * 86400000).toISOString() }, { onConflict: 'user_id,word_id' }).select('attempts,mastered').single());
  res.json({ success: true, correct, sophistication_score: verdict.sophistication_score, feedback: verdict.feedback, better_version: verdict.better_version, mastered: progress.mastered, user_progress: { attempts: progress.attempts, correct: correct ? 1 : 0 } });
} catch (error) { next(error); } });
export default router;
