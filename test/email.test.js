import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { sendRecoveryEmail } from '../src/email.js';

const old = { key: process.env.RESEND_API_KEY, from: process.env.RESET_EMAIL_FROM, origin: process.env.FRONTEND_URL, node: process.env.NODE_ENV };
const originalFetch = globalThis.fetch;
afterEach(() => {
  for (const [name, value] of Object.entries({ RESEND_API_KEY:old.key, RESET_EMAIL_FROM:old.from, FRONTEND_URL:old.origin, NODE_ENV:old.node })) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  globalThis.fetch = originalFetch;
});
test('sem configuração não envia e-mail nem vaza token', async () => {
  delete process.env.RESEND_API_KEY;
  let called = false;
  globalThis.fetch = async () => { called = true; throw Error('não esperado'); };
  assert.equal(await sendRecoveryEmail({ to:'teste@example.test', token:'segredo' }), false);
  assert.equal(called, false);
});
test('envio usa API autenticada, texto e URL de recuperação', async () => {
  process.env.RESEND_API_KEY = 'chave-ficticia';
  process.env.RESET_EMAIL_FROM = 'Facilita <no-reply@example.test>';
  process.env.FRONTEND_URL = 'https://app.example.test';
  process.env.NODE_ENV = 'production';
  let called = false;
  globalThis.fetch = async (url, options) => {
    called = true;
    assert.equal(url,'https://api.resend.com/emails');
    assert.equal(options.headers.Authorization,'Bearer chave-ficticia');
    const body = JSON.parse(options.body);
    assert.equal(body.to[0],'teste@example.test');
    assert.ok(body.text.includes('reset_token=token-seguro'));
    return { ok:true, status:200 };
  };
  assert.equal(await sendRecoveryEmail({ to:'teste@example.test', token:'token-seguro' }),true);
  assert.equal(called,true);
});
test('falha do provedor gera erro sem expor segredo', async () => {
  process.env.RESEND_API_KEY = 'chave-ficticia';
  process.env.RESET_EMAIL_FROM = 'no-reply@example.test';
  process.env.FRONTEND_URL = 'https://app.example.test';
  globalThis.fetch = async () => ({ok:false,status:503});
  await assert.rejects(sendRecoveryEmail({to:'teste@example.test',token:'segredo'}),/HTTP 503/);
});
test('produção não aceita link de recuperação HTTP', async () => {
  process.env.RESEND_API_KEY = 'chave-ficticia';
  process.env.RESET_EMAIL_FROM = 'no-reply@example.test';
  process.env.FRONTEND_URL = 'http://app.example.test';
  process.env.NODE_ENV = 'production';
  await assert.rejects(sendRecoveryEmail({to:'teste@example.test',token:'segredo'}),/HTTPS/);
});
