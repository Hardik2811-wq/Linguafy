import { randomUUID } from 'node:crypto';

export const local = {
  users: new Map(), writing: [], grammarAttempts: [], vocabulary: [], exams: [], conversations: new Map(),
  drills: [
    { id: 1, pillar: 'subject_verb_agreement', question: 'Neither the manager nor the employees ___ available for comment.', options: { A: 'is', B: 'are' }, correct: 'B', explanation: 'With neither…nor, the verb agrees with the closest subject. “Employees” is plural, so use “are”.' },
    { id: 2, pillar: 'subjunctive', question: 'The director suggested that every applicant ___ the form before Friday.', options: { A: 'submits', B: 'submit' }, correct: 'B', explanation: 'After “suggest that,” formal English uses the base verb form: “submit”.' }
  ],
  words: [
    { word_id: 1, word: 'meticulous', definition: 'Showing great attention to detail; very careful and precise.', context_examples: ['Her meticulous research made the final proposal exceptionally convincing.'], difficulty: 3, category: 'business' },
    { word_id: 2, word: 'ephemeral', definition: 'Lasting for a very short time.', context_examples: ['The beauty of cherry blossoms is ephemeral.'], difficulty: 4, category: 'academic' }
  ],
  user(id = 'local-user') { return this.users.get(id) || { id, email: 'local@linguafy.app', name: 'Learner', level: 'B2' }; },
  createUser(input) { const user = { id: randomUUID(), email: input.email, name: input.name || 'Learner', level: input.languageLevel || 'B2', password: input.password }; this.users.set(user.id, user); return user; },
  findUser(email) { return [...this.users.values()].find((user) => user.email === email); },
  session(user) { return `local-${user.id}`; }
};
