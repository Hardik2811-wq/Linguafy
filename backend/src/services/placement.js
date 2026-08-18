import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const questionsPath = path.resolve(__dirname, '../data/placement_questions.json');
let questionBank = [];

try {
  const raw = fs.readFileSync(questionsPath, 'utf8');
  questionBank = JSON.parse(raw);
} catch (err) {
  console.error('[placement] Failed to load placement_questions.json:', err.message);
}

export const ALL_GRAMMAR_TOPICS = [
  'tenses_present',
  'tenses_past',
  'tenses_future',
  'tenses_perfect',
  'subject_verb_agreement',
  'active_passive',
  'conditionals',
  'modals',
  'articles',
  'prepositions',
  'relative_clauses',
  'comparatives_superlatives',
  'reported_speech',
  'word_order',
  'gerunds_infinitives'
];

export const TOPIC_DISPLAY_NAMES = {
  tenses_present: 'Present Tenses',
  tenses_past: 'Past Tenses',
  tenses_future: 'Future Tenses',
  tenses_perfect: 'Perfect Tenses',
  subject_verb_agreement: 'Subject-Verb Agreement',
  active_passive: 'Active & Passive Voice',
  conditionals: 'Conditionals',
  modals: 'Modal Verbs',
  articles: 'Articles (a, an, the)',
  prepositions: 'Prepositions',
  relative_clauses: 'Relative Clauses',
  comparatives_superlatives: 'Comparatives & Superlatives',
  reported_speech: 'Reported Speech',
  word_order: 'Word Order & Sentence Structure',
  gerunds_infinitives: 'Gerunds & Infinitives'
};

export const EXPECTED_TIME = {
  C: { min: 15, target: 25, max: 40 },
  V: { min: 10, target: 20, max: 35 },
  P: { min: 45, target: 75, max: 120 }
};

export const SCORE_MOVEMENTS = {
  correct_certain: 3,
  correct_fairly_sure: 2,
  correct_not_sure: 0,
  incorrect_not_sure: -1,
  incorrect_fairly_sure: -2,
  incorrect_certain: -3
};

export function getQuestionBank() {
  return questionBank;
}

export function computePaceSignal(category, timeTakenSeconds) {
  const band = EXPECTED_TIME[category] || { min: 15, target: 25, max: 40 };
  const sec = Number(timeTakenSeconds) || band.target;
  if (sec <= band.target) return 'on_pace';
  if (sec <= band.max) return 'slow';
  return 'very_slow';
}

export function selectVocabTier(recentVocabResponses = []) {
  const last3 = recentVocabResponses.slice(-3);
  const tier1Recent = last3.filter(r => r.vocab_tier === 'tier1');
  if (!tier1Recent.length) return 'tier1';
  const tier1Accuracy = tier1Recent.filter(r => r.isCorrect).length / tier1Recent.length;
  if (tier1Accuracy >= 0.66) return 'tier2';
  return 'tier1';
}

export function selectDifficultyBand(abilityScore) {
  return Math.max(0.05, Math.min(0.95, 0.5 + (abilityScore || 0) / 100));
}

export function seedAbilityScore(estimatedLevel) {
  const seeds = { beginner: -20, daily: -5, confident: 0, fluent: 15 };
  return seeds[estimatedLevel] ?? 0;
}

export function sanitizeQuestionForClient(question, questionNumber = 1, totalQuestions = 30) {
  if (!question) return null;
  return {
    id: question.id,
    questionNumber,
    totalQuestions,
    category: question.category, // 'C', 'P', 'V'
    question: question.question,
    passage: question.passage || null,
    options: (question.options || []).map((opt, idx) => ({
      index: idx,
      text: typeof opt === 'string' ? opt : opt.text
    })),
    expected_time_seconds: question.expected_time_seconds || 25
  };
}

