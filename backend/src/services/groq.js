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

export const analyzeWriting = (text, context) => jsonCompletion(`Analyze this ${context} writing:\n\n"${text}"\n\nReturn JSON with errors (array of {text, should_be, reason}), suggestions (array of {text, type}), tone, tone_feedback, alternatives (array of {original, improved, reason}), and score_breakdown ({grammar: 0-100, tone: 0-100, vocabulary: 0-100}).`, 1000);
export const checkVocabulary = (word, sentence) => jsonCompletion(`Target word: "${word}"\nStudent sentence: "${sentence}"\n\nReturn {word_correct:boolean, grammar_correct:boolean, sophistication_score:number 1-10, feedback:string, better_version:string|null}.`, 350);
export const scoreEssay = (text) => jsonCompletion(`Act as an official IELTS Writing Task 2 examiner. Score this essay:\n\n"${text}"\n\nReturn {task_achievement:number 0-9, coherence_cohesion:number 0-9, lexical_resource:number 0-9, grammatical_accuracy:number 0-9, band_estimate:number 0-9, feedback:string, common_errors:string[]}.`, 700);

export async function conversationReply(scenario, history, message) {
  const prompt = `You are a friendly English conversation partner in this scenario: "${scenario}". Stay in character and respond naturally in 1–2 sentences. Silently assess the user's latest English.\n\nHistory:\n${history.map((turn) => `${turn.user_message ? `User: ${turn.user_message}` : ''}${turn.bot_response ? `\nCoach: ${turn.bot_response}` : ''}`).join('\n')}\n\nLatest user message: ${message}\n\nReturn {bot_response:string, grammar_notes:[{error:string, correct:string, type:string}]}.`;
  return jsonCompletion(prompt, 450);
}
