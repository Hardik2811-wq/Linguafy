import { Router } from 'express';
import { admin, dbError } from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { isSupabaseConfigured } from '../config.js';
import { local } from '../services/local.js';

const router = Router();
const average = (rows, key) => rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length) : 0;
const percent = (value, total) => total ? Math.round((value / total) * 100) : 0;
const weekStart = () => Date.now() - 7 * 24 * 60 * 60 * 1000;
const recent = (rows) => rows.filter((row) => !row.created_at || new Date(row.created_at).getTime() >= weekStart());
const levelForDifficulty = (difficulty) => difficulty === 1 ? 'basic' : difficulty <= 3 ? 'intermediate' : difficulty === 4 ? 'advanced' : 'hard';
const topicInsights = (attempts) => Object.values(attempts.reduce((groups, attempt) => {
  const pillar = attempt.pillar || attempt.grammar_drills?.pillar || 'grammar';
  const current = groups[pillar] || { pillar, attempts: 0, raw_correct: 0, earned_points: 0, total_time_seconds: 0 };
  current.attempts += 1;
  current.raw_correct += attempt.correct ? 1 : 0;
  current.earned_points += Number(attempt.awarded_points ?? (attempt.correct ? 1 : 0));
  current.total_time_seconds += Number(attempt.time_spent_seconds || 0);
  groups[pillar] = current;
  return groups;
}, {})).map((item) => ({ ...item, accuracy: percent(item.earned_points, item.attempts), raw_accuracy: percent(item.raw_correct, item.attempts), average_time_seconds: Math.round(item.total_time_seconds / item.attempts) }));
const vocabularyInsights = (attempts) => Object.values(attempts.reduce((groups, attempt) => {
  const level = levelForDifficulty(attempt.difficulty || attempt.vocabulary_words?.difficulty || 3);
  const current = groups[level] || { level, attempts: 0, correct: 0, total_time_seconds: 0 };
  current.attempts += 1;
  current.correct += attempt.correct ? 1 : 0;
  current.total_time_seconds += Number(attempt.time_spent_seconds || 0);
  groups[level] = current;
  return groups;
}, {})).map((item) => ({ ...item, accuracy: percent(item.correct, item.attempts), average_time_seconds: Math.round(item.total_time_seconds / item.attempts) }));
const learningAreas = (grammarTopics, vocabularyLevels) => [
  ...grammarTopics.map((topic) => ({ kind: 'grammar', label: topic.pillar.replaceAll('_', ' '), accuracy: topic.accuracy, attempts: topic.attempts, average_time_seconds: topic.average_time_seconds })),
  ...vocabularyLevels.map((level) => ({ kind: 'vocabulary', label: `${level.level} vocabulary`, accuracy: level.accuracy, attempts: level.attempts, average_time_seconds: level.average_time_seconds }))
];
const insights = (grammarTopics, vocabularyLevels) => {
  const areas = learningAreas(grammarTopics, vocabularyLevels);
  const strengths = areas.filter((area) => area.attempts >= 2 && area.accuracy >= 70).sort((a, b) => b.accuracy - a.accuracy || b.attempts - a.attempts).slice(0, 2);
  const weak_areas = [...areas].sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts).slice(0, 2);
  return { strengths, weak_areas, recommendations: weak_areas.map((area) => `Practise ${area.label}: ${area.accuracy}% credited accuracy across ${area.attempts} attempt${area.attempts === 1 ? '' : 's'}, averaging ${area.average_time_seconds}s each.`) };
};
const responseFor = ({ user, writing, grammar, vocabulary, vocabularyAttempts, exams, sessions, local_mode = false }) => {
  const weeklyWriting = recent(writing); const weeklyGrammar = recent(grammar); const weeklyVocab = recent(vocabulary); const weeklyExams = recent(exams); const weeklySessions = recent(sessions);
  const earned = weeklyGrammar.reduce((sum, item) => sum + Number(item.awarded_points ?? (item.correct ? 1 : 0)), 0);
  const grammarTopics = topicInsights(grammar); const vocabularyLevels = vocabularyInsights(vocabularyAttempts);
  const analysis = insights(grammarTopics, vocabularyLevels);
  return {
    user,
    this_week: {
      writing_submissions: weeklyWriting.length,
      writing_avg_score: average(weeklyWriting, 'score'),
      grammar_drills: weeklyGrammar.length,
      grammar_accuracy: percent(earned, weeklyGrammar.length),
      grammar_average_time_seconds: average(weeklyGrammar, 'time_spent_seconds'),
      vocab_learned: weeklyVocab.filter((item) => item.mastered).length,
      vocab_mastery: weeklyVocab.length ? Math.round(weeklyVocab.filter((item) => item.mastered).length / weeklyVocab.length * 100) : 0,
      exam_attempts: weeklyExams.length,
      exam_avg_band: average(weeklyExams, 'band_estimate'),
      conversations: weeklySessions.length
    },
    grammar_topics: grammarTopics,
    vocabulary_levels: vocabularyLevels,
    ...analysis,
    ...(local_mode ? { local_mode: true } : {})
  };
};

router.get('/progress', requireAuth, async (req, res, next) => { try {
  if (!isSupabaseConfigured()) {
    return res.json(responseFor({
      user: { name: req.user.name, level: req.user.level },
      writing: local.writing.filter((item) => item.user_id === req.user.id),
      grammar: local.grammarAttempts.filter((item) => item.user_id === req.user.id),
      vocabulary: local.vocabulary.filter((item) => item.user_id === req.user.id),
      vocabularyAttempts: local.vocabularyAttempts.filter((item) => item.user_id === req.user.id),
      exams: local.exams.filter((item) => item.user_id === req.user.id),
      sessions: [],
      local_mode: true
    }));
  }
  const db = admin();
  const [profile, writing, grammar, vocabulary, vocabularyAttempts, exams, sessions] = await Promise.all([
    dbError(await db.from('users').select('name,language_level').eq('id', req.user.id).maybeSingle()),
    dbError(await db.from('writing_submissions').select('score,created_at').eq('user_id', req.user.id)),
    dbError(await db.from('grammar_attempts').select('correct,awarded_points,time_spent_seconds,created_at,grammar_drills!inner(pillar)').eq('user_id', req.user.id)),
    dbError(await db.from('vocabulary_progress').select('mastered,created_at').eq('user_id', req.user.id)),
    dbError(await db.from('vocabulary_attempts').select('correct,time_spent_seconds,created_at,vocabulary_words!inner(difficulty)').eq('user_id', req.user.id)),
    dbError(await db.from('exam_attempts').select('band_estimate,created_at').eq('user_id', req.user.id)),
    dbError(await db.from('conversation_sessions').select('created_at').eq('user_id', req.user.id))
  ]);
  res.json(responseFor({ user: { name: profile?.name || 'Learner', level: profile?.language_level || 'B2' }, writing, grammar, vocabulary, vocabularyAttempts, exams, sessions }));
} catch (error) { next(error); } });

export default router;
