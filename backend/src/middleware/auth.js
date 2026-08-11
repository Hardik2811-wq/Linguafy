import { admin } from '../services/supabase.js';
import { isSupabaseConfigured } from '../config.js';
import { local } from '../services/local.js';

export async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ success: false, error: 'Authentication is required.' });
    if (!isSupabaseConfigured()) { if (!token.startsWith('local-')) return res.status(401).json({ success: false, error: 'Your local session is invalid. Please sign in again.' }); req.user = local.user(token.slice(6)); return next(); }
    const { data, error } = await admin().auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ success: false, error: 'Your session has expired. Please sign in again.' });
    req.user = data.user;
    next();
  } catch (error) { next(error); }
}
