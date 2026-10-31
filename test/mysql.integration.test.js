import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';

const prisma = new PrismaClient();
const secret = 'chave-somente-para-testes-de-integracao-com-mysql';
let server;
let base;
let token;
let userId;
let serviceId;

before(async () => {
  if (!process.env.DATABASE_URL?.includes('facilita_test')) {
    throw new Error('Integração só pode rodar com DATABASE_URL apontando para facilita_test');
  }
  await prisma.$connect();
  server = createApp({ db: prisma, jwtSecret: secret }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/v1/facilita`;
});
after(async () => {
  if (serviceId) await prisma.servico.deleteMany({ where: { id: serviceId } });
  if (userId) { await prisma.notificacao.deleteMany({ where: { usuarioId: userId } }); await prisma.usuario.deleteMany({ where: { id: userId } }); }
  await new Promise(resolve => server?.close(resolve));
  await prisma.$disconnect();
});
test('fluxo HTTP real: registro, login, serviço, isolamento e cancelamento', async () => {
  const email = `integration-${crypto.randomUUID()}@example.test`;
  const headers = { 'Content-Type': 'application/json' };
  const register = await fetch(base + '/auth/registro', { method: 'POST', headers, body: JSON.stringify({ nome: 'Teste Integração', email, senha: 'SenhaSegura123!' }) });
  assert.equal(register.status, 201);
  userId = (await register.json()).data.id;
  const login = await fetch(base + '/auth/login', { method: 'POST', headers, body: JSON.stringify({ email, senha: 'SenhaSegura123!' }) });
  assert.equal(login.status, 200);
  token = (await login.json()).token;
  const unauthorized = await fetch(base + '/servicos');
  assert.equal(unauthorized.status, 401);
  const created = await fetch(base + '/servicos', { method: 'POST', headers: { ...headers, Authorization: `Bearer ${token}` }, body: JSON.stringify({ descricao: 'Comprar remédios na farmácia', categoria: 'Compras' }) });
  assert.equal(created.status, 201);
  serviceId = (await created.json()).data.id;
  const list = await fetch(base + '/servicos', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(list.status, 200);
  assert.equal((await list.json()).data.some(s => s.id === serviceId), true);
  const cancelled = await fetch(base + `/servicos/${serviceId}/cancelar`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
  assert.equal(cancelled.status, 200);
  assert.equal((await cancelled.json()).data.status, 'CANCELADO');
  // Segundo serviço: ciclo completo com usuário prestador independente.
  const created2 = await fetch(base + '/servicos', { method:'POST', headers: { ...headers, Authorization: 'Bearer ' + token }, body: JSON.stringify({ descricao:'Ajudar com transporte de compras', categoria:'Entrega' }) });
  assert.equal(created2.status, 201);
  const secondId = (await created2.json()).data.id;
  const providerEmail = `prestador-${crypto.randomUUID()}@example.test`;
  const registeredProvider = await fetch(base + '/auth/registro', { method:'POST', headers, body: JSON.stringify({ nome:'Prestador Teste', email:providerEmail, senha:'SenhaSegura123!', papel:'PRESTADOR' }) });
  assert.equal(registeredProvider.status, 201);
  const providerId = (await registeredProvider.json()).data.id;
  try {
    const loginProvider = await fetch(base + '/auth/login', { method:'POST', headers, body:JSON.stringify({ email:providerEmail, senha:'SenhaSegura123!' }) });
    assert.equal(loginProvider.status, 200);
    const providerToken = (await loginProvider.json()).token;
    const providerHeaders = { Authorization: `Bearer ${providerToken}` };
    const available = await fetch(base + '/servicos/disponiveis', { headers: providerHeaders });
    assert.equal(available.status, 200);
    assert.equal((await available.json()).data.some(item=>item.id===secondId),true);
    for (const [action, expected] of [['aceitar','ACEITO'],['iniciar','EM_ANDAMENTO'],['concluir','CONCLUIDO']]) {
      const response = await fetch(base + `/servicos/${secondId}/${action}`, { method:'PATCH', headers:providerHeaders });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).data.status, expected);
    }
    // Autorização: desconhecidos não podem acessar a conversa nem notificações de terceiros.
    const message = await fetch(base + `/servicos/${secondId}/mensagens`, {
      method:'POST', headers:{ ...headers, Authorization:`Bearer ${providerToken}` },
      body:JSON.stringify({ texto:'Estou a caminho!' })
    });
    assert.equal(message.status,201);
    const messageId = (await message.json()).data.id;
    const messagesForCustomer = await fetch(base + `/servicos/${secondId}/mensagens`, { headers:{ Authorization:`Bearer ${token}` } });
    assert.equal(messagesForCustomer.status,200);
    assert.equal((await messagesForCustomer.json()).data.some(m=>m.id===messageId),true);
    const unknownMail = `outsider-${crypto.randomUUID()}@example.test`;
    const outsider = await fetch(base + '/auth/registro', { method:'POST', headers, body:JSON.stringify({ nome:'Usuário Externo', email:unknownMail, senha:'SenhaSegura123!' }) });
    assert.equal(outsider.status,201);
    const outsiderId = (await outsider.json()).data.id;
    try {
      const outsiderLogin = await fetch(base + '/auth/login', { method:'POST', headers, body:JSON.stringify({email:unknownMail,senha:'SenhaSegura123!'})});
      const outsiderToken = (await outsiderLogin.json()).token;
      const blocked = await fetch(base + `/servicos/${secondId}/mensagens`, { headers:{Authorization:`Bearer ${outsiderToken}`} });
      assert.equal(blocked.status,404);
    } finally {
      await prisma.usuario.deleteMany({ where:{ id: outsiderId } });
    }
    const note = await fetch(base+'/notificacoes',{headers:{Authorization:`Bearer ${token}`}});
    assert.equal(note.status,200);
    const notice = (await note.json()).data.find(n=>n.titulo==='Serviço aceito');
    assert.ok(notice);
    const marked = await fetch(base+`/notificacoes/${notice.id}/lida`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`}});
    assert.equal(marked.status,200);
    const review = await fetch(base + `/servicos/${secondId}/avaliacao`, { method:'POST', headers: { ...headers, Authorization: `Bearer ${token}` }, body:JSON.stringify({ nota:5, comentario:'Atendimento excelente' }) });
    assert.equal(review.status,201);
    const duplicate = await fetch(base + `/servicos/${secondId}/avaliacao`, { method:'POST', headers: { ...headers, Authorization: `Bearer ${token}` }, body:JSON.stringify({ nota:4 }) });
    assert.equal(duplicate.status,409);
  } finally {
    await prisma.mensagem.deleteMany({ where: { servicoId: secondId } });
    await prisma.avaliacao.deleteMany({ where: { servicoId: secondId } });
    await prisma.servico.deleteMany({ where: { id: secondId } });
    await prisma.usuario.deleteMany({ where: { id: providerId } });
  }

});
