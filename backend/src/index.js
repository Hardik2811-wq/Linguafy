import express from 'express';
import cors from 'cors';
import { config, normalizeOrigin } from './config.js';
import auth from './routes/auth.js';
import writing from './routes/writing.js';
import grammar from './routes/grammar.js';
import vocabulary from './routes/vocabulary.js';
import exam from './routes/exam.js';
import conversation from './routes/conversation.js';
import dashboard from './routes/dashboard.js';
import { errorHandler, notFound } from './middleware/errors.js';

const app = express();
app.disable('x-powered-by');

const devOrigins = new Set(['http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173', 'http://127.0.0.1:4173']);

const allowAll = String(process.env.ALLOW_ALL_ORIGINS || '').toLowerCase() === 'true';
if (allowAll) {
  console.warn('[cors] ALLOW_ALL_ORIGINS=true — allowing all origins temporarily (for testing). Do NOT use in production)');
  app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400
  }));
} else {
  app.use(cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const allowed = config.allowedOrigins.includes(normalizeOrigin(origin)) || devOrigins.has(normalizeOrigin(origin));
      if (!allowed) console.warn(`[cors] blocked origin: ${origin} (allowed: ${config.frontendOrigin})`);
      return callback(null, allowed);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400
  }));
  console.log(`[cors] allowing origins: ${config.frontendOrigin}`);
}
app.use(express.json({ limit: '1mb' }));
app.get('/', (_req, res) => res.json({
  ok: true,
  service: 'Linguafy API',
  app: config.frontendOrigin,
  health: '/health',
  endpoints: ['/api/auth/signup', '/api/auth/login', '/api/feedback/analyze-text', '/api/drills/grammar', '/api/vocabulary/daily', '/api/exam/submit', '/api/conversation/send', '/api/user/progress']
}));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'linguafy-api' }));
app.use('/api/auth', auth);
app.use('/api/feedback', writing);
app.use('/api/feedback', grammar);
app.use('/api/feedback', vocabulary);
app.use('/api/drills', grammar);
app.use('/api/vocabulary', vocabulary);
app.use('/api/exam', exam);
app.use('/api/conversation', conversation);
app.use('/api/user', dashboard);
app.use(notFound); app.use(errorHandler);
app.listen(config.port, () => console.log(`Linguafy API listening on http://localhost:${config.port}`));
