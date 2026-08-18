import { randomUUID } from 'node:crypto';

export const local = {
  users: new Map(), writing: [], grammarAttempts: [], vocabulary: [], vocabularyAttempts: [], exams: [], conversations: new Map(),
  drills: [
    { id: 1, pillar: 'subject_verb_agreement', question: 'Neither the manager nor the employees ___ available for comment.', options: { A: 'is', B: 'are' }, correct: 'B', difficulty: 2, explanation: 'With neither nor, the verb agrees with the closest subject. Employees is plural, so use are.' },
    { id: 2, pillar: 'subjunctive', question: 'The director suggested that every applicant ___ the form before Friday.', options: { A: 'submits', B: 'submit' }, correct: 'B', difficulty: 3, explanation: 'After suggest that, formal English uses the base verb form: submit.' },
    { id: 3, pillar: 'inversion', question: 'Not only ___ the deadline, but she also improved the final report.', options: { A: 'she met', B: 'did she meet' }, correct: 'B', difficulty: 4, explanation: 'Starting with Not only requires auxiliary-subject inversion: did she meet.' },
    { id: 4, pillar: 'tenses', question: 'By the time the meeting starts, I ___ the presentation.', options: { A: 'will have finished', B: 'have finished' }, correct: 'A', difficulty: 3, explanation: 'Use the future perfect for an action completed before a future point: will have finished.' },
    { id: 5, pillar: 'prepositions', question: 'The team is responsible ___ reviewing the final proposal.', options: { A: 'for', B: 'to' }, correct: 'A', difficulty: 2, explanation: 'The fixed expression is responsible for followed by a gerund.' },
    { id: 6, pillar: 'articles', question: 'She is ___ honest and reliable colleague.', options: { A: 'a', B: 'an' }, correct: 'B', difficulty: 1, explanation: 'Honest starts with a vowel sound, so it takes an.' },
    { id: 7, pillar: 'conditionals', question: 'If I ___ more time, I would learn another language.', options: { A: 'had', B: 'would have' }, correct: 'A', difficulty: 3, explanation: 'The second conditional uses past simple in the if-clause: If I had, I would.' }
  ],
  words: [
    { word_id: 1, word: 'happy', definition: 'Feeling or showing pleasure or contentment.', context_examples: ['She felt happy after completing the project.'], difficulty: 1, category: 'basic' },
    { word_id: 2, word: 'reliable', definition: 'Consistently good in quality or performance; dependable.', context_examples: ['He is a reliable teammate who always meets deadlines.'], difficulty: 2, category: 'professional' },
    { word_id: 3, word: 'meticulous', definition: 'Showing great attention to detail; very careful and precise.', context_examples: ['Her meticulous research made the final proposal exceptionally convincing.'], difficulty: 3, category: 'business' },
    { word_id: 4, word: 'ephemeral', definition: 'Lasting for a very short time.', context_examples: ['The beauty of cherry blossoms is ephemeral.'], difficulty: 4, category: 'academic' },
    { word_id: 5, word: 'ubiquitous', definition: 'Present, appearing, or found everywhere.', context_examples: ['Smartphones are ubiquitous in modern cities.'], difficulty: 5, category: 'advanced' }
  ],
  user(id = 'local-user') { return this.users.get(id) || { id, email: 'local@linguafy.app', name: 'Learner', level: 'B2' }; },
  createUser(input) { const user = { id: randomUUID(), email: input.email, name: input.name || 'Learner', level: input.languageLevel || 'B2', password: input.password }; this.users.set(user.id, user); return user; },
  findUser(email) { return [...this.users.values()].find((user) => user.email === email); },
  session(user) { return `local-${user.id}`; }
};
