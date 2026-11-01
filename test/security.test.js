import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../src/security.js';
test('scrypt: valida senha e rejeita senha incorreta', async () => {
  const hash = await hashPassword('senhamuitoSegura1');
  assert.equal(await verifyPassword('senhamuitoSegura1', hash), true);
  assert.equal(await verifyPassword('errada', hash), false);
});
test('JWT: aceita assinatura válida e rejeita adulteração', () => {
  const secret = 'uma-chave-de-testes-segura-com-mais-de-32-caracteres';
  const token = signToken({ id: '123', papel: 'CLIENTE' }, secret);
  assert.equal(verifyToken(token, secret).sub, '123');
  assert.equal(verifyToken(token + 'a', secret), null);
});

test('JWT rejeita tokens emitidos no futuro ou com audiência diferente', () => {
  const secret = 'uma-chave-de-testes-segura-com-mais-de-32-caracteres';
  const token = signToken({ id:'u1', papel:'CLIENTE' }, secret);
  const [header, body] = token.split('.');
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString());
  assert.equal(claims.iss, 'facilita-rebuild');
  assert.equal(claims.aud, 'facilita-web');
  assert.equal(verifyToken(token, secret)?.sub, 'u1');
});

test('JWT rejeita expiração, emissão futura, issuer e audience incorretos', () => {

  const secret = 'uma-chave-de-testes-segura-com-mais-de-32-caracteres';
  const valid = signToken({ id:'user-1', papel:'CLIENTE' },secret);
  const [header, encoded] = valid.split('.');
  const original = JSON.parse(Buffer.from(encoded,'base64url').toString());
  const now = Math.floor(Date.now()/1000);
  for (const changes of [
    {exp:now-1},
    {iat:now+3600},
    {iss:'outro-sistema'},
    {aud:'outro-cliente'},
    {sub:''},
  ]) {
    const payload = Buffer.from(JSON.stringify({...original,...changes})).toString('base64url');
    const sig = createHmac('sha256',secret).update(header+'.'+payload).digest('base64url');
    assert.equal(verifyToken(header+'.'+payload+'.'+sig,secret),null);
  }
});

test('JWT de outro ambiente não é aceito mesmo com claims válidos', () => {
  const productionSecret = 'chave-do-ambiente-principal-com-mais-de-32-caracteres';
  const stagingSecret = 'chave-do-ambiente-de-testes-com-mais-de-32-caracteres';
  const token = signToken({ id:'user-2', papel:'CLIENTE' },stagingSecret);
  assert.equal(verifyToken(token,productionSecret),null);
  assert.equal(verifyToken(token,stagingSecret)?.sub,'user-2');
});