export function selectNextQuestion(bank, sessionState) {
  const usedIds = sessionState.usedIds instanceof Set
    ? sessionState.usedIds
    : new Set(sessionState.usedIds || []);
  const categoryHistory = sessionState.categoryHistory || [];
  const remaining = { ...(sessionState.remaining || { C: 10, P: 10, V: 10 }) };
  const grammarTopicCounts = sessionState.grammarTopicCounts || {};
  const abilityScore = sessionState.abilityScore || 0;
  const recentVocabResponses = sessionState.recentVocabResponses || [];

  const targetDifficulty = selectDifficultyBand(abilityScore);

  // 1. Filter out already used questions
  let pool = bank.filter(q => !usedIds.has(q.id));
  if (!pool.length) return null;

  // 2. Enforce "no more than 2 same-category in a row"
  const last2 = categoryHistory.slice(-2);
  if (last2.length === 2 && last2[0] === last2[1]) {
    const nonSame = pool.filter(q => q.category !== last2[0]);
    if (nonSame.length) pool = nonSame;
  }

  // 3. Respect remaining category counts (~10 C, 10 P, 10 V)
  const withCategoryQuota = pool.filter(q => (remaining[q.category] || 0) > 0);
  if (withCategoryQuota.length) {
    pool = withCategoryQuota;
  }

  // 4. Guaranteed 15-topic coverage:
  // Step 4a: Prioritize topics that have not been sampled at all (count === 0)
  const zeroCountPool = pool.filter(q => (grammarTopicCounts[q.grammar_topic] || 0) === 0);
  if (zeroCountPool.length > 0) {
    pool = zeroCountPool;
  } else {
    // Step 4b: Prioritize topics with count < 2
    const underTwoPool = pool.filter(q => (grammarTopicCounts[q.grammar_topic] || 0) < 2);
    if (underTwoPool.length > 0) {
      pool = underTwoPool;
    } else {
      // Find minimum count among available topics in pool
      let minCount = 999;
      for (const q of pool) {
        const c = grammarTopicCounts[q.grammar_topic] || 0;
        if (c < minCount) minCount = c;
      }
      const minPool = pool.filter(q => (grammarTopicCounts[q.grammar_topic] || 0) <= minCount);
      if (minPool.length > 0) pool = minPool;
    }
  }

  // 5. If pool contains Vocabulary, apply tier logic
  if (pool.some(q => q.category === 'V')) {
    const targetTier = selectVocabTier(recentVocabResponses);
    const tierFiltered = pool.filter(q => q.category !== 'V' || q.vocab_tier === targetTier);
    if (tierFiltered.length) pool = tierFiltered;
  }

  // 6. Narrow to questions within +/- 0.10 of targetDifficulty
  let byDifficulty = pool.filter(
    q => Math.abs((q.estimated_difficulty ?? 0.5) - targetDifficulty) <= 0.10
  );
  if (!byDifficulty.length) {
    byDifficulty = pool.filter(
      q => Math.abs((q.estimated_difficulty ?? 0.5) - targetDifficulty) <= 0.22
    );
  }
  if (!byDifficulty.length) {
    byDifficulty = pool;
  }

  // 7. Random pick among valid candidates
  const choice = byDifficulty[Math.floor(Math.random() * byDifficulty.length)];
  return choice;
}

export function evaluateAnswer(question, userAnswerIndex, confidence, timeTakenSeconds) {
  const options = question.options || [];
  let isCorrect = false;
  let chosenText = '';
  let correctText = '';

  if (typeof userAnswerIndex === 'number' && options[userAnswerIndex]) {
    const selected = options[userAnswerIndex];
    chosenText = typeof selected === 'string' ? selected : selected.text;
    isCorrect = Boolean(selected.correct);
  } else if (typeof userAnswerIndex === 'string') {
    chosenText = userAnswerIndex;
    const found = options.find(o => (typeof o === 'string' ? o : o.text) === userAnswerIndex);
    isCorrect = Boolean(found?.correct);
  }

  const correctOpt = options.find(o => Boolean(o.correct));
  if (correctOpt) {
    correctText = typeof correctOpt === 'string' ? correctOpt : correctOpt.text;
  }

  const normConfidence = ['certain', 'fairly_sure', 'not_sure'].includes(confidence)
    ? confidence
    : 'fairly_sure';
  const movementKey = `${isCorrect ? 'correct' : 'incorrect'}_${normConfidence}`;
  const scoreMovement = SCORE_MOVEMENTS[movementKey] ?? (isCorrect ? 2 : -2);
  const paceSignal = computePaceSignal(question.category, timeTakenSeconds);

  return {
    isCorrect,
    chosenText,
    correctText,
    confidence: normConfidence,
    scoreMovement,
    paceSignal,
    timeTakenSeconds: Math.max(1, Math.round(Number(timeTakenSeconds) || 20))
  };
}

