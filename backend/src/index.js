import express from 'express';
import cors from 'cors';
import { config } from './config.js';
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
app.use(cors({ origin: config.frontendOrigin.split(',').map((origin) => origin.trim()), methods: ['GET','POST'], allowedHeaders: ['Content-Type','Authorization'] }));
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
