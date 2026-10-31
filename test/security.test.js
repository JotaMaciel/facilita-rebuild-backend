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
