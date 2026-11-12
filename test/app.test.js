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
    findMany: async ({ where, skip = 0, take }) => { const rows = where.usuarioId ? data.filter(s => s.usuarioId === where.usuarioId) : data.filter(s=>s.status === where.status && s.usuarioId !== where.usuarioId?.not); return rows.slice(skip, take === undefined ? undefined : skip + take); },
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

test('tokens ausentes, malformados e adulterados não autorizam acesso', async () => {
  const paths = ['/auth/me', '/auth/sessoes', '/servicos', '/notificacoes'];
  const invalidTokens = [undefined, 'Bearer', 'Bearer token-invalido', 'Bearer a.b.c', 'Basic abc'];
  for (const path of paths) {
    for (const authorization of invalidTokens) {
      const response = await fetch(url + path, {
        headers: authorization ? { Authorization: authorization } : {},
      });
      assert.equal(response.status, 401, path + ' aceitou ' + (authorization || 'ausência de token'));
      assert.equal((await response.json()).error, 'UNAUTHORIZED');
      assert.ok(response.headers.get('x-request-id'));
    }
  }
});

test('cadastro rejeita dados inválidos antes de gravar', async () => {
  for (const body of [
    { nome: 'A', email: 'email-invalido', senha: '123', papel: 'CLIENTE' },
    { nome: 'Pessoa Teste', email: 'pessoa@example.com', senha: 'senhaForte123', papel: 'ADMIN' },
  ]) {
    const response = await post('/auth/registro', body);
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.error, 'VALIDATION_ERROR');
    assert.ok(payload.details.length > 0);
  }
});

test('serviço rejeita descrição e categoria inválidas', async () => {
  const totalAntes = data.length;
  const loggedIn = await post('/auth/login', {email:'joao@example.com',senha:'senhaForte123'});
  assert.equal(loggedIn.status,200);
  const { token } = await loggedIn.json();
  for (const body of [
    {categoria:'A',descricao:'curta'},
    {categoria:'Compras',descricao:'x'.repeat(501)},
    {categoria:'x'.repeat(81),descricao:'Solicitação válida'},
  ]) {
    const response = await post('/servicos',body,token);
    assert.equal(response.status,400);
    assert.equal((await response.json()).error,'VALIDATION_ERROR');
  }
  assert.equal(data.length,totalAntes,'entradas inválidas não podem criar serviços');
});

test('limitador de autenticação retorna 429 após excesso de tentativas', async () => {
  const app = createApp({
    db, jwtSecret: secret, authRateLimit: 2,
  });
  const isolated = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => isolated.once('listening', resolve));
    const endpoint = `http://127.0.0.1:${isolated.address().port}/v1/facilita/auth/login`;
    const body = JSON.stringify({email:'inexistente@example.test',senha:'SenhaInvalida123!'});
    const send = () => fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body});
    assert.equal((await send()).status,401);
    assert.equal((await send()).status,401);
    const blocked = await send();
    assert.equal(blocked.status,429);
    assert.ok(blocked.headers.get('retry-after'));
    assert.ok(blocked.headers.get('x-request-id'));
  } finally {
    await new Promise((resolve,reject)=>isolated.close(err=>err?reject(err):resolve()));
  }
});

test('JWT adulterado é rejeitado mesmo com estrutura válida', async () => {
  const login = await post('/auth/login', { email:'joao@example.com', senha:'senhaForte123' });
  assert.equal(login.status,200);
  const { token } = await login.json();
  const [header, payload, signature] = token.split('.');
  const claims = JSON.parse(Buffer.from(payload,'base64url').toString());
  const alteredPayload = Buffer.from(JSON.stringify({...claims,role:'ADMIN'})).toString('base64url');
  for (const forged of [
    [header,alteredPayload,signature].join('.'),
    [header,payload,(signature[0]==='A'?'B':'A')+signature.slice(1)].join('.'),
  ]) {
    const response = await fetch(url+'/auth/me',{headers:{Authorization:'Bearer '+forged}});
    assert.equal(response.status,401);
    assert.equal((await response.json()).error,'UNAUTHORIZED');
  }
});

test('listagem de serviços informa corretamente próxima página', async () => {
  const login = await post('/auth/login', {email:'joao@example.com',senha:'senhaForte123'});
  assert.equal(login.status,200);
  const {token} = await login.json();
  const originals = data.slice();
  try {
    data.length = 0;
    for (let i=0;i<21;i++) data.push({id:'page-'+i,usuarioId:'u1',status:'PENDENTE'});
    const get = page => fetch(url+'/servicos?page='+page,{headers:{Authorization:'Bearer '+token}});
    const first = await get(1);
    assert.equal(first.status,200);
    const one = await first.json();
    assert.equal(one.data.length,20);
    assert.equal(one.pageSize,20);
    assert.equal(one.hasNextPage,true);
    const second = await get(2);
    const two = await second.json();
    assert.equal(two.data.length,1);
    assert.equal(two.hasNextPage,false);
  } finally {
    data.splice(0,data.length,...originals);
  }
});

test('proxy confiável separa clientes e ignora IP falso anterior ao salto configurado', async () => {
  const app = createApp({ db, jwtSecret: secret, authRateLimit: 2, trustProxyHops: 1 });
  const proxyServer = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => proxyServer.once('listening', resolve));
    const send = forwarded => fetch(`http://127.0.0.1:${proxyServer.address().port}/v1/facilita/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': forwarded },
      body: JSON.stringify({ email: 'missing@example.test', senha: 'SenhaInvalida123!' }),
    });
    assert.equal((await send('192.0.2.1')).status, 401);
    assert.equal((await send('192.0.2.1')).status, 401);
    assert.equal((await send('192.0.2.99, 192.0.2.1')).status, 429, 'IP falso à esquerda não deve contornar limite');
    assert.equal((await send('192.0.2.2')).status, 401, 'outro cliente não deve compartilhar limite');
  } finally { await new Promise(resolve => proxyServer.close(resolve)); }
});
