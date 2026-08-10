# Linguafy — English Trainer

An interactive React MVP for English practice. It includes a dashboard, AI-style writing feedback, grammar drills, vocabulary practice, IELTS writing preparation, and conversational roleplay.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## Current implementation

The learning flows are functional in the browser and use deterministic local feedback so the app works without credentials. Connect the form actions to the planned Express/Supabase/Groq API before production use; do not expose a Groq key in the client.
