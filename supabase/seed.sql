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
