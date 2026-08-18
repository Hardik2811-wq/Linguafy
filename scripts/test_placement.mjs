/**
 * Linguafy Placement Test Diagnostic & Execution Script
 * Run with: node scripts/test_placement.mjs
 */

import {
  getQuestionBank,
  ALL_GRAMMAR_TOPICS,
  TOPIC_DISPLAY_NAMES,
  selectDifficultyBand,
  selectVocabTier,
  evaluateAnswer,
  calculateFinalResults
} from '../backend/src/services/placement.js';

console.log('\n======================================================');
console.log('🧪 LINGUAFY PLACEMENT TEST DIAGNOSTIC RUN');
console.log('======================================================\n');

const bank = getQuestionBank();
console.log(`✅ Loaded Question Bank: ${bank.length} questions total`);

// Check category composition
const categories = { C: 0, P: 0, V: 0 };
const topicBankCounts = {};
ALL_GRAMMAR_TOPICS.forEach(t => { topicBankCounts[t] = 0; });

for (const q of bank) {
  categories[q.category] = (categories[q.category] || 0) + 1;
  topicBankCounts[q.grammar_topic] = (topicBankCounts[q.grammar_topic] || 0) + 1;
}

console.log(`   - Conversation (C): ${categories.C}`);
console.log(`   - Reading Passage (P): ${categories.P}`);
console.log(`   - Vocabulary (V): ${categories.V}\n`);

console.log('📊 15-Topic Bank Distribution:');
for (const topic of ALL_GRAMMAR_TOPICS) {
  console.log(`   • ${TOPIC_DISPLAY_NAMES[topic] || topic}: ${topicBankCounts[topic]} questions`);
}

console.log('\n------------------------------------------------------');
console.log('🚀 Running 30-Question Adaptive Placement Simulation...');
console.log('------------------------------------------------------\n');

import { selectNextQuestion } from '../backend/src/services/placement.js';

const session = {
  abilityScore: 0,
  usedIds: new Set(),
  categoryHistory: [],
  grammarTopicCounts: {},
  recentVocabResponses: [],
  remaining: { C: 10, P: 10, V: 10 },
  responses: []
};

for (let i = 1; i <= 30; i++) {
  const question = selectNextQuestion(bank, session);
  if (!question) {
    console.error(`❌ Failed to draw question for slot #${i}`);
    break;
  }

  session.usedIds.add(question.id);
  session.categoryHistory.push(question.category);
  if (session.remaining[question.category] > 0) {
    session.remaining[question.category]--;
  }
  session.grammarTopicCounts[question.grammar_topic] = (session.grammarTopicCounts[question.grammar_topic] || 0) + 1;

  // Simulate answers (mix of correct and incorrect with confidence)
  const isCorrect = Math.random() > 0.35;
  const confidence = isCorrect ? 'certain' : 'fairly_sure';
  const evalRes = evaluateAnswer(
    question,
    isCorrect ? question.options.findIndex(o => o.correct) : 0,
    confidence,
    20
  );

  session.abilityScore += evalRes.scoreMovement;

  if (question.category === 'V') {
    session.recentVocabResponses.push({
      isCorrect,
      vocab_tier: question.vocab_tier || 'tier1'
    });
  }

  session.responses.push({
    ...evalRes,
    category: question.category,
    grammar_topic: question.grammar_topic,
    vocab_tier: question.vocab_tier,
    question
  });
}

const finalResults = calculateFinalResults(session.responses, session.abilityScore);

console.log(`🎯 Assessed Level: ${finalResults.finalLevel} (${finalResults.levelDetails.title})`);
console.log(`📈 Ability Score: ${finalResults.abilityScore}`);
console.log(`✅ Overall Accuracy: ${finalResults.overallAccuracy}% (${finalResults.correctCount}/30 correct)`);
console.log(`⏱️ Total Time: ${Math.round(finalResults.totalTimeSeconds / 60)}m ${finalResults.totalTimeSeconds % 60}s`);

console.log('\n📊 15-Topic Heatmap Verification (Target: 2 Qs each = 30 Qs):');
let allCovered = true;
for (const topic of ALL_GRAMMAR_TOPICS) {
  const item = finalResults.grammarHeatmap[topic];
  const count = item?.sampleSize || 0;
  const status = item?.status || 'insufficient_data';
  const acc = item?.accuracy !== null ? `${item.accuracy}%` : '—';
  console.log(`   [${count === 2 ? '✅' : count > 0 ? '⚠️' : '❌'}] ${item.displayName}: ${count} Qs (${acc} · ${status})`);
  if (count === 0) allCovered = false;
}

console.log(`\n🏆 Champion Zones: ${finalResults.championZones.map(z => z.displayName).join(', ') || 'None'}`);
console.log(`🌱 Growth Zones: ${finalResults.growthZones.map(z => z.displayName).join(', ') || 'None'}`);
console.log(`📚 Vocab Tier: ${finalResults.vocabTierReached}`);

console.log('\n======================================================');
if (allCovered) {
  console.log('🎉 VERIFICATION PASSED: All 15 grammar topics tested with full coverage!');
} else {
  console.error('❌ VERIFICATION FAILED: Some topics received 0 questions.');
}
console.log('======================================================\n');
