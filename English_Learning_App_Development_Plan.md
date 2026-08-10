# English Learning Web App — Development Plan

**Vision:** A full-stack web application that combines the 8 pillars of English learning with real-time AI feedback powered by Groq, enabling users to practice grammar, vocabulary, writing, speaking, and conversational English interactively.

---

## Phase 1: Foundation & MVP (Weeks 1–3)

### 1.1 Project Setup
**Duration:** 1 day  
**Deliverable:** Working dev environment

- [ ] Create a monorepo structure (or separate repos):
  ```
  english-learning-app/
  ├── frontend/          (React/Next.js)
  ├── backend/           (Node.js/Express)
  ├── docs/              (API specs, design)
  └── README.md
  ```
- [ ] Set up Git repo (GitHub) with branch strategy (main, dev, feature/*)
- [ ] Choose hosting plan:
  - **Frontend:** Vercel (Next.js native), Netlify, or Railway
  - **Backend:** Railway, Render, or AWS Lightsail
  - **Database:** Supabase (PostgreSQL) or MongoDB Atlas (easier for quick start)
- [ ] Environment variables & secrets management (.env files, Vercel/Railway dashboards)
- [ ] Groq API key setup and rate-limit planning

**Why first:** Everything else depends on this working smoothly.

---

### 1.2 Database Schema Design
**Duration:** 1 day  
**Deliverable:** SQL schema or Supabase setup

**Core entities:**
```
users
├── id (UUID)
├── email
├── password_hash
├── name
├── language_level (B2, C1, etc.)
├── created_at

learning_sessions
├── id
├── user_id
├── pillar (Formal Grammar, Vocabulary, etc.)
├── task_type (grammar_drill, writing, speaking, etc.)
├── created_at

submissions
├── id
├── session_id
├── user_input (text)
├── groq_feedback (JSON: errors, suggestions, score)
├── timestamp

vocabulary_progress
├── id
├── user_id
├── word
├── context_sentence
├── user_sentence
├── mastered (boolean)
├── attempts

exam_attempts
├── id
├── user_id
├── exam_type (IELTS, TOEFL)
├── task_type (writing, speaking)
├── score
├── feedback (JSON)
├── timestamp
```

**Tools:**
- **Supabase** (PostgreSQL + auth built-in) — fastest for MVP
- **Prisma ORM** — type-safe database queries in Node

---

### 1.3 Backend API Scaffolding
**Duration:** 2 days  
**Deliverable:** Working Express server with Groq integration

**Stack:**
- Node.js + Express (or Fastify for speed)
- TypeScript (for type safety)
- Groq SDK for Node.js

**Core routes (Phase 1):**
```
POST /api/auth/signup
POST /api/auth/login
GET  /api/auth/me

POST /api/feedback/analyze-text
  ├─ Input: { text, context (e.g., "email", "essay") }
  └─ Output: { errors, suggestions, register_notes, vocabulary_alternatives }

POST /api/feedback/grammar-drill
  ├─ Input: { sentence, error_type }
  └─ Output: { explanation, corrected, examples }

POST /api/feedback/vocabulary-check
  ├─ Input: { user_sentence, target_word }
  └─ Output: { is_correct, alternatives, score }
```

**Groq integration pattern:**
```javascript
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function analyzeText(text, context) {
  const message = await groq.messages.create({
    model: "mixtral-8x7b-32768", // or llama-2-70b-chat
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are an expert English language teacher. Analyze this ${context}: "${text}"\n\nProvide feedback in JSON format with: errors (array), suggestions (array), tone_assessment (string), vocabulary_alternatives (array).`
      }
    ],
  });
  return JSON.parse(message.content[0].text);
}
```

**Testing:** Use Postman or Insomnia to verify each endpoint returns proper Groq responses.

---

### 1.4 Frontend MVP — Single Feature
**Duration:** 2–3 days  
**Deliverable:** Working React component + auth flow

**Tech:**
- Next.js (App Router preferred) + React
- TailwindCSS (fast styling)
- Zustand or Context API (state management — keep it simple)
- React Query for server state

**MVP feature: Writing Feedback Tool**
- Simple form: textarea for user's text + dropdown (email, essay, casual message)
- Click "Get Feedback"
- Display results: errors highlighted, suggestions in a sidebar, register notes
- Show loading spinner while Groq processes

**Component structure:**
```
app/
├── page.tsx (landing)
├── dashboard/
│   ├── layout.tsx
│   └── writing/
│       ├── page.tsx (main writing tool)
│       └── FeedbackDisplay.tsx
├── auth/
│   ├── login/page.tsx
│   └── signup/page.tsx
└── components/
    ├── Navbar.tsx
    ├── FeedbackPanel.tsx
    └── InputForm.tsx
```

**UI Flow:**
```
[Login] → [Dashboard] → [Select Pillar: Writing]
       → [Paste text] → [Choose context] → [Submit]
       → [Loading...] → [Feedback display with errors highlighted]
```

---

## Phase 2: Feature Expansion (Weeks 4–6)

### 2.1 Grammar Drills & Sentence Analysis
**Duration:** 2 days  
**Deliverable:** Interactive grammar drill interface + Groq prompt engineering

**Features:**
- Show a sentence with a potential error (or no error)
- User selects: "Error here" or "No error"
- Groq explains the rule and shows corrected version
- Track user accuracy per grammar concept (subjunctive, inversion, etc.)

**Groq prompt:**
```
You are an English grammar expert. A student chose: "[USER_CHOICE]" for this sentence: "[SENTENCE]"
The correct answer is: "[CORRECT_ANSWER]"

Explain the grammar rule in simple terms and provide 2 additional examples. Format as JSON.
```

**Database addition:**
- `grammar_drills` table to store drill answers and accuracy tracking

---

### 2.2 Vocabulary in Context
**Duration:** 2 days  
**Deliverable:** Word-of-the-day + sentence validation system

**Features:**
- Daily word from your list (ephemeral, meticulous, etc.)
- Show 2–3 contextualized sentences
- User writes their own sentence using the word
- Groq validates it, suggests improvements, scores it

**Groq validation prompt:**
```
The target word is: "[WORD]"
User's sentence: "[USER_SENTENCE]"

1. Is the word used correctly? (yes/no)
2. Suggest a better way to use it (if needed)
3. Rate the sophistication of their sentence (1-10)
4. Return as JSON: { correct: bool, feedback: string, score: number }
```

---

### 2.3 Exam Prep Module
**Duration:** 3 days  
**Deliverable:** IELTS/TOEFL writing task simulator + scoring

**Features:**
- IELTS Writing Task 2: user writes essay in 40 min (with timer)
- Groq scores on:
  - Lexical range (vocabulary diversity)
  - Grammatical accuracy
  - Coherence & cohesion (flow, connectors)
  - Task achievement (did they answer the question?)
  - Estimated band score (6.5–9)
- Display detailed feedback by category

**Groq scoring prompt:**
```
You are an IELTS examiner. Score this essay:
"[ESSAY_TEXT]"

Evaluate on:
1. Task Achievement (0-9): Did they fully address the prompt?
2. Coherence & Cohesion (0-9): Is it well-organized?
3. Lexical Resource (0-9): Vocabulary range and accuracy?
4. Grammatical Range & Accuracy (0-9): Grammar variety and mistakes?

Return JSON: { scores: { task: N, coherence: N, lexical: N, grammar: N }, band_estimate: N, feedback: string }
```

---

### 2.4 Roleplay/Conversation Mode
**Duration:** 3 days  
**Deliverable:** Multi-turn conversational interface

**Features:**
- User picks a scenario (job interview, casual chat, formal complaint, order at café)
- Groq plays the other person
- User responds, Groq:
  - Continues the conversation naturally
  - Logs errors/awkward phrasing
  - Provides feedback at the end
  - Suggests better responses for specific turns

**Implementation:**
- Store conversation history in state
- Each user message → Groq call (context-aware, remembers prior turns)
- Display both sides in a chat-like UI

**Groq system prompt:**
```
You are a friendly English conversation partner. The scenario is: "[SCENARIO]"
You should:
1. Stay in character
2. Respond naturally
3. After the user's next message, provide SILENT feedback on their grammar/vocabulary (don't break character)
4. When conversation ends, summarize improvements needed

Current conversation: [HISTORY]
User's message: "[USER_MESSAGE]"
Your response:
```

---

## Phase 3: Polish & Analytics (Weeks 7–8)

### 3.1 Dashboard & Progress Tracking
**Duration:** 2 days  
**Deliverable:** User dashboard with stats and recommendations

**Display:**
- Accuracy per pillar (grammar, vocabulary, etc.)
- Weak areas (e.g., "Subjunctive usage: 60%")
- Weekly streak & total XP/points
- Recommended next drill based on weak areas
- Progress toward a goal (exam date, CEFR level)

**Database query:** Aggregate submissions by pillar, calculate accuracy, rank weak areas.

---

### 3.2 User Preferences & Settings
**Duration:** 1 day  
**Deliverable:** Settings panel

- [ ] Language level (B2, C1, etc.)
- [ ] Learning goal (exam prep, work, casual, academic)
- [ ] Exam type (IELTS, TOEFL, Cambridge)
- [ ] Frequency preferences (daily streak, weekly goals)
- [ ] Notification settings

---

### 3.3 Mobile Responsiveness
**Duration:** 1 day  
**Deliverable:** Fully responsive UI

- TailwindCSS handles most of this automatically
- Test on mobile browsers
- Ensure touch-friendly inputs

---

### 3.4 Performance Optimization
**Duration:** 1 day  
**Deliverable:** Fast, snappy app

- [ ] Memoize React components (React.memo, useMemo)
- [ ] Lazy load route components
- [ ] Cache Groq responses where it makes sense (don't re-analyze identical texts)
- [ ] Rate-limit Groq calls on frontend (debounce/throttle)

---

## Phase 4: Advanced Features (Weeks 9+)

### 4.1 Listening & Transcription
- [ ] Integrate Whisper API (OpenAI) or Web Speech API (browser-native)
- [ ] User records themselves speaking, app transcribes + analyzes for pronunciation/fluency
- [ ] Groq evaluates coherence, grammar, vocabulary in spoken output

### 4.2 Spaced Repetition for Vocabulary
- [ ] Implement SM-2 algorithm for vocab retention
- [ ] Users revisit words at optimal intervals based on their recall
- [ ] Track long-term retention

### 4.3 AI Tutor Persona
- [ ] Allow users to ask grammar questions in plain English
- [ ] Groq explains with examples tailored to their level

### 4.4 Community Features
- [ ] Leaderboards (monthly top learners)
- [ ] Peer review: submit writing, get feedback from other users
- [ ] Discussion forum for common grammar/vocab questions

### 4.5 Export & Certificates
- [ ] Generate PDF progress report
- [ ] Exam score "certificate" for LinkedIn/resume

---

## Technical Decisions & Rationale

| Decision | Choice | Why |
|---|---|---|
| **Frontend Framework** | Next.js 14+ | Server components, API routes, fast deployment to Vercel |
| **Styling** | TailwindCSS | Speed, consistency, no CSS conflicts |
| **State Management** | Zustand or Context | Simple, lightweight, doesn't bloat bundle |
| **Database** | Supabase | Auth built-in, PostgreSQL power, free tier generous |
| **ORM** | Prisma | Type-safe, auto migrations, great DX |
| **LLM Provider** | Groq | 5x faster than OpenAI, cheaper, perfect for real-time feedback |
| **Auth** | Supabase Auth (Magic Links + Password) | No JWT headache, built-in MFA option |
| **Hosting** | Vercel (frontend) + Railway/Render (backend) | Seamless deploys, auto-scaling, CI/CD included |
| **Testing** | Jest + React Testing Library | Standard, good coverage, fast |
| **Monitoring** | Sentry (errors) + LogRocket (UX) | Debug issues quickly in production |

---

## Development Workflow

### Sprint Structure (2-week sprints)

**Sprint 1 (Weeks 1–2):**
- Foundation: database, auth, backend scaffolding
- MVP frontend: writing feedback tool only
- Deploy to staging

**Sprint 2 (Weeks 3–4):**
- Grammar drills + vocabulary module
- Exam prep writing task
- Dashboard skeleton

**Sprint 3 (Weeks 5–6):**
- Roleplay/conversation mode
- Progress analytics
- UI polish

**Sprint 4 (Weeks 7–8):**
- Mobile optimization
- Performance tuning
- Beta launch

**Post-MVP (Weeks 9+):**
- Advanced features (listening, spaced repetition, tutor, community)

---

## Deployment Strategy

### Staging Environment
- [ ] Create staging database (separate from production)
- [ ] Deploy frontend to staging URL (e.g., staging.app.com)
- [ ] Deploy backend to staging (e.g., api-staging.app.com)
- [ ] Test all flows end-to-end before releasing to main

### Production Rollout
1. **Week 4:** Closed beta (friends, colleagues test)
2. **Week 6:** Open beta (public, free tier limited)
3. **Week 8+:** Launch features incrementally, monitor Groq costs + latency

### CI/CD Pipeline
```yaml
# On every push to main:
- Run linter (ESLint, Prettier)
- Run tests (Jest, E2E Cypress)
- Build frontend
- Build backend
- Deploy to production (Vercel auto-deploys, manual trigger for backend)
```

---

## Groq API Cost & Optimization

**Pricing:** Groq is pay-as-you-go (~$0.15 per 1M tokens for llama-2)

**Optimization strategies:**
1. **Cache responses:** Don't re-analyze identical texts
2. **Prompt compression:** Use shorter, precise prompts (saves tokens)
3. **Batch operations:** If feasible, process multiple analyses in one call
4. **Rate limits:** Warn users if they hit quota (e.g., 50 analyses/day on free tier)
5. **Monitor costs:** Set up Groq dashboard alerts if spending spikes

**Rough monthly cost estimate (for 1000 active users):**
- 10 submissions/user/month × 1000 users = 10k submissions
- Avg 500 tokens per submission = 5M tokens
- At $0.15/1M = ~$0.75/month for Groq (incredibly cheap!)

---

## Team & Time Allocation

**Recommended team size:** 1–2 developers

| Role | Weeks 1–4 | Weeks 5–8 | Weeks 9+ |
|---|---|---|---|
| **Full-stack dev** | Database + Backend (50%), Frontend MVP (50%) | Feature dev, QA, bug fixes | Maintenance, new features |
| **Frontend specialist** (optional) | Dashboard design, component library | UI polish, animations | Advanced UI features |
| **Product/Design** (you?) | Requirements, user flows | Feedback loop, iteration | Analytics, user research |

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Groq API downtime | Users can't get feedback | Implement retry logic, queue submissions, fallback message |
| Rate limits (Groq) | Feedback denied at peak usage | Implement rate limiting on frontend, upgrade plan if needed |
| Poor prompt quality | Groq feedback is inaccurate | Iteratively refine prompts, gather user feedback, A/B test |
| Scaling DB queries | Dashboard slow with 10k+ users | Index key columns, use pagination, cache aggregations |
| Auth issues | Users can't log in | Use Supabase's battle-tested auth, test thoroughly before launch |

---

## Success Metrics

By end of Phase 2 (Week 6):
- [ ] Core features (writing, grammar, vocabulary) working without bugs
- [ ] Groq response time < 3 seconds
- [ ] Mobile UI responsive on all devices
- [ ] 10+ beta users testing, positive feedback

By end of Phase 3 (Week 8):
- [ ] Dashboard shows meaningful progress tracking
- [ ] 50+ beta users, 4.5+ star rating
- [ ] Exam prep module tested by IELTS learners
- [ ] Conversation mode feels natural

---

## Next Steps

1. **This week:** Choose tech stack, set up repos, create database schema
2. **Week 2:** Backend auth + Groq integration working
3. **Week 3:** First frontend feature (writing feedback) live on staging
4. **Week 4:** Invite beta testers, collect feedback

**Questions to clarify before starting:**
- Do you want to build this solo or with a team?
- Timeline: launch in 2 months, 4 months, or no rush?
- Budget for hosting/Groq costs?
- Any specific tech you're already comfortable with?

---

## Resources

**Documentation:**
- Groq API: https://console.groq.com/docs
- Next.js: https://nextjs.org/docs
- Supabase: https://supabase.com/docs
- Prisma: https://www.prisma.io/docs

**Similar apps for inspiration:**
- Duolingo (gamification, streaks)
- Grammarly (real-time feedback)
- LingQ (vocabulary in context)
- IELTS preparation platforms

---

Let me know if you want me to:
1. Build out the database schema in detail
2. Write the backend API scaffolding (Express + Groq)
3. Create the frontend MVP component
4. Design detailed Groq prompts for each feature
5. Set up the GitHub repo structure + CI/CD

What's your next move?
