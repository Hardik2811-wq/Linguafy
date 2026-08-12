import Groq from 'groq-sdk';
import { config, requireConfig } from '../config.js';

let client;
function groq() { requireConfig('groqApiKey'); return client ??= new Groq({ apiKey: config.groqApiKey }); }

async function jsonCompletion(prompt, maxTokens = 900) {
  const completion = await groq().chat.completions.create({
    model: config.groqModel,
    temperature: 0.2,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: 'You are a precise English teacher. Return only the requested valid JSON.' }, { role: 'user', content: prompt }]
  });
  try { return JSON.parse(completion.choices[0]?.message?.content || '{}'); }
  catch { throw Object.assign(new Error('The AI returned an invalid response. Please try again.'), { status: 502 }); }
}

export const analyzeWriting = (text, context) => jsonCompletion(`You are a professional English writing coach. Context this text was written in: "${context}".

TEXT TO ANALYZE:
"${text}"

Return STRICT JSON with EXACTLY these fields:
{
  "errors": [{"text": "quoted fragment", "should_be": "correction", "reason": "short grammar/spelling explanation"}],
  "suggestions": [{"text": "what to improve", "type": "clarity|style|register|structure|concision|word_choice", "improved": "a concrete rewritten example"}],
  "tone": "formal|neutral|informal|casual",
  "tone_feedback": "one-sentence assessment",
  "alternatives": [{"original": "word or short phrase", "improved": "stronger replacement", "reason": "one-liner"}],
  "score_breakdown": {"grammar": "0-100", "tone": "0-100", "vocabulary": "0-100"}
}

STRICT RULES:
1. "errors" may contain ONLY what a native editor would mark definitively wrong: grammar, spelling, verb tense, word-form confusion (e.g. "witch"→"which"). If the only possible correction is a preference, it is NOT an error.
2. NEVER report style preferences, optional punctuation (incl. commas before quotation marks), register choices, active-vs-passive, or rewording as errors. Those go in "suggestions".
3. Evaluate relative to the context: for "Casual message" apply a relaxed informal standard — missing capitals, missing punctuation, and contractions like "wanna/im/gonna" are NORMAL and must NOT be errors. For "Essay"/"Cover letter"/"Professional email" apply a strict formal standard.
4. Neutral professional text is never called "informal", and a correct plain sentence gets grammar≈100, tone≈95+. If the text is already correct, return empty "errors" AND empty "suggestions".
5. "suggestions" must be specific and actual improvements — each MUST contain an "improved" rewritten example that differs from the original. Never echo the text verbatim. Max 3.
6. "alternatives" are single-word or short-phrase lexical upgrades with reasons — NOT whole-sentence rewrites. Max 3.`, 1100);
export const checkVocabulary = (word, sentence) => jsonCompletion(`Target word: "${word}"\nStudent sentence: "${sentence}"\n\nReturn {word_correct:boolean, grammar_correct:boolean, sophistication_score:number 1-10, feedback:string, better_version:string|null}.`, 350);
export const scoreEssay = (text) => jsonCompletion(`Act as an official IELTS Writing Task 2 examiner. Score this essay:\n\n"${text}"\n\nReturn {task_achievement:number 0-9, coherence_cohesion:number 0-9, lexical_resource:number 0-9, grammatical_accuracy:number 0-9, band_estimate:number 0-9, feedback:string, common_errors:string[]}.`, 700);

export async function conversationReply(scenario, history, message) {
  const prompt = `You are a friendly English conversation partner in this scenario: "${scenario}". Stay in character and respond naturally in 1–2 sentences. Silently assess the user's latest English.\n\nHistory:\n${history.map((turn) => `${turn.user_message ? `User: ${turn.user_message}` : ''}${turn.bot_response ? `\nCoach: ${turn.bot_response}` : ''}`).join('\n')}\n\nLatest user message: ${message}\n\nReturn {bot_response:string, grammar_notes:[{error:string, correct:string, type:string}]}.`;
  return jsonCompletion(prompt, 450);
}
