import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
const secret = 'chave-apenas-para-testes-unitarios-com-32-caracteres';
const data = [];
const usuario = { id: 'u1', nome: 'João', email: 'joao@example.com', papel: 'CLIENTE', senhaHash: '' };
const db = {
  $queryRaw: async () => [{ one: 1 }],
  usuario: {
    create: async ({ data: d }) => { Object.assign(usuario, { ...d, id: 'u1', papel: 'CLIENTE' }); return usuario; },
    findUnique: async ({ where }) => where.email === usuario.email || where.id === usuario.id ? usuario : null,
  },
  sessao: {
    create: async ({ data }) => ({ id: 'session1', ...data, revogada: false }),
    findUnique: async () => ({ id: 'session1', usuarioId: 'u1', revogada: false, expiraEm: new Date(Date.now()+3600000) }),
    updateMany: async () => ({ count: 1 }),
  },
  servico: {
    findMany: async ({ where }) => where.usuarioId ? data.filter(s => s.usuarioId === where.usuarioId) : data.filter(s=>s.status === where.status && s.usuarioId !== where.usuarioId?.not),
    findUnique: async ({ where }) => data.find(s => s.id === where.id) || null,
    findFirst: async ({ where }) => data.find(s => s.id === where.id && s.usuarioId === where.usuarioId) || null,
    updateMany: async ({ where, data: change }) => { const s = data.find(s => s.id === where.id && s.usuarioId === where.usuarioId && s.status === where.status); if (!s) return { count: 0 }; Object.assign(s, change); return { count: 1 }; },
    create: async ({ data: item }) => { const out = { ...item, id: 's1', status: 'PENDENTE' }; data.push(out); return out; },
  },
};
let server; let url;
before(async () => {
  server = createApp({ db, jwtSecret: secret }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  url = `http://127.0.0.1:${server.address().port}/v1/facilita`;
});
after(() => server?.close());
const post = (path, body, token) => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
test('healthcheck', async () => assert.equal((await fetch(url + '/health')).status, 200));
test('identificador de requisição em respostas bem-sucedidas e erros', async () => {
  const good = await fetch(url + '/live');
  const unauthorized = await fetch(url + '/servicos');
  const missing = await fetch(url + '/rota-inexistente');
  assert.equal(good.status, 200);
  assert.equal(unauthorized.status, 401);
  assert.equal(missing.status, 404);
  const ids = [good, unauthorized, missing].map(response => response.headers.get('x-request-id'));
  ids.forEach(id => assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));
  assert.equal(new Set(ids).size, 3);
});
test('serviços exigem autenticação', async () => assert.equal((await fetch(url + '/servicos')).status, 401));
test('registro, login, criação de serviço', async () => {
  let r = await post('/auth/registro', { nome: 'João', email: 'joao@example.com', senha: 'senhaForte123' });
  assert.equal(r.status, 201);
  r = await post('/auth/login', { email: 'joao@example.com', senha: 'senhaForte123' });
  assert.equal(r.status, 200);
  const { token } = await r.json();
  r = await post('/servicos', { categoria: 'Compras', descricao: 'Comprar alimentos' }, token);
  assert.equal(r.status, 201);
  r = await fetch(url + '/servicos', { headers: { Authorization: 'Bearer ' + token } });
  assert.equal((await r.json()).data.length, 1);
  const cancel = await fetch(url + '/servicos/s1/cancelar', { method: 'PATCH', headers: { Authorization: 'Bearer ' + token } });
  assert.equal(cancel.status, 200);
  assert.equal((await cancel.json()).data.status, 'CANCELADO');
  const repeat = await fetch(url + '/servicos/s1/cancelar', { method: 'PATCH', headers: { Authorization: 'Bearer ' + token } });
  assert.equal(repeat.status, 409);
});

test('liveness funciona mesmo que banco esteja indisponível', async () => {
  const response = await fetch(url + '/live');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'alive' });
});
