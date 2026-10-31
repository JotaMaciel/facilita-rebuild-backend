import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';

const prisma = new PrismaClient();
const secret = 'chave-somente-para-testes-de-integracao-com-mysql';
let server;
let base;
let token;
let userId;
let serviceId;

before(async () => {
  if (!process.env.DATABASE_URL?.includes('facilita_test')) {
    throw new Error('Integração só pode rodar com DATABASE_URL apontando para facilita_test');
  }
  await prisma.$connect();
  server = createApp({ db: prisma, jwtSecret: secret }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/v1/facilita`;
});
after(async () => {
  if (serviceId) await prisma.servico.deleteMany({ where: { id: serviceId } });
  if (userId) await prisma.usuario.deleteMany({ where: { id: userId } });
  await new Promise(resolve => server?.close(resolve));
  await prisma.$disconnect();
});
test('fluxo HTTP real: registro, login, serviço, isolamento e cancelamento', async () => {
  const email = `integration-${crypto.randomUUID()}@example.test`;
  const headers = { 'Content-Type': 'application/json' };
  const register = await fetch(base + '/auth/registro', { method: 'POST', headers, body: JSON.stringify({ nome: 'Teste Integração', email, senha: 'SenhaSegura123!' }) });
  assert.equal(register.status, 201);
  userId = (await register.json()).data.id;
  const login = await fetch(base + '/auth/login', { method: 'POST', headers, body: JSON.stringify({ email, senha: 'SenhaSegura123!' }) });
  assert.equal(login.status, 200);
  token = (await login.json()).token;
  const unauthorized = await fetch(base + '/servicos');
  assert.equal(unauthorized.status, 401);
  const created = await fetch(base + '/servicos', { method: 'POST', headers: { ...headers, Authorization: `Bearer ${token}` }, body: JSON.stringify({ descricao: 'Comprar remédios na farmácia', categoria: 'Compras' }) });
  assert.equal(created.status, 201);
  serviceId = (await created.json()).data.id;
  const list = await fetch(base + '/servicos', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(list.status, 200);
  assert.equal((await list.json()).data.some(s => s.id === serviceId), true);
  const cancelled = await fetch(base + `/servicos/${serviceId}/cancelar`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
  assert.equal(cancelled.status, 200);
  assert.equal((await cancelled.json()).data.status, 'CANCELADO');
});