export function buildGrammarHeatmap(responses = []) {
  const statsByTopic = {};
  for (const topic of ALL_GRAMMAR_TOPICS) {
    statsByTopic[topic] = { correct: 0, total: 0, questions: [] };
  }

  for (const r of responses) {
    const topic = r.grammar_topic || r.question?.grammar_topic;
    if (!topic) continue;
    if (!statsByTopic[topic]) {
      statsByTopic[topic] = { correct: 0, total: 0, questions: [] };
    }
    statsByTopic[topic].total++;
    if (r.isCorrect) {
      statsByTopic[topic].correct++;
    }
    statsByTopic[topic].questions.push({
      id: r.question_id || r.question?.id,
      category: r.category || r.question?.category,
      question: r.question_text || r.question?.question,
      passage: r.passage || r.question?.passage,
      userAnswer: r.user_answer || r.chosenText,
      correctAnswer: r.correct_answer || r.correctText,
      isCorrect: Boolean(r.isCorrect),
      explanation: r.explanation || r.question?.explanation,
      confidence: r.confidence,
      timeTaken: r.time_taken_seconds || r.timeTakenSeconds
    });
  }

  const heatmap = {};
  for (const [topic, stats] of Object.entries(statsByTopic)) {
    const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null;
    let status = 'insufficient_data';
    if (stats.total >= 1 && accuracy !== null) {
      status = accuracy >= 75 ? 'strong' : accuracy >= 45 ? 'average' : 'weak';
    }
    heatmap[topic] = {
      topic,
      displayName: TOPIC_DISPLAY_NAMES[topic] || topic.replaceAll('_', ' '),
      accuracy,
      status,
      sampleSize: stats.total,
      correctCount: stats.correct,
      questions: stats.questions
    };
  }

  return heatmap;
}

export function computeCPVScores(responses = []) {
  const catStats = {
    C: { correct: 0, total: 0, totalSeconds: 0, name: 'Conversation', icon: '💬' },
    P: { correct: 0, total: 0, totalSeconds: 0, name: 'Passage Comprehension', icon: '📖' },
    V: { correct: 0, total: 0, totalSeconds: 0, name: 'Vocabulary', icon: '📚' }
  };

  for (const r of responses) {
    const cat = r.category || r.question?.category;
    if (catStats[cat]) {
      catStats[cat].total++;
      if (r.isCorrect) catStats[cat].correct++;
      catStats[cat].totalSeconds += (r.time_taken_seconds || r.timeTakenSeconds || 20);
    }
  }

  const result = {};
  let strongest = null;
  let maxAcc = -1;
  let weakest = null;
  let minAcc = 101;

  for (const [cat, s] of Object.entries(catStats)) {
    const accuracy = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
    const avgSeconds = s.total > 0 ? Math.round(s.totalSeconds / s.total) : 0;
    result[cat] = {
      category: cat,
      name: s.name,
      icon: s.icon,
      accuracy,
      correctCount: s.correct,
      totalCount: s.total,
      avgSeconds
    };
    if (accuracy > maxAcc) {
      maxAcc = accuracy;
      strongest = cat;
    }
    if (accuracy < minAcc) {
      minAcc = accuracy;
      weakest = cat;
    }
  }

  for (const cat of ['C', 'P', 'V']) {
    if (cat === strongest && catStats[cat].total > 0) {
      result[cat].note = 'Your strongest lane — great natural instincts';
    } else if (cat === weakest && catStats[cat].total > 0 && minAcc < maxAcc) {
      result[cat].note = 'Room to grow here with focused practice';
    } else {
      result[cat].note = 'Consistent foundation across exercises';
    }
  }

  return result;
}

