import { Router } from 'express';
import { z } from 'zod';
import { conversationReply } from '../services/groq.js';
import { admin, dbError } from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { isSupabaseConfigured } from '../config.js';
import { local } from '../services/local.js';
const router = Router();
router.post('/send', requireAuth, async (req, res, next) => { try {
  const parsed = z.object({ session_id: z.string().uuid().nullable().optional(), scenario: z.string().min(2).max(100), user_message: z.string().trim().min(1).max(1000) }).safeParse(req.body);
  if (!parsed.success) throw Object.assign(new Error('A scenario and message are required.'), { status: 400 });
  if (!isSupabaseConfigured()) { const session_id = parsed.data.session_id || crypto.randomUUID(); const allTurns = local.conversations.get(session_id) || []; const reply = await conversationReply(parsed.data.scenario, allTurns.slice(-6), parsed.data.user_message); const turn_number = allTurns.length + 1; allTurns.push({ user_message: parsed.data.user_message, bot_response: reply.bot_response, turn_number }); local.conversations.set(session_id, allTurns); return res.json({ success: true, session_id, bot_response: reply.bot_response, turn_number, grammar_notes: reply.grammar_notes || [], local_mode: true }); }
  let sessionId = parsed.data.session_id;
  if (!sessionId) { const session = await dbError(await admin().from('conversation_sessions').insert({ user_id: req.user.id, scenario: parsed.data.scenario }).select('id').single()); sessionId = session.id; }
  const turns = await dbError(await admin().from('conversation_turns').select('user_message,bot_response,turn_number').eq('session_id', sessionId).order('turn_number'));
  const reply = await conversationReply(parsed.data.scenario, turns.slice(-6), parsed.data.user_message); const turn = turns.length + 1;
  await dbError(await admin().from('conversation_turns').insert({ session_id: sessionId, user_message: parsed.data.user_message, bot_response: reply.bot_response, grammar_notes: reply.grammar_notes || [], turn_number: turn }));
  res.json({ success: true, session_id: sessionId, bot_response: reply.bot_response, turn_number: turn, grammar_notes: reply.grammar_notes || [] });
} catch (error) { next(error); } });
export default router;
