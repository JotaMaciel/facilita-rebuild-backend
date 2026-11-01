import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomToken, tokenHash, expiresAt } from '../src/tokens.js';
test('token aleatório, hash estável e expiração', () => {
  const a = randomToken(), b = randomToken();
  assert.notEqual(a, b);
  assert.equal(tokenHash(a), tokenHash(a));
  assert.notEqual(tokenHash(a), tokenHash(b));
  assert.equal(tokenHash(a).length,64);
  assert.ok(expiresAt(15).getTime() > Date.now());
});
