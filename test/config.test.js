import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionConfig } from '../src/config.js';

const valid = { NODE_ENV:'production', JWT_SECRET:'segredo-forte-gerado-com-mais-de-quarenta-e-oito-caracteres-aleatorios', DATABASE_URL:'mysql://usuario:segredo@mysql:3306/facilita', FRONTEND_URL:'https://app.example.test', DEV_PASSWORD_RESET_LOG:'false' };

test('ambiente de desenvolvimento não exige configuração de produção', () => {
  assert.equal(validateProductionConfig({ NODE_ENV:'development' }),true);
});
test('produção com configurações válidas inicia', () => {
  assert.equal(validateProductionConfig(valid),true);
});
test('produção rejeita chave fraca e URL insegura', () => {
  assert.throws(()=>validateProductionConfig({...valid,JWT_SECRET:'senha-curta',FRONTEND_URL:'http://app.example.test'}),/JWT_SECRET.*FRONTEND_URL/);
});
test('produção rejeita logs de tokens e origens com caminho', () => {
  assert.throws(()=>validateProductionConfig({...valid,DEV_PASSWORD_RESET_LOG:'true',FRONTEND_URL:'https://app.example.test/path'}),/FRONTEND_URL.*DEV_PASSWORD_RESET_LOG/);
});

test('proxy aceita somente quantidade explícita e limitada de saltos', () => {
  for (const value of ['true', '*', '-1', '6', '1.5', '']) {
    assert.throws(() => validateProductionConfig({ NODE_ENV: 'development', TRUST_PROXY_HOPS: value }), /TRUST_PROXY_HOPS/);
  }
  for (const value of ['0', '1', '2']) assert.equal(validateProductionConfig({ NODE_ENV: 'development', TRUST_PROXY_HOPS: value }), true);
});
