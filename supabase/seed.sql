insert into public.grammar_drills (pillar, question_text, options, correct_answer, explanation, difficulty) values
('subject_verb_agreement', 'Neither the manager nor the employees ___ available for comment.', '{"A":"is","B":"are"}', 'B', 'With neither…nor, the verb agrees with the subject closest to it. “Employees” is plural, so “are” is correct.', 2),
('subjunctive', 'The director suggested that every applicant ___ the form before Friday.', '{"A":"submits","B":"submit"}', 'B', 'After “suggest that,” formal English uses the base verb form: “submit.”', 3),
('inversion', 'Not only ___ the deadline, but she also improved the final report.', '{"A":"she met","B":"did she meet"}', 'B', 'Starting with “Not only” requires auxiliary–subject inversion: “did she meet.”', 4)
on conflict do nothing;
insert into public.vocabulary_words (word, definition, context_sentence, context_examples, difficulty, category) values
('meticulous', 'Showing great attention to detail; very careful and precise.', 'Her meticulous research made the final proposal exceptionally convincing.', '["The engineer kept meticulous records of every test.", "Her meticulous research made the final proposal exceptionally convincing."]', 3, 'business'),
('ephemeral', 'Lasting for a very short time.', 'The beauty of the cherry blossoms is ephemeral.', '["Social-media trends are often ephemeral.", "The beauty of the cherry blossoms is ephemeral."]', 4, 'academic'),
('articulate', 'Able to express ideas clearly and effectively.', 'She gave an articulate explanation of the proposal.', '["An articulate answer can make a strong first impression.", "She gave an articulate explanation of the proposal."]', 3, 'professional')
on conflict (word) do nothing;

-- Topic coverage for the adaptive grammar lab.
insert into public.grammar_drills (pillar, question_text, options, correct_answer, explanation, difficulty) values
('tenses', 'By the time the meeting starts, I ___ the presentation.', '{"A":"will have finished","B":"have finished"}', 'A', 'Use the future perfect for an action completed before a future point: “will have finished”.', 3),
('prepositions', 'The team is responsible ___ reviewing the final proposal.', '{"A":"for","B":"to"}', 'A', 'The fixed expression is “responsible for” followed by a gerund.', 2),
('articles', 'She is ___ honest and reliable colleague.', '{"A":"a","B":"an"}', 'B', '“Honest” starts with a vowel sound, so it takes “an”.', 1),
('conditionals', 'If I ___ more time, I would learn another language.', '{"A":"had","B":"would have"}', 'A', 'The second conditional uses past simple in the if-clause: “If I had …, I would …”.', 3);

-- Difficulty tiers: basic (1), intermediate (2-3), advanced (4), hard (5).
insert into public.vocabulary_words (word, definition, context_sentence, context_examples, difficulty, category) values
('happy', 'Feeling or showing pleasure or contentment.', 'She felt happy after completing the project.', '["They were happy with the result.", "She felt happy after completing the project."]', 1, 'basic'),
('reliable', 'Consistently good in quality or performance; dependable.', 'He is a reliable teammate who always meets deadlines.', '["A reliable source is important for research.", "He is a reliable teammate who always meets deadlines."]', 2, 'professional'),
('ubiquitous', 'Present, appearing, or found everywhere.', 'Smartphones are ubiquitous in modern cities.', '["Digital payments have become ubiquitous.", "Smartphones are ubiquitous in modern cities."]', 5, 'advanced')
on conflict (word) do nothing;
