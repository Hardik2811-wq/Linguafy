# Linguafy — English Trainer

Full-stack English-learning app: React + Vite frontend, Express API, Groq feedback, and an optional Supabase production database/auth layer.

## Run locally

In one terminal, start the API:

```bash
cd backend
npm install
npm run dev
```

In another terminal, start the web app:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Create an account, then use Writing, Grammar, Vocabulary, Exam Prep, and Roleplay.

## Configuration

`backend/.env` contains server-only settings and is ignored by Git. Groq is configured there. With no Supabase variables the app runs in local development mode: accounts and progress exist for the current API session so every learning flow can be tested.

For persistent production users, create a Supabase project, run [supabase/schema.sql](supabase/schema.sql) and [supabase/seed.sql](supabase/seed.sql), then add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to `backend/.env` (see `backend/.env.example`). Never put those secrets or the Groq key in Vite environment variables.
