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
