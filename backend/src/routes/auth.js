import { Router } from 'express';
import { z } from 'zod';
import { admin, dbError, publicAuth } from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { isSupabaseConfigured } from '../config.js';
import { local } from '../services/local.js';

const router = Router();
const ESTIMATED_LEVEL_MAP = { beginner: 'A1', daily: 'B1', confident: 'B2', fluent: 'C1' };
const signupSchema = z.object({ email: z.string().email(), password: z.string().min(8).max(72), name: z.string().trim().min(1).max(100), estimatedLevel: z.enum(['beginner', 'daily', 'confident', 'fluent']).optional(), languageLevel: z.enum(['A1','A2','B1','B2','C1','C2']).optional() }).transform(data => ({ ...data, languageLevel: data.languageLevel || ESTIMATED_LEVEL_MAP[data.estimatedLevel] || 'B2' }));
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const valid = (schema, body) => { const r = schema.safeParse(body); if (!r.success) throw Object.assign(new Error(r.error.issues[0].message), { status: 400 }); return r.data; };

router.post('/signup', async (req, res, next) => { try {
  const input = valid(signupSchema, req.body);
  if (!isSupabaseConfigured()) { const existing = local.findUser(input.email); if (existing) throw Object.assign(new Error('An account with that email already exists in this local session.'), { status: 400 }); const user = local.createUser(input); return res.status(201).json({ success: true, user, token: local.session(user), local_mode: true }); }
  const { data, error } = await admin().auth.admin.createUser({ email: input.email, password: input.password, email_confirm: true, user_metadata: { name: input.name, language_level: input.languageLevel } });
  if (error) throw Object.assign(new Error(error.message), { status: 400 });
  await dbError(await admin().from('users').upsert({ id: data.user.id, email: input.email, name: input.name, language_level: input.languageLevel }));
  const login = await publicAuth().auth.signInWithPassword({ email: input.email, password: input.password });
  if (login.error) throw Object.assign(new Error(login.error.message), { status: 400 });
  res.status(201).json({ success: true, user: { id: data.user.id, email: input.email, name: input.name, level: input.languageLevel }, token: login.data.session.access_token });
} catch (error) { next(error); } });

router.post('/login', async (req, res, next) => { try {
  const input = valid(loginSchema, req.body); if (!isSupabaseConfigured()) { const user = local.findUser(input.email); if (!user || user.password !== input.password) throw Object.assign(new Error('Create a local account first, or configure Supabase in backend/.env.'), { status: 401 }); return res.json({ success: true, user, token: local.session(user), local_mode: true }); } const { data, error } = await publicAuth().auth.signInWithPassword(input);
  if (error || !data.user || !data.session) throw Object.assign(new Error(error?.message || 'Unable to sign in.'), { status: 401 });
  const profile = await dbError(await admin().from('users').select('id,email,name,language_level').eq('id', data.user.id).maybeSingle());
  res.json({ success: true, user: { id: data.user.id, email: data.user.email, name: profile?.name || data.user.user_metadata?.name || 'Learner', level: profile?.language_level || 'B2' }, token: data.session.access_token });
} catch (error) { next(error); } });
router.get('/me', requireAuth, async (req, res, next) => { try { if (!isSupabaseConfigured()) return res.json({ user: req.user, local_mode: true }); const profile = await dbError(await admin().from('users').select('id,email,name,language_level').eq('id', req.user.id).maybeSingle()); res.json({ user: { id: req.user.id, email: req.user.email, name: profile?.name || 'Learner', level: profile?.language_level || 'B2' } }); } catch (error) { next(error); } });
export default router;