export function determineCEFRLevel(abilityScore, overallAccuracy) {
  if (abilityScore >= 40 || (abilityScore >= 30 && overallAccuracy >= 86)) {
    return {
      level: 'C2',
      title: 'Proficient (C2)',
      tagline: 'Mastery of nuance, advanced idiomatic expressions, and complex grammar.',
      encouragement: 'Outstanding! You demonstrated near-native mastery across conversation, reading, and specialized grammar structures.'
    };
  }
  if (abilityScore >= 20 || (abilityScore >= 12 && overallAccuracy >= 75)) {
    return {
      level: 'C1',
      title: 'Advanced (C1)',
      tagline: 'Fluent, flexible English for academic and professional contexts.',
      encouragement: 'Impressive work! You handle complex sentence patterns and nuanced vocabulary with ease and precision.'
    };
  }
  if (abilityScore >= 2 || (abilityScore >= -4 && overallAccuracy >= 60)) {
    return {
      level: 'B2',
      title: 'Upper Intermediate (B2)',
      tagline: 'Clear, confident communicator in diverse professional and personal situations.',
      encouragement: 'Great job! You have a solid grasp of core structures and can navigate complex passages with confidence.'
    };
  }
  if (abilityScore >= -16 || (abilityScore >= -22 && overallAccuracy >= 45)) {
    return {
      level: 'B1',
      title: 'Intermediate (B1)',
      tagline: 'Comfortable with everyday English, familiar topics, and standard routines.',
      encouragement: 'Well done! You have a reliable foundation. A few targeted grammar drills will rapidly boost your fluency.'
    };
  }
  if (abilityScore >= -32 || overallAccuracy >= 30) {
    return {
      level: 'A2',
      title: 'Elementary (A2)',
      tagline: 'Able to understand basic phrases and direct everyday communication.',
      encouragement: 'Good start! You understand key conversational patterns. We’ll help you build consistency step by step.'
    };
  }
  return {
    level: 'A1',
    title: 'Beginner (A1)',
    tagline: 'Starting the journey with foundational vocabulary and simple phrases.',
    encouragement: 'Welcome! Every great English speaker starts here. Your personalized path is ready to guide you smoothly.'
  };
}

export function generatePaceInsights(responses = []) {
  const insights = [];
  const catTime = { C: [], P: [], V: [] };

  for (const r of responses) {
    const cat = r.category || r.question?.category;
    if (cat && catTime[cat]) {
      catTime[cat].push(r.time_taken_seconds || 20);
    }
  }

  const vocabFast = responses.filter(r => (r.category || r.question?.category) === 'V' && r.isCorrect && (r.time_taken_seconds || 20) <= 22);
  if (vocabFast.length >= 4) {
    insights.push({
      icon: '⚡',
      text: 'You tend to answer Vocabulary quickly and accurately — sharp instincts.'
    });
  } else {
    insights.push({
      icon: '📚',
      text: 'Your vocabulary pacing is steady and thoughtful across word tiers.'
    });
  }

  const passageResponses = responses.filter(r => (r.category || r.question?.category) === 'P');
  const passageAcc = passageResponses.length ? passageResponses.filter(r => r.isCorrect).length / passageResponses.length : 0;
  if (passageAcc >= 0.7) {
    insights.push({
      icon: '📖',
      text: 'You take your time on Passages — that deliberate reading strategy is working very well for you.'
    });
  } else {
    insights.push({
      icon: '⏱️',
      text: 'Taking a few extra seconds to scan passage keywords before picking an option will boost comprehension.'
    });
  }

  const slowQuestions = responses.filter(r => r.pace_signal === 'very_slow');
  if (slowQuestions.length > 0) {
    const topicsMap = {};
    for (const q of slowQuestions) {
      const t = q.grammar_topic || q.question?.grammar_topic;
      if (t) topicsMap[t] = (topicsMap[t] || 0) + 1;
    }
    const highestTopic = Object.keys(topicsMap).sort((a, b) => topicsMap[b] - topicsMap[a])[0];
    const topicName = highestTopic ? (TOPIC_DISPLAY_NAMES[highestTopic] || highestTopic.replaceAll('_', ' ')) : 'complex drills';
    insights.push({
      icon: '🎯',
      text: `You spent noticeably longer on ${slowQuestions.length} question${slowQuestions.length > 1 ? 's' : ''} — particularly in ${topicName}.`
    });
  }

  return insights;
}

