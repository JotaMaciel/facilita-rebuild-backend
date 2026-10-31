import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { hashPassword, verifyPassword, signToken, verifyToken } from './security.js';
import { randomToken, tokenHash, expiresAt } from './tokens.js';

const credentialsSchema = z.object({
  email: z.email().max(191).transform(v => v.toLowerCase()),
  senha: z.string().min(8).max(128),
});
const registerSchema = credentialsSchema.extend({ nome: z.string().trim().min(2).max(120), papel: z.enum(['CLIENTE', 'PRESTADOR']).default('CLIENTE') });
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
  const auth = async (req, res, next) => {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const claims = verifyToken(token, jwtSecret);
    if (!claims) return res.status(401).json({ error: 'UNAUTHORIZED' });
    try {
      const session = await db.sessao.findUnique({ where: { tokenHash: tokenHash(token) } });
      if (!session || session.revogada || session.usuarioId !== claims.sub || session.expiraEm <= new Date()) return res.status(401).json({ error: 'SESSION_EXPIRED' });
      req.auth = claims;
      req.sessionId = session.id;
      next();
    } catch (error) { next(error); }
  };
  app.post('/v1/facilita/auth/registro', authLimiter, async (req, res, next) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed);
    try {
      const { nome, email, senha, papel } = parsed.data;
      const user = await db.usuario.create({ data: { nome, email, papel, senhaHash: await hashPassword(senha) } });
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
      const token = signToken(user, jwtSecret);
      await db.sessao.create({ data: { usuarioId: user.id, tokenHash: tokenHash(token), expiraEm: new Date(Date.now() + 3600_000) } });
      res.json({ token, usuario: publicUser(user) });
    } catch (e) { next(e); }
  });
  app.post('/v1/facilita/auth/recuperar-senha', authLimiter, async (req, res, next) => {
    const parsed = z.object({ email: z.email().max(191) }).safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed);
    try {
      const user = await db.usuario.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
      if (user) {
        const token = randomToken();
        await db.recuperacaoSenha.create({ data: { usuarioId: user.id, tokenHash: tokenHash(token), expiraEm: expiresAt(15) } });
        // Apenas desenvolvimento controlado: não envia o token na resposta.
        // Conectar um provedor de e-mail antes de liberar recuperação em produção.
        if (process.env.NODE_ENV !== 'production' && process.env.DEV_PASSWORD_RESET_LOG === 'true') {
          console.warn('Token de recuperação local (não usar em produção):', token);
        }
      }
      res.json({ message: 'Se o e-mail existir, as instruções de recuperação serão enviadas.' });
    } catch (error) { next(error); }
  });
  app.post('/v1/facilita/auth/redefinir-senha', authLimiter, async (req, res, next) => {
    const parsed = z.object({ token: z.string().min(30).max(256), senha: z.string().min(8).max(128) }).safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed);
    try {
      const record = await db.recuperacaoSenha.findUnique({ where: { tokenHash: tokenHash(parsed.data.token) } });
      if (!record || record.usado || record.expiraEm <= new Date()) return res.status(400).json({ error: 'INVALID_RESET_TOKEN' });
      const novaSenhaHash = await hashPassword(parsed.data.senha);
      const applied = await db.$transaction(async tx => {
        const updated = await tx.recuperacaoSenha.updateMany({
          where: { id: record.id, usado: false, expiraEm: { gt: new Date() } },
          data: { usado: true },
        });
        if (!updated.count) return false;
        await tx.usuario.update({ where: { id: record.usuarioId }, data: { senhaHash: novaSenhaHash } });
        await tx.sessao.updateMany({ where: { usuarioId: record.usuarioId, revogada: false }, data: { revogada: true } });
        return true;
      });
      if (!applied) return res.status(400).json({ error: 'INVALID_RESET_TOKEN' });
      res.json({ success: true });
    } catch (error) { next(error); }
  });
  app.post('/v1/facilita/auth/logout', auth, async (req, res, next) => {
    try {
      await db.sessao.updateMany({ where: { id: req.sessionId, usuarioId: req.auth.sub }, data: { revogada: true } });
      res.json({ success: true });
    } catch (error) { next(error); }
  });
  app.get('/v1/facilita/auth/me', auth, async (req, res, next) => {
    try {
      const user = await db.usuario.findUnique({ where: { id: req.auth.sub } });
      if (!user) return res.status(404).json({ error: 'NOT_FOUND' });
      res.json({ data: publicUser(user) });
    } catch (e) { next(e); }
  });
  app.get('/v1/facilita/servicos', auth, async (req, res, next) => {
    const page = z.coerce.number().int().min(1).max(10000).safeParse(req.query.page || 1);
    if (!page.success) return res.status(400).json({ error: 'INVALID_PAGE' });
    try { res.json({ data: await db.servico.findMany({ where: { usuarioId: req.auth.sub }, orderBy: { criadoEm: 'desc' }, skip: (page.data - 1) * 20, take: 20 }), page: page.data }); }
    catch (e) { next(e); }
  });
  app.post('/v1/facilita/servicos', auth, async (req, res, next) => {
    const parsed = serviceSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed);
    try {
      const requester = await db.usuario.findUnique({ where: { id: req.auth.sub } });
      if (!requester || requester.papel !== 'CLIENTE') return res.status(403).json({ error: 'FORBIDDEN' });
      const service = await db.servico.create({ data: { ...parsed.data, usuarioId: req.auth.sub } });
      res.status(201).json({ data: service });
    } catch (e) { next(e); }
  });
  app.get('/v1/facilita/servicos/atribuidos', auth, async (req, res, next) => {
    try {
      const user = await db.usuario.findUnique({ where: { id: req.auth.sub } });
      if (!user || user.papel !== 'PRESTADOR') return res.status(403).json({ error: 'FORBIDDEN' });
      res.json({ data: await db.servico.findMany({ where: { prestadorId: req.auth.sub }, orderBy: { criadoEm:'desc' }, take:100 }) });
    } catch (error) { next(error); }
  });
  app.get('/v1/facilita/servicos/disponiveis', auth, async (req, res, next) => {
    try {
      const user = await db.usuario.findUnique({ where: { id: req.auth.sub } });
      if (!user || user.papel !== 'PRESTADOR') return res.status(403).json({ error: 'FORBIDDEN' });
      const data = await db.servico.findMany({ where: { status: 'PENDENTE', usuarioId: { not: req.auth.sub } }, orderBy: { criadoEm: 'desc' }, take: 100 });
      res.json({ data });
    } catch (e) { next(e); }
  });
  app.get('/v1/facilita/servicos/:id', auth, async (req, res, next) => {
    try {
      const data = await db.servico.findFirst({ where: { id: req.params.id, OR: [{ usuarioId: req.auth.sub }, { prestadorId: req.auth.sub }] } });
      if (!data) return res.status(404).json({ error: 'NOT_FOUND' });
      res.json({ data });
    } catch (e) { next(e); }
  });
  app.patch('/v1/facilita/servicos/:id/cancelar', auth, async (req, res, next) => {
    try {
      const result = await db.servico.updateMany({ where: { id: req.params.id, usuarioId: req.auth.sub, status: 'PENDENTE' }, data: { status: 'CANCELADO' } });
      if (!result.count) return res.status(409).json({ error: 'CANNOT_CANCEL' });
      res.json({ data: await db.servico.findUnique({ where: { id: req.params.id } }) });
    } catch (e) { next(e); }
  });
  app.patch('/v1/facilita/servicos/:id/aceitar', auth, async (req, res, next) => {
    try {
      const user = await db.usuario.findUnique({ where: { id: req.auth.sub } });
      if (!user || user.papel !== 'PRESTADOR') return res.status(403).json({ error: 'FORBIDDEN' });
      const result = await db.servico.updateMany({
        where: { id: req.params.id, status: 'PENDENTE', usuarioId: { not: req.auth.sub }, prestadorId: null },
        data: { status: 'ACEITO', prestadorId: req.auth.sub },
      });
      if (!result.count) return res.status(409).json({ error: 'CANNOT_ACCEPT' });
      const service = await db.servico.findUnique({ where: { id: req.params.id } });
      try {
        await db.notificacao.create({ data: { usuarioId: service.usuarioId, titulo: 'Serviço aceito', texto: 'Um prestador aceitou sua solicitação.' } });
      } catch (notifyError) {
        console.error('Falha ao gerar notificação de aceite:', notifyError);
      }
      res.json({ data: service });
    } catch (e) { next(e); }
  });
  // Transições atômicas impedem que dois comandos concorrentes avancem o mesmo estado.
  async function transition(req, res, next, { from, to, ownerField }) {
    try {
      const user = await db.usuario.findUnique({ where: { id: req.auth.sub } });
      if (!user || (ownerField === 'prestadorId' && user.papel !== 'PRESTADOR')) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
      const updated = await db.servico.updateMany({
        where: { id: req.params.id, [ownerField]: req.auth.sub, status: from },
        data: { status: to },
      });
      if (!updated.count) return res.status(409).json({ error: 'INVALID_TRANSITION' });
      res.json({ data: await db.servico.findUnique({ where: { id: req.params.id } }) });
    } catch (error) { next(error); }
  }
  app.patch('/v1/facilita/servicos/:id/iniciar', auth, (req, res, next) =>
    transition(req, res, next, { from: 'ACEITO', to: 'EM_ANDAMENTO', ownerField: 'prestadorId' }));
  app.patch('/v1/facilita/servicos/:id/concluir', auth, (req, res, next) =>
    transition(req, res, next, { from: 'EM_ANDAMENTO', to: 'CONCLUIDO', ownerField: 'prestadorId' }));

  const avaliacaoSchema = z.object({
    nota: z.number().int().min(1).max(5),
    comentario: z.string().trim().max(500).optional(),
  });
  app.post('/v1/facilita/servicos/:id/avaliacao', auth, async (req, res, next) => {
    const parsed = avaliacaoSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed);
    try {
      const service = await db.servico.findFirst({
        where: { id: req.params.id, usuarioId: req.auth.sub, status: 'CONCLUIDO', prestadorId: { not: null } },
      });
      if (!service) return res.status(409).json({ error: 'SERVICE_NOT_ELIGIBLE' });
      const review = await db.avaliacao.create({ data: { servicoId: service.id, ...parsed.data } });
      res.status(201).json({ data: review });
    } catch (error) {
      if (error.code === 'P2002') return res.status(409).json({ error: 'ALREADY_REVIEWED' });
      next(error);
    }
  });
  // Mensagens: somente o contratante e o prestador atribuído participam.
  const messageSchema = z.object({ texto: z.string().trim().min(1).max(2000) });
  async function participant(db, id, userId) {
    return db.servico.findFirst({ where: { id, OR: [{ usuarioId: userId }, { prestadorId: userId }] } });
  }
  app.get('/v1/facilita/servicos/:id/mensagens', auth, async (req, res, next) => {
    try {
      const service = await participant(db, req.params.id, req.auth.sub);
      if (!service || !service.prestadorId) return res.status(404).json({ error: 'NOT_FOUND' });
      const data = await db.mensagem.findMany({ where: { servicoId: service.id }, orderBy: { criadoEm: 'asc' }, take: 100 });
      res.json({ data });
    } catch (error) { next(error); }
  });
  app.post('/v1/facilita/servicos/:id/mensagens', auth, async (req, res, next) => {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed);
    try {
      const service = await participant(db, req.params.id, req.auth.sub);
      if (!service || !service.prestadorId || ['PENDENTE','CANCELADO'].includes(service.status)) return res.status(403).json({ error: 'FORBIDDEN' });
      const data = await db.mensagem.create({ data: { servicoId: service.id, autorId: req.auth.sub, texto: parsed.data.texto } });
      res.status(201).json({ data });
    } catch (error) { next(error); }
  });
  app.get('/v1/facilita/notificacoes', auth, async (req, res, next) => {
    try {
      const data = await db.notificacao.findMany({ where: { usuarioId: req.auth.sub }, orderBy: { criadoEm: 'desc' }, take: 50 });
      res.json({ data });
    } catch (error) { next(error); }
  });
  app.patch('/v1/facilita/notificacoes/:id/lida', auth, async (req, res, next) => {
    try {
      const result = await db.notificacao.updateMany({ where: { id: req.params.id, usuarioId: req.auth.sub }, data: { lida: true } });
      if (!result.count) return res.status(404).json({ error: 'NOT_FOUND' });
      res.json({ success: true });
    } catch (error) { next(error); }
  });
  app.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  app.use((err, _req, res, _next) => {
    console.error('API error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  });
  return app;
}
