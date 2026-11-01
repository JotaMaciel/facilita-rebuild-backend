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