export function generateRecommendedCourses(growthZones = [], cpvScores = {}, vocabTier = 'tier1') {
  const recommendations = [];

  for (const zone of growthZones.slice(0, 2)) {
    recommendations.push({
      id: `grammar_${zone.topic}`,
      category: 'Grammar Lab',
      title: `Master ${zone.displayName}`,
      reason: `Identified as a top growth zone (${zone.accuracy ?? 0}% accuracy in placement test).`,
      actionView: 'grammar',
      actionTopic: zone.topic,
      icon: 'BookOpen'
    });
  }

  if (cpvScores.V && cpvScores.V.accuracy < 70) {
    recommendations.push({
      id: 'vocab_expansion',
      category: 'Vocabulary in Context',
      title: vocabTier === 'tier2' ? 'Advanced Business & Academic Lexicon' : 'Everyday Core Vocabulary Builder',
      reason: `Build active recall and sentence sophistication for ${vocabTier === 'tier2' ? 'Tier 2' : 'Tier 1'} words.`,
      actionView: 'vocabulary',
      icon: 'Sparkles'
    });
  }

  recommendations.push({
    id: 'writing_studio_coach',
    category: 'Writing Studio',
    title: 'Precision Writing & Sentence Structure',
    reason: 'Put your grammar insights directly to work with instant AI tone and clarity feedback.',
    actionView: 'writing',
    icon: 'PenLine'
  });

  return recommendations.slice(0, 3);
}

export function calculateFinalResults(responses = [], abilityScore = 0) {
  const totalQuestions = responses.length;
  const correctCount = responses.filter(r => r.isCorrect).length;
  const overallAccuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  const cefr = determineCEFRLevel(abilityScore, overallAccuracy);
  const cpvScores = computeCPVScores(responses);
  const grammarHeatmap = buildGrammarHeatmap(responses);
  const paceInsights = generatePaceInsights(responses);

  const scoredTopics = Object.values(grammarHeatmap).filter(t => t.sampleSize >= 1);
  const sortedByAccuracy = [...scoredTopics].sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0));

  const championZones = sortedByAccuracy
    .filter(t => t.status === 'strong' || (t.accuracy ?? 0) >= 70)
    .slice(0, 3);

  const growthZones = [...sortedByAccuracy]
    .reverse()
    .filter(t => t.status === 'weak' || (t.accuracy ?? 0) < 65)
    .slice(0, 3);

  if (!championZones.length && sortedByAccuracy.length) {
    championZones.push(sortedByAccuracy[0]);
  }
  if (!growthZones.length && sortedByAccuracy.length > 1) {
    growthZones.push(sortedByAccuracy[sortedByAccuracy.length - 1]);
  }

  const vocabResponses = responses.filter(r => (r.category || r.question?.category) === 'V');
  const testedTier2 = vocabResponses.filter(r => (r.vocab_tier || r.question?.vocab_tier) === 'tier2');
  const tier2Accuracy = testedTier2.length ? testedTier2.filter(r => r.isCorrect).length / testedTier2.length : 0;
  const vocabTierReached = (testedTier2.length >= 2 && tier2Accuracy >= 0.5) ? 'tier2' : 'tier1';

  const recommendations = generateRecommendedCourses(growthZones, cpvScores, vocabTierReached);
  const totalTimeSeconds = responses.reduce((acc, r) => acc + (r.time_taken_seconds || r.timeTakenSeconds || 20), 0);

  return {
    totalQuestions,
    correctCount,
    overallAccuracy,
    abilityScore: Math.round(abilityScore * 10) / 10,
    finalLevel: cefr.level,
    levelDetails: cefr,
    cpvScores,
    grammarHeatmap,
    championZones,
    growthZones,
    vocabTierReached: vocabTierReached === 'tier2' ? 'Tier 2 (Advanced Lexicon)' : 'Tier 1 (Everyday Fluency)',
    paceInsights,
    recommendations,
    totalTimeSeconds
  };
}
