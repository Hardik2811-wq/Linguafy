import { Router } from 'express';
import { z } from 'zod';
import { checkVocabulary } from '../services/groq.js';
import { admin, dbError } from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { isSupabaseConfigured } from '../config.js';
import { local } from '../services/local.js';

const router = Router();
const levels = { basic: [1], intermediate: [2, 3], advanced: [4], hard: [5] };
const checkSchema = z.object({ word_id: z.number().int().positive(), user_sentence: z.string().trim().min(5).max(500), time_spent_seconds: z.number().int().min(0).max(7200) });
const usesWord = (word, sentence) => sentence.toLowerCase().includes(word.toLowerCase());
const difficultyLevel = (difficulty) => Object.entries(levels).find(([, values]) => values.includes(difficulty))?.[0] || 'intermediate';
const pickWord = (words) => words[Math.floor(Date.now() / 86400000) % words.length];
const progressSummary = (attempts, correctUses) => ({ attempts, correct_uses: correctUses, accuracy: attempts ? Math.round((correctUses / attempts) * 100) : 0 });

router.get('/daily', requireAuth, async (req, res, next) => { try {
  const level = typeof req.query.level === 'string' && levels[req.query.level] ? req.query.level : 'basic';
  if (!isSupabaseConfigured()) {
    const choices = local.words.filter((word) => levels[level].includes(word.difficulty));
    const word = pickWord(choices);
    if (!word) throw Object.assign(new Error(`No ${level} vocabulary words are available yet.`), { status: 404 });
    return res.json({ ...word, level, local_mode: true });
  }
  const words = await dbError(await admin().from('vocabulary_words').select('*').in('difficulty', levels[level]).order('id'));
  if (!words?.length) throw Object.assign(new Error(`No ${level} vocabulary words are available yet. Run the seed SQL.`), { status: 404 });
  const word = pickWord(words);
  res.json({ word_id: word.id, word: word.word, definition: word.definition, context_examples: word.context_examples || [word.context_sentence], difficulty: word.difficulty, level: difficultyLevel(word.difficulty), category: word.category });
} catch (error) { next(error); } });

router.post('/vocabulary-check', requireAuth, async (req, res, next) => { try {
  const parsed = checkSchema.safeParse(req.body);
  if (!parsed.success) throw Object.assign(new Error('Write a sentence between 5 and 500 characters and include the time spent.'), { status: 400 });
  const input = parsed.data;
  if (!isSupabaseConfigured()) {
    const word = local.words.find((item) => item.word_id === input.word_id);
    if (!word) throw Object.assign(new Error('Word not found.'), { status: 404 });
    const included = usesWord(word.word, input.user_sentence);
    if (!included) {
      local.vocabularyAttempts.push({ user_id: req.user.id, word_id: word.word_id, difficulty: word.difficulty, correct: false, time_spent_seconds: input.time_spent_seconds, created_at: new Date().toISOString() });
      return res.json({ success: true, correct: false, sophistication_score: 0, feedback: `You haven't used the word "${word.word}" yet — try writing a sentence that includes it.`, better_version: null, mastered: false, user_progress: progressSummary(0, 0), local_mode: true });
    }
    const verdict = await checkVocabulary(word.word, input.user_sentence);
    const correct = Boolean(verdict.word_correct && verdict.grammar_correct);
    local.vocabularyAttempts.push({ user_id: req.user.id, word_id: word.word_id, difficulty: word.difficulty, correct, time_spent_seconds: input.time_spent_seconds, created_at: new Date().toISOString() });
    const old = local.vocabulary.find((item) => item.user_id === req.user.id && item.word_id === word.word_id);
    const attempts = (old?.attempts || 0) + 1;
    const correct_uses = (old?.correct_uses || 0) + (correct ? 1 : 0);
    const record = { user_id: req.user.id, word_id: word.word_id, attempts, correct_uses, mastered: correct_uses >= 3 };
    if (old) Object.assign(old, record); else local.vocabulary.push(record);
    return res.json({ success: true, correct, sophistication_score: verdict.sophistication_score, feedback: verdict.feedback, better_version: verdict.better_version, mastered: record.mastered, user_progress: progressSummary(attempts, correct_uses), local_mode: true });
  }
  const word = await dbError(await admin().from('vocabulary_words').select('id,word').eq('id', input.word_id).single());
  const included = usesWord(word.word, input.user_sentence);
  if (!included) {
    await dbError(await admin().from('vocabulary_attempts').insert({ user_id: req.user.id, word_id: word.id, user_sentence: input.user_sentence, correct: false, time_spent_seconds: input.time_spent_seconds }));
    return res.json({ success: true, correct: false, sophistication_score: 0, feedback: `You haven't used the word "${word.word}" yet — try writing a sentence that includes it.`, better_version: null, mastered: false, user_progress: progressSummary(0, 0) });
  }
  const verdict = await checkVocabulary(word.word, input.user_sentence);
  const correct = Boolean(verdict.word_correct && verdict.grammar_correct);
  await dbError(await admin().from('vocabulary_attempts').insert({ user_id: req.user.id, word_id: word.id, user_sentence: input.user_sentence, correct, sophistication_score: verdict.sophistication_score, time_spent_seconds: input.time_spent_seconds }));
  const existing = await dbError(await admin().from('vocabulary_progress').select('*').eq('user_id', req.user.id).eq('word_id', word.id).maybeSingle());
  const attempts = (existing?.attempts || 0) + 1;
  const correct_uses = (existing?.correct_uses || 0) + (correct ? 1 : 0);
  const mastered = correct_uses >= 3;
  const progress = await dbError(await admin().from('vocabulary_progress').upsert({ id: existing?.id, user_id: req.user.id, word_id: word.id, user_sentence: input.user_sentence, correct, score: Math.max(1, verdict.sophistication_score || 1), attempts, correct_uses, mastered, last_attempt: new Date().toISOString(), next_review: new Date(Date.now() + (mastered ? 7 : 1) * 86400000).toISOString() }, { onConflict: 'user_id,word_id' }).select('attempts,correct_uses,mastered').single());
  res.json({ success: true, correct, sophistication_score: verdict.sophistication_score, feedback: verdict.feedback, better_version: verdict.better_version, mastered: progress.mastered, user_progress: progressSummary(progress.attempts, progress.correct_uses) });
} catch (error) { next(error); } });

export default router;
