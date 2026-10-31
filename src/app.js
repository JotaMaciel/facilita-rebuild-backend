import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { hashPassword, verifyPassword, signToken, verifyToken } from './security.js';

const credentialsSchema = z.object({
  email: z.email().max(191).transform(v => v.toLowerCase()),
  senha: z.string().min(8).max(128),
});
const registerSchema = credentialsSchema.extend({ nome: z.string().trim().min(2).max(120) });
const serviceSchema = z.object({
  descricao: z.string().trim().min(5).max(500),
  categoria: z.string().trim().min(2).max(80),
});
const publicUser = ({ id, nome, email, papel }) => ({ id, nome, email, papel });
function invalid(res, parsed) {
  return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) });
}
export function createApp({ db, jwtSecret = process.env.JWT_SECRET } = {}) {
  if (!db) throw new Error('Banco de dados obrigatório');
  if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET deve ter ao menos 32 caracteres');
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(x=>x.trim()) }));
  app.use(express.json({ limit: '100kb' }));
  app.get('/v1/facilita/health', async (_req, res, next) => {
    try { await db.$queryRaw`SELECT 1`; res.json({ status: 'ok', database: 'connected' }); }
    catch (e) { next(e); }
  });
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
  const auth = (req, res, next) => {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const claims = verifyToken(token, jwtSecret);
    if (!claims) return res.status(401).json({ error: 'UNAUTHORIZED' });
    req.auth = claims;
    next();
  };
  app.post('/v1/facilita/auth/registro', authLimiter, async (req, res, next) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed);
    try {
      const { nome, email, senha } = parsed.data;
      const user = await db.usuario.create({ data: { nome, email, senhaHash: await hashPassword(senha) } });
      res.status(201).json({ data: publicUser(user) });
    } catch (e) {
      if (e.code === 'P2002') return res.status(409).json({ error: 'EMAIL_IN_USE' });
      next(e);
    }
  });
  app.post('/v1/facilita/auth/login', authLimiter, async (req, res, next) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed);
    try {
      const user = await db.usuario.findUnique({ where: { email: parsed.data.email } });
      if (!user || !(await verifyPassword(parsed.data.senha, user.senhaHash))) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
      res.json({ token: signToken(user, jwtSecret), usuario: publicUser(user) });
    } catch (e) { next(e); }
  });
  app.get('/v1/facilita/auth/me', auth, async (req, res, next) => {
    try {
      const user = await db.usuario.findUnique({ where: { id: req.auth.sub } });
      if (!user) return res.status(404).json({ error: 'NOT_FOUND' });
      res.json({ data: publicUser(user) });
    } catch (e) { next(e); }
  });
  app.get('/v1/facilita/servicos', auth, async (_req, res, next) => {
    try { res.json({ data: await db.servico.findMany({ where: { usuarioId: _req.auth.sub }, orderBy: { criadoEm: 'desc' }, take: 100 }) }); }
    catch (e) { next(e); }
  });
  app.post('/v1/facilita/servicos', auth, async (req, res, next) => {
    const parsed = serviceSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed);
    try {
      const service = await db.servico.create({ data: { ...parsed.data, usuarioId: req.auth.sub } });
      res.status(201).json({ data: service });
    } catch (e) { next(e); }
  });
  app.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  app.use((err, _req, res, _next) => {
    console.error('API error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  });
  return app;
}
