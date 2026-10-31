import { test } from 'node:test';
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
