import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/security.js';
import { randomToken, tokenHash } from '../src/tokens.js';

const prisma = new PrismaClient();
const users = [];
let server, base, client, provider, token, service;
const headers = { 'Content-Type': 'application/json' };
const post = (path, body) => fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
before(async () => {
  const url = new URL(process.env.DATABASE_URL || 'http://invalid');
  if (url.protocol !== 'mysql:' || url.pathname !== '/facilita_test' || !['127.0.0.1', 'localhost', 'mysql'].includes(url.hostname)) {
    throw new Error('Estabilização exige MySQL local e base descartável facilita_test');
  }
  const senhaHash = await hashPassword('SenhaSintetica123!');
  for (const papel of ['CLIENTE', 'PRESTADOR']) users.push(await prisma.usuario.create({ data: {
    nome: 'Pessoa sintética', email: `stabilization-${randomUUID()}@example.test`, senhaHash, papel,
  } }));
  [client, provider] = users;
  server = createApp({ db: prisma, jwtSecret: 'chave-exclusiva-da-estabilizacao-com-mais-de-48-caracteres', authRateLimit: 100 }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/v1/facilita`;
  token = (await (await post('/auth/login', { email: client.email, senha: 'SenhaSintetica123!' })).json()).token;
  service = await prisma.servico.create({ data: { descricao: 'Serviço sintético de regressão', categoria: 'Teste', usuarioId: client.id, prestadorId: provider.id, status: 'CONCLUIDO' } });
});
after(async () => {
  if (service) {
    await prisma.mensagem.deleteMany({ where: { servicoId: service.id } });
    await prisma.avaliacao.deleteMany({ where: { servicoId: service.id } });
    await prisma.servico.delete({ where: { id: service.id } });
  }
  for (const user of users) {
    await prisma.recuperacaoSenha.deleteMany({ where: { usuarioId: user.id } });
    await prisma.sessao.deleteMany({ where: { usuarioId: user.id } });
    await prisma.usuario.delete({ where: { id: user.id } });
  }
  if (server) await new Promise(resolve => server.close(resolve));
  await prisma.$disconnect();
});

test('histórico pagina 205 mensagens empatadas, inclui recentes e não aceita cursor de outro serviço', async () => {
  const created = Array.from({ length: 205 }, (_, index) => ({ id: randomUUID(), servicoId: service.id, autorId: client.id, texto: `Mensagem ${index}`, criadoEm: new Date('2026-01-01T00:00:00Z') }));
  await prisma.mensagem.createMany({ data: created });
  const expected = created.map(row => row.id).sort();
  const read = before => fetch(base + `/servicos/${service.id}/mensagens${before ? '?before=' + before : ''}`, { headers: { Authorization: `Bearer ${token}` } });
  let page = await (await read()).json();
  assert.deepEqual(page.data.map(row => row.id), expected.slice(-100));
  const seen = [...page.data];
  assert.equal(page.hasMoreMessages, true);
  const newest = await prisma.mensagem.create({ data: { servicoId: service.id, autorId: client.id, texto: 'Mensagem nova durante paginação' } });
  while (page.nextCursor) {
    page = await (await read(page.nextCursor)).json();
    seen.unshift(...page.data);
  }
  assert.equal(page.hasMoreMessages, false);
  assert.deepEqual(seen.map(row => row.id), expected);
  const latest = await (await read()).json();
  assert.equal(latest.data.at(-1).id, newest.id);
  assert.equal((await read('invalid')).status, 400);
  assert.equal((await read(randomUUID())).status, 400);
  const foreignService = await prisma.servico.create({ data: { descricao: 'Outro serviço sintético', categoria: 'Teste', usuarioId: client.id, prestadorId: provider.id, status: 'ACEITO' } });
  try {
    const foreign = await prisma.mensagem.create({ data: { servicoId: foreignService.id, autorId: client.id, texto: 'Outra conversa' } });
    assert.equal((await read(foreign.id)).status, 400);
  } finally {
    await prisma.mensagem.deleteMany({ where: { servicoId: foreignService.id } });
    await prisma.servico.delete({ where: { id: foreignService.id } });
  }
});

test('listagem inclui avaliação persistida e rejeita duplicata', async () => {
  const result = await fetch(base + `/servicos/${service.id}/avaliacao`, { method: 'POST', headers: { ...headers, Authorization: `Bearer ${token}` }, body: JSON.stringify({ nota: 4, comentario: 'Teste' }) });
  assert.equal(result.status, 201);
  const data = (await (await fetch(base + '/servicos', { headers: { Authorization: `Bearer ${token}` } })).json()).data;
  assert.equal(data.find(row => row.id === service.id).avaliacao.nota, 4);
});

test('redefinição invalida outros links e duas redefinições concorrentes não vencem juntas', async () => {
  const older = randomToken(), newer = randomToken();
  const createTokens = tokens => prisma.recuperacaoSenha.createMany({ data: tokens.map(value => ({ usuarioId: client.id, tokenHash: tokenHash(value), expiraEm: new Date(Date.now() + 900000) })) });
  await createTokens([older, newer]);
  assert.equal((await post('/auth/redefinir-senha', { token: newer, senha: 'SenhaNovaSintetica123!' })).status, 200);
  assert.equal((await post('/auth/redefinir-senha', { token: older, senha: 'SenhaInvalida123!' })).status, 400);
  assert.equal(await prisma.recuperacaoSenha.count({ where: { usuarioId: client.id, usado: false } }), 0);
  assert.equal((await fetch(base + '/auth/me', { headers: { Authorization: `Bearer ${token}` } })).status, 401);
  assert.equal((await post('/auth/login', { email: client.email, senha: 'SenhaNovaSintetica123!' })).status, 200);
  const a = randomToken(), b = randomToken();
  await createTokens([a, b]);
  const results = await Promise.all([a, b].map(value => post('/auth/redefinir-senha', { token: value, senha: 'SenhaConcorrente123!' })));
  assert.deepEqual(results.map(result => result.status).sort(), [200, 400]);
  assert.equal(await prisma.recuperacaoSenha.count({ where: { usuarioId: client.id, usado: false } }), 0);
});
