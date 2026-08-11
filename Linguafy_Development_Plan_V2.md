# Linguafy Development Plan V2
## Building a Real, Working English Learning App in 8 Weeks

**Context:** You have a polished React frontend from Codex. All UI exists. Now we build the backend, wire it up, and launch something real that your friends can actually use to improve their English.

**Strategy:** Write-first. Get Writing Feedback 100% working end-to-end (database → backend → frontend), then use that exact pattern to build Grammar, Vocabulary, Exam, and Conversation sequentially.

**Team:** Rotating between you, Codex, and friends. Clear handoff points, no blockers.

**Timeline:** 8 weeks, calm pace. Ship Week 8.

---

## Executive Summary: What Gets Built

### Week 1–2: Foundation
- Database schema (users, submissions, progress)
- Express backend scaffolding
- Groq API integration
- Auth system (signup/login)

### Week 3–4: Writing Feature (End-to-End)
- Backend: `/api/feedback/analyze-text` → Groq → database
- Frontend: Connect Writing UI to real backend
- Test: Paste text → get real feedback → see it saved in dashboard
- **Result: First feature fully working**

### Week 5: Grammar Feature (Replicating Pattern)
- Backend: `/api/feedback/grammar-drill`
- Frontend: Wire up existing grammar UI
- Same test cycle
- **Result: Two features fully working**

### Week 6: Vocabulary Feature
- Backend: `/api/feedback/vocabulary-check`
- Frontend: Wire vocabulary UI
- **Result: Three features fully working**

### Week 7: Exam Prep + Conversation
- Exam: `/api/exam/submit` (essay scoring)
- Conversation: `/api/conversation/send` (multi-turn chat)
- Lighter implementation (faster if time tight)

### Week 8: Polish, Deploy, Launch
- User testing with friends
- Bug fixes
- Deploy to production
- **Result: Live, real app**

---

## Part 1: Database Schema (Exact Implementation)

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  language_level VARCHAR(10), -- 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Writing Submissions
```sql
CREATE TABLE writing_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  context VARCHAR(50), -- 'email', 'essay', 'casual', etc.
  
  -- Groq feedback (stored as JSON)
  errors JSONB, -- [{error: "...", should_be: "...", reason: "..."}]
  suggestions JSONB, -- [{text: "...", type: "grammar|tone|vocabulary"}]
  tone_assessment VARCHAR(255),
  vocabulary_alternatives JSONB,
  
  -- Scoring
  score INT, -- 1-100
  score_breakdown JSONB, -- {grammar: 8, tone: 7, vocabulary: 8}
  
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_writing_user ON writing_submissions(user_id);
```

### Grammar Drills
```sql
CREATE TABLE grammar_drills (
  id SERIAL PRIMARY KEY,
  pillar VARCHAR(100), -- 'subjunctive', 'inversion', etc.
  question_text TEXT NOT NULL,
  options JSONB, -- {A: "...", B: "...", C: "...", D: "..."}
  correct_answer VARCHAR(1), -- 'A', 'B', 'C', or 'D'
  explanation TEXT,
  difficulty INT -- 1-5
);

CREATE TABLE grammar_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  drill_id INT REFERENCES grammar_drills(id),
  user_answer VARCHAR(1),
  correct BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_grammar_user ON grammar_attempts(user_id);
```

### Vocabulary Progress
```sql
CREATE TABLE vocabulary_words (
  id SERIAL PRIMARY KEY,
  word VARCHAR(100) UNIQUE NOT NULL,
  definition TEXT,
  context_sentence TEXT,
  difficulty INT, -- 1-5
  category VARCHAR(50), -- 'formal', 'academic', 'business', etc.
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE vocabulary_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  word_id INT REFERENCES vocabulary_words(id),
  
  -- User's practice sentence
  user_sentence TEXT,
  correct BOOLEAN,
  score INT, -- 1-10
  
  attempts INT DEFAULT 1,
  mastered BOOLEAN DEFAULT FALSE,
  last_attempt TIMESTAMP DEFAULT NOW(),
  next_review TIMESTAMP, -- For spaced repetition
  
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_vocab_user ON vocabulary_progress(user_id);
```

