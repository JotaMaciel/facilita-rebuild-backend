import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

test('erro interno retorna requestId sem detalhes do banco', async () => {
  const app = createApp({
    jwtSecret: 'chave-apenas-para-testes-unitarios-com-32-caracteres',
    db: { $queryRaw: async () => { throw new Error('segredo interno do banco'); } },
  });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/facilita/health`);
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.equal(body.error, 'INTERNAL_ERROR');
    assert.equal(body.requestId, response.headers.get('x-request-id'));
    assert.match(body.requestId, /^[0-9a-f-]{36}$/i);
    assert.equal(JSON.stringify(body).includes('segredo interno do banco'), false);
  } finally {
    await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});


test('JSON inválido e payload excessivo recebem erros específicos sem revelar entrada', async () => {
  const app = createApp({
    jwtSecret: 'chave-apenas-para-testes-unitarios-com-32-caracteres',
    db: { $queryRaw: async () => [{ one: 1 }] },
  });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/v1/facilita/auth/login`;
    for (const scenario of [
      { body: '{"senha":"secreto",', status: 400, error: 'INVALID_JSON' },
      { body: JSON.stringify({ value: 'x'.repeat(110000) }), status: 413, error: 'PAYLOAD_TOO_LARGE' },
    ]) {
      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: scenario.body,
      });
      assert.equal(response.status, scenario.status);
      const payload = await response.json();
      assert.equal(payload.error, scenario.error);
      assert.equal(payload.requestId, response.headers.get('x-request-id'));
      assert.equal(JSON.stringify(payload).includes('secreto'), false);
    }
  } finally {
    await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});


test('health falha de maneira segura e live permanece disponível durante indisponibilidade do banco', async () => {
  let calls = 0;
  const app = createApp({
    jwtSecret: 'chave-apenas-para-testes-unitarios-com-32-caracteres',
    db: { $queryRaw: async () => { calls++; throw new Error('DATABASE_URL=segredo-nao-divulgar'); } },
  });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/v1/facilita`;
    const live = await fetch(base+'/live');
    assert.equal(live.status,200);
    assert.deepEqual(await live.json(),{status:'alive'});
    assert.equal(calls,0,'liveness não deve consultar banco');
    const health = await fetch(base+'/health');
    assert.equal(health.status,500);
    const body = await health.json();
    assert.equal(body.error,'INTERNAL_ERROR');
    assert.equal(body.requestId,health.headers.get('x-request-id'));
    assert.equal(JSON.stringify(body).includes('segredo-nao-divulgar'),false);
    assert.equal(calls,1);
    const liveAfter = await fetch(base+'/live');
    assert.equal(liveAfter.status,200);
  } finally {
    await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
  }
});


test('readiness se recupera quando o banco volta sem reiniciar a API', async () => {
  let available = false;
  const app = createApp({
    jwtSecret: 'chave-apenas-para-testes-unitarios-com-32-caracteres',
    db: { $queryRaw: async () => {
      if (!available) throw new Error('database offline');
      return [{ one: 1 }];
    } },
  });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening',resolve));
    const url = `http://127.0.0.1:${server.address().port}/v1/facilita/health`;
    const failed = await fetch(url);
    assert.equal(failed.status,500);
    available = true;
    const recovered = await fetch(url);
    assert.equal(recovered.status,200);
    assert.deepEqual(await recovered.json(),{status:'ok',database:'connected'});
    assert.notEqual(failed.headers.get('x-request-id'),recovered.headers.get('x-request-id'));
  } finally {
    await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
  }
});


test('falhas repetidas de readiness não impedem recuperação posterior', async () => {
  let online = false;
  let queries = 0;
  const app = createApp({
    jwtSecret: 'chave-apenas-para-testes-unitarios-com-32-caracteres',
    db: { $queryRaw: async () => {
      queries++;
      if (!online) throw new Error('erro interno de conexão');
      return [{ one: 1 }];
    } },
  });
  const server = app.listen(0,'127.0.0.1');
  try {
    await new Promise(resolve=>server.once('listening',resolve));
    const base = `http://127.0.0.1:${server.address().port}/v1/facilita`;
    const ids = new Set();
    for (let i=0;i<3;i++) {
      const failed = await fetch(base+'/health');
      assert.equal(failed.status,500);
      const data = await failed.json();
      assert.equal(data.error,'INTERNAL_ERROR');
      assert.equal(data.requestId,failed.headers.get('x-request-id'));
      ids.add(data.requestId);
      const alive = await fetch(base+'/live');
      assert.equal(alive.status,200);
    }
    assert.equal(ids.size,3);
    assert.equal(queries,3,'liveness não consulta MySQL');
    online = true;
    const restored = await fetch(base+'/health');
    assert.equal(restored.status,200);
    assert.equal(queries,4);
  } finally {
    await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
  }
});


test('logs de erro não expõem mensagens internas nem credenciais', async () => {
  const originalError = console.error;
  const entries = [];
  console.error = (...args) => { entries.push(args); };
  const app = createApp({
    jwtSecret: 'chave-apenas-para-testes-unitarios-com-32-caracteres',
    db: { $queryRaw: async () => { throw new Error('DATABASE_PASSWORD=senha-super-secreta'); } },
  });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/facilita/health`);
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.equal(entries.length, 1);
    const serialized = JSON.stringify(entries);
    assert.equal(serialized.includes('senha-super-secreta'), false);
    assert.equal(serialized.includes('DATABASE_PASSWORD'), false);
    assert.equal(entries[0][1].requestId, body.requestId);
    assert.equal(entries[0][1].error, 'INTERNAL_ERROR');
    assert.equal(entries[0][1].method, 'GET');
  } finally {
    console.error = originalError;
    await new Promise((resolve,reject) => server.close(err=>err?reject(err):resolve()));
  }
});
