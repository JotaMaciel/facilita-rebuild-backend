import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

let server;
let base;
before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server?.close());

test('health responde 200', async () => {
  const res = await fetch(`${base}/v1/facilita/health`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'ok');
});
test('serviço inválido responde 400', async () => {
  const res = await fetch(`${base}/v1/facilita/servicos`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ descricao:'oi', categoria:'x' }) });
  assert.equal(res.status,400);
});
test('cria e lista serviço em memória', async () => {
  const res = await fetch(`${base}/v1/facilita/servicos`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ descricao:'Comprar medicamentos',categoria:'Compras'}) });
  assert.equal(res.status,201);
  const obj = await res.json();
  assert.equal(obj.data.status,'PENDENTE');
  const list = await (await fetch(`${base}/v1/facilita/servicos`)).json();
  assert.equal(list.data.some(s=>s.id===obj.data.id),true);
});
