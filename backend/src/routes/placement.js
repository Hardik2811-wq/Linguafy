import express from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { isSupabaseConfigured } from '../config.js';
import { admin, dbError } from '../services/supabase.js';
import { local } from '../services/local.js';
import {
  getQuestionBank,
  selectNextQuestion,
  sanitizeQuestionForClient,
  evaluateAnswer,
  calculateFinalResults,
  seedAbilityScore
} from '../services/placement.js';

const router = express.Router();
const activeSessions = new Map();

// Zod schemas
const submitAnswerSchema = z.object({
  session_id: z.string().min(1),
  question_id: z.string().min(1),
  user_answer_index: z.union([z.number(), z.string()]),
  confidence: z.enum(['certain', 'fairly_sure', 'not_sure']).default('fairly_sure'),
  time_taken_seconds: z.number().nonnegative().default(20)
});

// POST /api/placement/start
router.post('/start', requireAuth, (req, res, next) => {
  try {
    const estimatedLevel = req.body?.estimated_level || null;
    const bank = getQuestionBank();
    if (!bank || !bank.length) {
      return res.status(503).json({ error: 'Placement question bank is not available' });
    }

    const sessionId = randomUUID();
    const sessionState = {
      sessionId,
      userId: req.user.id,
      startedAt: new Date().toISOString(),
      abilityScore: seedAbilityScore(estimatedLevel),
      usedIds: new Set(),
      categoryHistory: [],
      grammarTopicCounts: {},
      recentVocabResponses: [],
      remaining: { C: 10, P: 10, V: 10 },
      responses: []
    };

    const firstQuestion = selectNextQuestion(bank, sessionState);
    if (!firstQuestion) {
      return res.status(500).json({ error: 'Failed to select starting question' });
    }

    sessionState.usedIds.add(firstQuestion.id);
    sessionState.currentQuestionId = firstQuestion.id;
    sessionState.categoryHistory.push(firstQuestion.category);
    sessionState.grammarTopicCounts[firstQuestion.grammar_topic] = 1;
    if (sessionState.remaining[firstQuestion.category] > 0) {
      sessionState.remaining[firstQuestion.category]--;
    }
    activeSessions.set(sessionId, sessionState);

    // Also track in local service if in local mode
    if (!isSupabaseConfigured()) {
      local.placementSessions.set(sessionId, sessionState);
    }

    res.json({
      session_id: sessionId,
      totalQuestions: 30,
      questionNumber: 1,
      currentQuestion: sanitizeQuestionForClient(firstQuestion, 1, 30)
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/placement/submit-answer
router.post('/submit-answer', requireAuth, async (req, res, next) => {
  try {
    const parsed = submitAnswerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid payload' });
    }

    const { session_id, question_id, user_answer_index, confidence, time_taken_seconds } = parsed.data;
    const session = activeSessions.get(session_id) || (isSupabaseConfigured() ? null : local.placementSessions.get(session_id));

    if (!session) {
      return res.status(404).json({ error: 'Placement session not found or expired. Please start a new test.' });
    }

    const bank = getQuestionBank();
    const question = bank.find(q => q.id === question_id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found in question bank' });
    }

    // Evaluate answer
    const evalResult = evaluateAnswer(question, user_answer_index, confidence, time_taken_seconds);

    // Update ability score and vocab tracking
    session.abilityScore += evalResult.scoreMovement;

    if (question.category === 'V') {
      session.recentVocabResponses.push({
        isCorrect: evalResult.isCorrect,
        vocab_tier: question.vocab_tier || 'tier1'
      });
    }

    const responseRecord = {
      question_id: question.id,
      category: question.category,
      grammar_topic: question.grammar_topic,
      vocab_tier: question.vocab_tier,
      estimated_difficulty: question.estimated_difficulty,
      cefr_reference: question.cefr_reference,
      question_text: question.question,
      passage: question.passage,
      user_answer: evalResult.chosenText,
      correct_answer: evalResult.correctText,
      isCorrect: evalResult.isCorrect,
      explanation: question.explanation,
      confidence: evalResult.confidence,
      score_movement: evalResult.scoreMovement,
      ability_score_after: session.abilityScore,
      time_taken_seconds: evalResult.timeTakenSeconds,
      pace_signal: evalResult.paceSignal,
      answered_at: new Date().toISOString()
    };

    session.responses.push(responseRecord);

    const questionNumber = session.responses.length;
    const isFinished = questionNumber >= 30;

    if (!isFinished) {
      const nextQuestion = selectNextQuestion(bank, session);
      if (nextQuestion) {
        session.usedIds.add(nextQuestion.id);
        session.currentQuestionId = nextQuestion.id;
        session.categoryHistory.push(nextQuestion.category);
        session.grammarTopicCounts[nextQuestion.grammar_topic] = (session.grammarTopicCounts[nextQuestion.grammar_topic] || 0) + 1;
        if (session.remaining[nextQuestion.category] > 0) {
          session.remaining[nextQuestion.category]--;
        }
        return res.json({
          completed: false,
          questionNumber: questionNumber + 1,
          totalQuestions: 30,
          currentQuestion: sanitizeQuestionForClient(nextQuestion, questionNumber + 1, 30)
        });
      }
    }

    // Finished test -> calculate comprehensive results
    const results = calculateFinalResults(session.responses, session.abilityScore);
    results.startedAt = session.startedAt;
    results.completedAt = new Date().toISOString();

    // Persist attempt & update user level
    if (isSupabaseConfigured()) {
      try {
        await admin()
          .from('users')
          .update({ language_level: results.finalLevel, updated_at: new Date().toISOString() })
          .eq('id', req.user.id);

        await admin()
          .from('placement_attempts')
          .insert({
            user_id: req.user.id,
            started_at: session.startedAt,
            completed_at: results.completedAt,
            ability_score: results.abilityScore,
            final_level: results.finalLevel,
            cpv_scores: results.cpvScores,
            grammar_heatmap: results.grammarHeatmap,
            vocab_tier_reached: results.vocabTierReached,
            category_counts: {
              C: session.responses.filter(r => r.category === 'C').length,
              P: session.responses.filter(r => r.category === 'P').length,
              V: session.responses.filter(r => r.category === 'V').length
            },
            is_completed: true
          });
      } catch (dbErr) {
        console.error('[placement] Supabase save error:', dbErr.message);
      }
    } else {
      local.updateUserLevel(req.user.id, results.finalLevel);
      local.placementAttempts.set(req.user.id, results);
    }

    activeSessions.delete(session_id);

    res.json({
      completed: true,
      questionNumber: 30,
      totalQuestions: 30,
      results
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/placement/latest
router.get('/latest', requireAuth, async (req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      const attempt = local.placementAttempts.get(req.user.id);
      if (!attempt) return res.json({ hasAttempt: false });
      return res.json({ hasAttempt: true, results: attempt });
    }

    const { data, error } = await admin()
      .from('placement_attempts')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('is_completed', true)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw dbError(error);
    if (!data) return res.json({ hasAttempt: false });

    res.json({
      hasAttempt: true,
      results: {
        finalLevel: data.final_level,
        abilityScore: data.ability_score,
        cpvScores: data.cpv_scores,
        grammarHeatmap: data.grammar_heatmap,
        vocabTierReached: data.vocab_tier_reached,
        completedAt: data.completed_at
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