### Exam Attempts
```sql
CREATE TABLE exam_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  exam_type VARCHAR(50), -- 'IELTS', 'TOEFL', 'Cambridge'
  task_type VARCHAR(50), -- 'Writing Task 2', 'Independent Essay', etc.
  
  essay_text TEXT NOT NULL,
  word_count INT,
  
  -- IELTS band scores (0-9 scale)
  task_achievement DECIMAL(2,1),
  coherence_cohesion DECIMAL(2,1),
  lexical_resource DECIMAL(2,1),
  grammatical_accuracy DECIMAL(2,1),
  band_estimate DECIMAL(2,1), -- Overall band (6.5, 7.0, etc.)
  
  feedback JSONB,
  
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_exam_user ON exam_attempts(user_id);
```

### Conversation History
```sql
CREATE TABLE conversation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  scenario VARCHAR(100), -- 'job_interview', 'casual_chat', etc.
  
  created_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP
);

CREATE TABLE conversation_turns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  user_message TEXT,
  bot_response TEXT,
  grammar_notes JSONB, -- [{error: "...", correct: "..."}]
  turn_number INT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Dashboard Progress Tracking
```sql
CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Weekly stats
  writing_submissions INT DEFAULT 0,
  writing_avg_score DECIMAL(3,1),
  
  grammar_drills_done INT DEFAULT 0,
  grammar_accuracy DECIMAL(3,1),
  
  vocab_words_learned INT DEFAULT 0,
  vocab_mastery DECIMAL(3,1),
  
  exam_attempts INT DEFAULT 0,
  exam_avg_band DECIMAL(2,1),
  
  conversation_sessions INT DEFAULT 0,
  
  week_start DATE,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Part 2: Backend Architecture

### Tech Stack (Final)
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **ORM:** Prisma (handles all database queries type-safely)
- **Database:** PostgreSQL via Supabase
- **AI:** Groq API (for text analysis)
- **Auth:** Supabase Auth (JWT tokens)
- **Hosting:** Railway or Render

### Project Structure
```
backend/
├── src/
│   ├── routes/
│   │   ├── auth.js            (signup, login, refresh token)
│   │   ├── writing.js         (POST /analyze-text)
│   │   ├── grammar.js         (POST /check-answer)
│   │   ├── vocabulary.js      (POST /validate-word)
│   │   ├── exam.js            (POST /submit-essay)
│   │   ├── conversation.js    (POST /send-message)
│   │   └── dashboard.js       (GET /progress)
│   ├── middleware/
│   │   ├── auth.js            (verify JWT token)
│   │   └── errorHandler.js
│   ├── services/
│   │   ├── groq.js            (Groq API calls)
│   │   ├── database.js        (Prisma client)
│   │   └── scoring.js         (Calculate scores)
│   ├── prompts/
│   │   ├── writing.js         (Groq prompts for writing)
│   │   ├── vocabulary.js
│   │   ├── exam.js
│   │   └── conversation.js
│   └── index.js               (Express app setup)
├── .env                       (API keys, database URL)
├── package.json
└── prisma/
    └── schema.prisma          (Database schema in Prisma format)
```

### Core Services

#### Groq Service (`src/services/groq.js`)
```javascript
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function analyzeWriting(text, context) {
  const message = await groq.messages.create({
    model: "mixtral-8x7b-32768",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: WRITING_ANALYSIS_PROMPT(text, context)
      }
    ],
  });
  
  const responseText = message.content[0].text;
  return JSON.parse(responseText);
}

export async function checkVocabularyUsage(word, userSentence) {
  const message = await groq.messages.create({
    model: "mixtral-8x7b-32768",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: VOCABULARY_CHECK_PROMPT(word, userSentence)
      }
    ],
  });
  
  return JSON.parse(message.content[0].text);
}

export async function scoreIELTSEssay(essayText) {
  const message = await groq.messages.create({
    model: "mixtral-8x7b-32768",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: IELTS_SCORING_PROMPT(essayText)
      }
    ],
  });
  
  return JSON.parse(message.content[0].text);
}

export async function generateConversationResponse(scenario, history) {
  const message = await groq.messages.create({
    model: "mixtral-8x7b-32768",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: CONVERSATION_PROMPT(scenario, history)
      }
    ],
  });
  
  return {
    response: message.content[0].text,
    grammarNotes: extractGrammarErrors(history) // Silent analysis
  };
}
```

