import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { z } from 'zod';

const servicoSchema = z.object({
  descricao: z.string().trim().min(5).max(500),
  categoria: z.string().trim().min(2).max(80),
});

export function createApp() {
  const app = express();
  const services = new Map();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/v1/facilita/health', (_req, res) => {
    res.json({ status: 'ok', service: 'facilita-rebuild-backend', timestamp: new Date().toISOString() });
  });

  app.get('/v1/facilita/servicos', (_req, res) => {
    res.json({ data: [...services.values()] });
  });

  app.post('/v1/facilita/servicos', (req, res) => {
    const result = servicoSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: result.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })),
      });
    }
    const record = { id: crypto.randomUUID(), ...result.data, status: 'PENDENTE', criadoEm: new Date().toISOString() };
    services.set(record.id, record);
    return res.status(201).json({ data: record });
  });

  app.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND', message: 'Rota não encontrada' }));
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: 'INTERNAL_ERROR', message: 'Erro ao processar solicitação' });
  });
  return app;
}
