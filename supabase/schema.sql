-- Linguafy V2 schema. Run this entire file in the Supabase SQL Editor.
create extension if not exists "uuid-ossp";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email varchar(255) unique not null,
  name varchar(255) not null,
  language_level varchar(10) not null default 'B2' check (language_level in ('A1','A2','B1','B2','C1','C2')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.writing_submissions (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references public.users(id) on delete cascade,
  text text not null, context varchar(50), errors jsonb default '[]'::jsonb, suggestions jsonb default '[]'::jsonb,
  tone_assessment varchar(255), vocabulary_alternatives jsonb default '[]'::jsonb, score int check (score between 0 and 100), score_breakdown jsonb default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.grammar_drills (
  id bigint generated always as identity primary key, pillar varchar(100) not null, question_text text not null, options jsonb not null,
  correct_answer varchar(1) not null, explanation text not null, difficulty int not null check (difficulty between 1 and 5)
);
create table if not exists public.grammar_attempts (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references public.users(id) on delete cascade,
  drill_id bigint not null references public.grammar_drills(id), user_answer varchar(1) not null, correct boolean not null,
  confidence varchar(20) not null default 'sure' check (confidence in ('sure','not_sure')), awarded_points smallint not null default 0 check (awarded_points in (0,1)),
  time_spent_seconds int not null default 0 check (time_spent_seconds between 0 and 7200), created_at timestamptz not null default now()
);
create table if not exists public.vocabulary_words (
  id bigint generated always as identity primary key, word varchar(100) unique not null, definition text not null, context_sentence text not null,
  context_examples jsonb default '[]'::jsonb, difficulty int not null check (difficulty between 1 and 5), category varchar(50), created_at timestamptz not null default now()
);
create table if not exists public.vocabulary_progress (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references public.users(id) on delete cascade,
  word_id bigint not null references public.vocabulary_words(id), user_sentence text, correct boolean, score int check (score between 1 and 10), attempts int not null default 1,
  mastered boolean not null default false, correct_uses int not null default 0, last_attempt timestamptz not null default now(), next_review timestamptz, created_at timestamptz not null default now(), unique(user_id, word_id)
);
create table if not exists public.vocabulary_attempts (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references public.users(id) on delete cascade,
  word_id bigint not null references public.vocabulary_words(id), user_sentence text not null, correct boolean not null,
  sophistication_score int check (sophistication_score between 1 and 10), time_spent_seconds int not null default 0 check (time_spent_seconds between 0 and 7200),
  created_at timestamptz not null default now()
);
create table if not exists public.exam_attempts (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references public.users(id) on delete cascade,
  exam_type varchar(50), task_type varchar(50), essay_text text not null, word_count int not null, task_achievement numeric(2,1), coherence_cohesion numeric(2,1), lexical_resource numeric(2,1), grammatical_accuracy numeric(2,1), band_estimate numeric(2,1), feedback jsonb default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.conversation_sessions (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references public.users(id) on delete cascade, scenario varchar(100) not null, created_at timestamptz not null default now(), ended_at timestamptz
);
create table if not exists public.conversation_turns (
  id uuid primary key default uuid_generate_v4(), session_id uuid not null references public.conversation_sessions(id) on delete cascade,
  user_message text not null, bot_response text not null, grammar_notes jsonb default '[]'::jsonb, turn_number int not null, created_at timestamptz not null default now()
);
create index if not exists idx_writing_user on public.writing_submissions(user_id); create index if not exists idx_grammar_user on public.grammar_attempts(user_id); create index if not exists idx_vocab_user on public.vocabulary_progress(user_id); create index if not exists idx_vocab_attempts_user on public.vocabulary_attempts(user_id); create index if not exists idx_exam_user on public.exam_attempts(user_id);

-- Safe upgrades for Supabase projects created before learning analytics was added.
alter table public.grammar_attempts add column if not exists confidence varchar(20) not null default 'sure' check (confidence in ('sure','not_sure'));
alter table public.grammar_attempts add column if not exists awarded_points smallint not null default 0 check (awarded_points in (0,1));
alter table public.grammar_attempts add column if not exists time_spent_seconds int not null default 0 check (time_spent_seconds between 0 and 7200);
alter table public.vocabulary_progress add column if not exists correct_uses int not null default 0;
update public.grammar_attempts set awarded_points = 1 where correct = true and confidence = 'sure' and awarded_points = 0;
update public.vocabulary_progress set correct_uses = attempts where correct = true and correct_uses = 0;

create table if not exists public.placement_questions (
  id uuid primary key default uuid_generate_v4(),
  external_id text unique not null,
  category text not null check (category in ('C', 'P', 'V')),
  grammar_topic text not null,
  vocab_tier text,
  estimated_difficulty float not null,
  cefr_reference text,
  question text not null,
  passage text,
  options jsonb not null,
  explanation text not null,
  expected_time_seconds int not null default 25,
  created_at timestamptz not null default now()
);

create table if not exists public.placement_attempts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  ability_score float default 0,
  final_level text,
  cpv_scores jsonb,
  grammar_heatmap jsonb,
  vocab_tier_reached text,
  category_counts jsonb,
  is_completed boolean default false
);

create table if not exists public.placement_responses (
  id uuid primary key default uuid_generate_v4(),
  attempt_id uuid not null references public.placement_attempts(id) on delete cascade,
  question_id uuid not null references public.placement_questions(id),
  user_answer text not null,
  is_correct boolean not null,
  confidence varchar(20) not null check (confidence in ('certain', 'fairly_sure', 'not_sure')),
  time_taken_seconds int not null default 0,
  pace_signal text,
  score_movement int,
  ability_score_after float,
  answered_at timestamptz not null default now()
);

create index if not exists idx_placement_user on public.placement_attempts(user_id);
create index if not exists idx_placement_resp_attempt on public.placement_responses(attempt_id);

alter table public.users enable row level security; alter table public.writing_submissions enable row level security; alter table public.grammar_attempts enable row level security; alter table public.vocabulary_progress enable row level security; alter table public.vocabulary_attempts enable row level security; alter table public.exam_attempts enable row level security; alter table public.conversation_sessions enable row level security; alter table public.conversation_turns enable row level security;
alter table public.placement_questions enable row level security; alter table public.placement_attempts enable row level security; alter table public.placement_responses enable row level security;
-- The API uses the service-role key; it bypasses RLS. Do not expose that key to the browser.