#### Database Service (`src/services/database.js`)
```javascript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Writing submissions
export async function saveWritingSubmission(userId, text, context, feedback, score) {
  return prisma.writingSubmission.create({
    data: {
      userId,
      text,
      context,
      errors: feedback.errors,
      suggestions: feedback.suggestions,
      toneAssessment: feedback.tone,
      vocabularyAlternatives: feedback.alternatives,
      score,
      scoreBreakdown: feedback.breakdown,
    },
  });
}

// Grammar drills
export async function saveGrammarAttempt(userId, drillId, userAnswer, correct) {
  return prisma.grammarAttempt.create({
    data: { userId, drillId, userAnswer, correct },
  });
}

// Get user's progress for dashboard
export async function getUserProgress(userId) {
  const writes = await prisma.writingSubmission.findMany({ where: { userId } });
  const grammar = await prisma.grammarAttempt.findMany({ where: { userId } });
  const vocab = await prisma.vocabularyProgress.findMany({ where: { userId } });
  
  return {
    writingCount: writes.length,
    writingAvg: writes.length ? writes.reduce((a,b) => a + b.score, 0) / writes.length : 0,
    grammarCount: grammar.length,
    grammarAccuracy: grammar.length ? (grammar.filter(g => g.correct).length / grammar.length) * 100 : 0,
    vocabCount: vocab.filter(v => v.mastered).length,
    weakAreas: identifyWeakAreas(grammar, vocab),
  };
}

export default prisma;
```

---

## Part 3: Groq Prompts (Copy-Paste Ready)

### Writing Analysis Prompt
```javascript
export const WRITING_ANALYSIS_PROMPT = (text, context) => `
You are an expert English language teacher. Analyze this ${context}:

"${text}"

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "errors": [
    {
      "text": "the exact phrase with error",
      "should_be": "corrected version",
      "reason": "grammar rule or explanation"
    }
  ],
  "suggestions": [
    {
      "text": "alternative phrasing suggestion",
      "type": "grammar|tone|vocabulary|style"
    }
  ],
  "tone": "professional|casual|formal|neutral|${context}",
  "tone_feedback": "1 sentence assessment of tone appropriateness",
  "alternatives": [
    {
      "original": "phrase",
      "improved": "better version",
      "reason": "why this is better"
    }
  ]
}
`;
```

### Vocabulary Check Prompt
```javascript
export const VOCABULARY_CHECK_PROMPT = (word, userSentence) => `
The word is: "${word}"
User's sentence: "${userSentence}"

Evaluate on:
1. Is the word used correctly?
2. Is the grammar of their sentence correct?
3. How sophisticated is their usage? (1-10)

Respond ONLY with JSON:
{
  "word_correct": true/false,
  "grammar_correct": true/false,
  "sophistication_score": 7,
  "feedback": "one sentence explaining their usage",
  "better_version": "if errors, provide a corrected sentence or null"
}
`;
```

### IELTS Essay Scoring Prompt
```javascript
export const IELTS_SCORING_PROMPT = (essayText) => `
You are an official IELTS examiner. Score this essay (max 350 words recommended for Task 2):

"${essayText}"

Score on 0-9 scale for each criterion. Respond ONLY with JSON:
{
  "task_achievement": 7.5,
  "coherence_cohesion": 7.0,
  "lexical_resource": 7.5,
  "grammatical_accuracy": 7.0,
  "band_estimate": 7.0,
  "feedback": "2-3 sentences on main strengths and one area to improve",
  "common_errors": ["error 1", "error 2"]
}
`;
```

### Conversation Prompt
```javascript
export const CONVERSATION_PROMPT = (scenario, messageHistory) => `
You are a friendly English conversation partner. The scenario is: "${scenario}"

Stay in character. Respond naturally and conversationally. After this turn, silently note any grammar errors the user made (but don't break character to mention them).

Conversation so far:
${messageHistory.map(m => `${m.role === 'user' ? 'User' : 'You'}: ${m.text}`).join('\n')}

User's latest message: [will be appended by system]

Your response (keep it natural, 1-2 sentences):
`;
```

---

## Part 4: API Endpoints (Week-by-Week Build)

### Week 1–2: Auth Routes (Prerequisites)

#### `POST /api/auth/signup`
```javascript
// Request:
{
  "email": "user@example.com",
  "password": "secure_password",
  "name": "John Doe",
  "languageLevel": "B2"
}

// Response:
{
  "success": true,
  "user": { "id": "uuid", "email": "...", "name": "..." },
  "token": "jwt_token_here"
}
```

#### `POST /api/auth/login`
```javascript
// Request:
{
  "email": "user@example.com",
  "password": "secure_password"
}

// Response:
{
  "success": true,
  "user": { "id": "uuid", "email": "...", "name": "..." },
  "token": "jwt_token_here"
}
```

#### `GET /api/auth/me` (Protected)
```javascript
// Headers: Authorization: Bearer {token}
// Response:
{
  "user": { "id": "uuid", "email": "...", "name": "...", "level": "B2" }
}
```

### Week 3–4: Writing Feature (Core)

#### `POST /api/feedback/analyze-text` (Protected)
```javascript
// Request:
{
  "text": "I go to school every day.",
  "context": "email" // or "essay", "casual"
}

// Backend does:
// 1. Validate input (not empty, not too long)
// 2. Call Groq with WRITING_ANALYSIS_PROMPT
// 3. Parse Groq response (JSON)
// 4. Save to database (writingSubmissions table)
// 5. Return feedback to frontend

// Response:
{
  "success": true,
  "feedback": {
    "errors": [
      {
        "text": "I go",
        "should_be": "I goes",
        "reason": "Present tense, 3rd person singular needs -s"
      }
    ],
    "suggestions": [...],
    "tone": "too casual for email",
    "alternatives": [...]
  },
  "score": 65,
  "submission_id": "uuid" // For tracking
}

// Error:
{
  "success": false,
  "error": "Text is too long (max 2000 chars)"
}
```

### Week 5: Grammar Feature

#### `GET /api/drills/grammar?pillar=subjunctive` (Protected)
```javascript
// Get a random drill question from a specific pillar
// Response:
{
  "id": 42,
  "question": "Choose the correct version...",
  "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "pillar": "subjunctive",
  "difficulty": 3
}
```

#### `POST /api/feedback/grammar-drill` (Protected)
```javascript
// Request:
{
  "drill_id": 42,
  "user_answer": "B"
}

// Backend does:
// 1. Look up drill_id in grammar_drills table
// 2. Check if user_answer === correct_answer
// 3. Save attempt to grammar_attempts
// 4. Return result + explanation

// Response:
{
  "correct": true,
  "explanation": "Correct! After 'suggest that', use the base form (subjunctive)...",
  "pillar": "subjunctive",
  "accuracy_this_pillar": "8/10" // User's running accuracy on this pillar
}
```

### Week 6: Vocabulary Feature

#### `GET /api/vocabulary/daily` (Protected)
```javascript
// Get today's word of the day (same for all users)
// Response:
{
  "word_id": 123,
  "word": "ephemeral",
  "definition": "Lasting for a very short time",
  "context_examples": [
    "Cherry blossoms are ephemeral — they bloom for just two weeks",
    "Youth is ephemeral; we should enjoy it"
  ],
  "difficulty": 4
}
```

#### `POST /api/feedback/vocabulary-check` (Protected)
```javascript
// Request:
{
  "word_id": 123,
  "user_sentence": "My happiness was ephemeral when my dog ran away"
}

// Backend does:
// 1. Get word details from vocabulary_words table
// 2. Call Groq with VOCABULARY_CHECK_PROMPT
// 3. Save attempt to vocabulary_progress
// 4. Update mastery status if applicable

// Response:
{
  "correct": true,
  "sophistication_score": 8,
  "feedback": "Perfect usage! Your sentence shows sophisticated understanding.",
  "better_version": null,
  "mastered": false, // Mastered after 3+ correct attempts
  "user_progress": { "attempts": 1, "correct": 1 }
}
```

### Week 7: Exam Feature

#### `POST /api/exam/submit` (Protected)
```javascript
// Request:
{
  "exam_type": "IELTS",
  "task_type": "Writing Task 2",
  "essay_text": "Some people think universities should focus on practical skills..."
}

// Backend does:
// 1. Validate essay (word count 150-400 for Task 2)
// 2. Call Groq with IELTS_SCORING_PROMPT
// 3. Parse band scores (0-9 scale)
// 4. Save to exam_attempts table
// 5. Update user_progress

// Response:
{
  "success": true,
  "scores": {
    "task_achievement": 7.5,
    "coherence": 7.0,
    "lexical": 7.5,
    "grammar": 7.0,
    "band_estimate": 7.0
  },
  "feedback": "Good essay structure...",
  "common_errors": ["subject-verb agreement in paragraph 2"],
  "attempt_id": "uuid"
}
```

### Week 7: Conversation Feature

#### `POST /api/conversation/send` (Protected)
```javascript
// Request:
{
  "session_id": "uuid" OR null,
  "scenario": "job_interview",
  "user_message": "Hi, my name is John. I am software engineer..."
}

// Backend does:
// 1. Create new conversation_sessions if null
// 2. Get full conversation history from conversation_turns
// 3. Call Groq with CONVERSATION_PROMPT
// 4. Silently analyze grammar errors
// 5. Save user_message + bot_response to conversation_turns

// Response:
{
  "success": true,
  "session_id": "uuid",
  "bot_response": "That's great! Can you tell me about your most recent project?",
  "turn_number": 1,
  "grammar_notes": [
    {
      "error": "I am software engineer",
      "correct": "I am a software engineer",
      "type": "article"
    }
  ]
}
```

### Dashboard Endpoint

#### `GET /api/user/progress` (Protected)
```javascript
// Response:
{
  "user": { "name": "John", "level": "B2" },
  "this_week": {
    "writing_submissions": 3,
    "writing_avg_score": 72,
    "grammar_drills": 15,
    "grammar_accuracy": 80,
    "vocab_learned": 5,
    "vocab_mastery": 100,
    "exam_attempts": 0,
    "conversations": 1
  },
  "weak_areas": [
    { "pillar": "subjunctive_mood", "accuracy": 40 },
    { "area": "register_shifting", "accuracy": 55 }
  ],
  "recommendations": [
    "Practice subjunctive mood (you're at 40%)",
    "Try another IELTS essay (band 7.0 last time)"
  ]
}
```

---

## Part 5: Frontend Wiring (What to Replace in Codex UI)

### Week 3–4: Wire Writing Feature

**File:** `frontend/app/dashboard/writing/page.tsx`

**Current code (mock):**
```javascript
const analyze = () => {
  setLoading(true);
  setTimeout(() => {
    setResult(MOCK_FEEDBACK); // Hard-coded
    setLoading(false);
  }, 850);
};
```

**New code (real API call):**
```javascript
const analyze = async () => {
  setLoading(true);
  try {
    const response = await fetch('/api/feedback/analyze-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        text: submission,
        context: selectedContext
      })
    });
    
    if (!response.ok) throw new Error('Failed to analyze');
    const data = await response.json();
    
    setResult(data.feedback);
    setScore(data.score);
    setSubmissionId(data.submission_id);
  } catch (error) {
    setError(error.message);
  }
  setLoading(false);
};
```

**Same pattern applies to Grammar, Vocabulary, Exam, Conversation — just swap the endpoint and request body.**

### Week 8: Dashboard Real Data

**Current:**
```javascript
// Mock progress
const stats = {
  writingCount: 3,
  writingAvg: 72,
  // ... all hard-coded
};
```

**New:**
```javascript
useEffect(() => {
  const fetchProgress = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/user/progress', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setStats(data.this_week);
    setWeakAreas(data.weak_areas);
  };
  
  fetchProgress();
}, []);
```

---

## Part 6: 8-Week Development Timeline

### Week 1: Database + Backend Foundation
**Lead:** Codex (or primary backend dev)  
**Tasks:**
- [ ] Set up Supabase project (PostgreSQL database)
- [ ] Create database schema (copy-paste from Part 1)
- [ ] Set up Express server, routes skeleton
- [ ] Install & configure Prisma ORM
- [ ] Set up Groq API key, test basic call
- [ ] Create auth middleware + signup/login routes
- [ ] Test auth with Postman (signup → login → token works)

**Deliverable:** Postman collection showing working auth endpoints

**Time:** 3–4 days if done focused

---

### Week 2: Writing Backend Complete
**Lead:** Backend dev  
**Parallel:** Frontend dev starts reading the code structure  
**Tasks:**
- [ ] Write `WRITING_ANALYSIS_PROMPT` (Part 3)
- [ ] Implement `groq.analyzeWriting()` service
- [ ] Implement `saveWritingSubmission()` database function
- [ ] Build `/api/feedback/analyze-text` endpoint
- [ ] Test end-to-end: curl → Groq → database → response
- [ ] Set up error handling (what if Groq times out?)
- [ ] Create 5 test submissions manually, verify they save

**Deliverable:** `/api/feedback/analyze-text` fully working, tested in Postman

**Time:** 3–4 days

---

### Week 3: Wire Writing Frontend
**Lead:** Frontend dev (you probably)  
**Parallel:** Backend dev starts Grammar endpoint  
**Tasks:**
- [ ] Replace Writing module mock with real API call (see Part 5)
- [ ] Add token storage (localStorage after login)
- [ ] Test: signup → login → write text → get feedback → see in dashboard
- [ ] Fix any CORS errors (backend needs CORS headers)
- [ ] Test on both desktop and mobile (Codex UI is responsive)
- [ ] Document any bugs found

**Deliverable:** Writing feature fully working end-to-end

**Time:** 2–3 days

**Checkpoint Celebration:** Your friends can now paste text and get real AI feedback. This is the moment the app becomes "real."

---

### Week 4: Bug Fixes + Grammar Backend
**Lead:** Rotating  
**Backend dev:** Build `/api/drills/grammar` + `/api/feedback/grammar-drill`  
**Frontend dev:** Fix Writing bugs, help test Grammar backend  
**Tasks (Backend):**
- [ ] Seed database with 20 grammar drills (subjunctive, inversion, etc. — match the 8 pillars)
- [ ] Implement grammar drill scoring
- [ ] Build endpoints

**Tasks (Frontend):**
- [ ] Test Grammar drills with backend
- [ ] Verify Postman responses

**Deliverable:** Grammar backend ready to wire

**Time:** 3–4 days

---

### Week 5: Grammar Frontend + Vocabulary Backend
**Lead:** Rotating  
**Frontend dev:** Wire Grammar UI (same pattern as Writing)  
**Backend dev:** Build Vocabulary endpoints  
**Tasks:**
- [ ] Write vocabulary check prompt (Part 3)
- [ ] Seed `vocabulary_words` table with 30 words (ephemeral, meticulous, etc.)
- [ ] Implement `/api/vocabulary/daily` + `/api/feedback/vocabulary-check`
- [ ] Frontend: wire Vocabulary UI

**Deliverable:** Grammar + Vocabulary both working

**Time:** 3–4 days

---

### Week 6: Exam Prep + Dashboard
**Lead:** Coordinated  
**Tasks:**
- [ ] Backend: Implement IELTS scoring (`/api/exam/submit`)
- [ ] Frontend: Wire Exam UI
- [ ] Backend: Implement `/api/user/progress` (aggregates all stats)
- [ ] Frontend: Wire Dashboard to real progress data
- [ ] User testing with 1–2 friends

**Deliverable:** All 4 features (Writing, Grammar, Vocabulary, Exam) working

**Time:** 3–4 days

---

### Week 7: Conversation + Polish
**Lead:** Backend dev + Frontend dev  
**Tasks:**
- [ ] Implement conversation endpoints (`/api/conversation/send`)
- [ ] Wire Conversation UI
- [ ] Comprehensive testing with friends (5–10 people)
- [ ] Collect feedback: What's broken? What's confusing?
- [ ] Bug fixes

**Deliverable:** All 5 features working, friends are using it

**Time:** 3–4 days

---

### Week 8: Deploy + Launch
**Lead:** DevOps-minded person (or Codex)  
**Tasks:**
- [ ] Deploy backend to Railway/Render
- [ ] Deploy frontend to Vercel
- [ ] Set up environment variables (Groq API key, database URL)
- [ ] Test live version with friends
- [ ] Create basic homepage/marketing
- [ ] Send invites to 20–50 people

**Deliverable:** Live, working app at a real URL

**Time:** 2–3 days

**Result:** Week 8 evening, you have a real English learning app online that people can use.

---

## Part 7: Testing & Quality Checklist

### Backend Testing (Before Wiring Frontend)
- [ ] Auth: signup → login → token refresh
- [ ] Writing: text → Groq → saves to DB → fetches back correctly
- [ ] Grammar: drill question → check answer → saves attempt
- [ ] Vocabulary: word → user sentence → validation → saves mastery
- [ ] Exam: essay → scores → saves with breakdown
- [ ] Conversation: message → bot reply → saves turn
- [ ] Error cases: empty input, timeout, Groq down → graceful error messages

**Tool:** Postman (test all endpoints with different inputs)

### Frontend Testing (After Wiring)
- [ ] Login works, token persists, logout clears it
- [ ] Each feature module wired correctly (API calls work)
- [ ] Loading states show while waiting for Groq (not blank white screen)
- [ ] Errors display clearly if API fails
- [ ] Dashboard loads real progress data
- [ ] Mobile responsive (test on phone/tablet)
- [ ] Accessibility: keyboard navigation, color contrast OK

**Tool:** Browser DevTools + manual testing + ask friends

### User Testing (Week 7)
- [ ] 5–10 friends use each feature
- [ ] Collect: What was confusing? What worked great? Any bugs?
- [ ] Specific questions:
  - Did the feedback from Writing help them improve?
  - Were Grammar drills clear?
  - Did they learn from Vocabulary practice?
  - Was the conversation natural?

### Performance Testing
- [ ] Writing analysis: < 3 seconds from submit to feedback
- [ ] Grammar drill: instant (no API call)
- [ ] Vocabulary check: < 2 seconds
- [ ] Exam scoring: < 5 seconds (essays are longer)
- [ ] Conversation: < 2 seconds per message

If anything takes >5 seconds, optimize (cache, batch requests, etc.)

---

## Part 8: Team Coordination

### Communication Structure
**Daily standup (15 min, async in Slack/Discord):**
```
Backend dev:
  "Built Writing analysis endpoint, tested in Postman ✅
   Grammar next → needs feedback schema design approval"

Frontend dev:
  "Wired Writing UI → calls real API now ✅
   Waiting for Grammar endpoints"

Testing/QA:
  "Tested Writing end-to-end, found CORS error
   Suggestion: add Origin header check"
```

**Weekly sync call (30 min, optional):**
- Review week's progress
- Unblock any person stuck
- Adjust next week if needed

### Handoff Points (No Blockers)
1. **End of Week 2:** Backend dev delivers Writing endpoint + Postman tests
2. **End of Week 3:** Frontend dev delivers wired Writing + dashboard skeleton
3. **End of Week 4:** Backend dev delivers Grammar + Vocabulary endpoints
4. **End of Week 5:** Frontend dev has all features wired, ready for user testing
5. **End of Week 8:** Everything deployed, real URL live

### Role Flexibility
**You (likely frontend-focused):**
- Week 1: Help set up database schema (copy-paste, minimal SQL)
- Week 2: Start learning Express patterns from Codex
- Week 3–5: Main wiring work
- Week 6+: Testing, feedback collection

**Codex (backend-focused):**
- Week 1–2: Database + auth + Writing endpoint (core work)
- Week 3+: Build remaining endpoints
- Week 8: Deploy + DevOps

**Friends:**
- Week 1–2: Documentation, seed data (grammar drills, vocab words)
- Week 5+: User testing, feedback, bug reporting

---

## Part 9: Groq Cost & Rate Limits

**Pricing:** ~$0.15 per 1M tokens (extremely cheap)

**Estimate:**
- 1,000 active users
- 5 writing submissions/user/month = 5,000 submissions
- ~500 tokens per submission = 2.5M tokens
- Cost: ~$0.40/month (basically free)

**Rate limiting:**
- Groq: 30 requests/minute (fast enough)
- If hitting limits, add queue: save request → retry in 5 seconds

**Cost optimization:**
- Cache common responses (e.g., "I go" error always same feedback)
- Batch vocabulary checks if possible
- Monitor actual costs first month

---

## Part 10: Launch Checklist

### Before Going Live (Week 8)
- [ ] All 5 features working locally
- [ ] Backend deployed (Railway/Render) and tested
- [ ] Frontend deployed (Vercel) and tested
- [ ] Environment variables set correctly
- [ ] Database backups configured
- [ ] Error logging set up (Sentry or similar)
- [ ] User can signup → login → use all features
- [ ] Privacy policy drafted
- [ ] Terms of service drafted

### Day 1: Soft Launch
- [ ] Invite 20 friends (people you trust to give feedback)
- [ ] Share live URL
- [ ] Monitor for errors (check logs hourly)
- [ ] Collect feedback in Slack/Discord

### Week 2+: Public Launch
- [ ] Fix bugs found
- [ ] Improve based on feedback
- [ ] Post on social media / HN / ProductHunt (optional)
- [ ] Plan next features (listening, spaced repetition, tutor mode)

---

## Part 11: Tech Stack Summary

| Layer | Tool | Why |
|---|---|---|
| **Frontend** | React (Codex UI) | Already built, tested |
| **Styling** | Tailwind CSS | Matches Codex |
| **Backend** | Express.js | Simple, fast, familiar |
| **Database** | PostgreSQL (Supabase) | Powerful, free tier generous |
| **ORM** | Prisma | Type-safe, no SQL needed |
| **AI** | Groq API | 5x faster than OpenAI, cheaper |
| **Auth** | Supabase Auth | JWT, built-in, integrates with DB |
| **Hosting** | Vercel (frontend) + Railway (backend) | Seamless CI/CD, auto-deploy |
| **Monitoring** | Sentry (optional) | Catch bugs in production |

---

## Part 12: Success Metrics (By Week 8)

**Technical:**
- ✅ All 5 features working end-to-end
- ✅ Latency < 3 seconds per request
- ✅ 0 critical bugs
- ✅ Auth system working (signup/login/logout)
- ✅ Dashboard showing real progress

**User:**
- ✅ 20+ friends can use it without help
- ✅ At least 10 people do Writing feedback, find it useful
- ✅ Grammar drills are clear
- ✅ Vocabulary words are learned (people report retention)
- ✅ Feedback from Groq is accurate (not hallucinated)

**Business:**
- ✅ Live at a real URL
- ✅ Database persisting data
- ✅ No Groq API errors in production
- ✅ Ready for next phase (more users, more features)

---

## Next Steps (Post-MVP)

Once this MVP is live (Week 9+), you can add:

1. **Listening practice** (speech-to-text + analysis)
2. **Spaced repetition** (algorithm to resurface vocabulary at optimal times)
3. **Tutor mode** (ask Claude questions about grammar)
4. **Community** (leaderboards, user submissions, peer feedback)
5. **Gamification** (streak, points, levels)
6. **Mobile app** (React Native version)
7. **Monetization** (free tier + pro subscription)

But that's phase 2. This plan gets you to a real, working MVP by Week 8.

---

## Final Advice

**The hardest part isn't the code. It's the coordination between people.**

- Write everything down (this plan)
- Commit to weekly handoffs
- Test continuously (don't build everything then test)
- Ask friends for feedback early and often

**You're building something real. Enjoy it.**

By Week 8, real people will be using your app to improve their English. That's not small. That's shipping.

Let's build it.
