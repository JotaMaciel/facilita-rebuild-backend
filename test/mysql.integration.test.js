import crypto from 'node:crypto';
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
  if (userId) { await prisma.sessao.deleteMany({ where: { usuarioId: userId } }); await prisma.recuperacaoSenha.deleteMany({ where: { usuarioId: userId } }); await prisma.notificacao.deleteMany({ where: { usuarioId: userId } }); await prisma.usuario.deleteMany({ where: { id: userId } }); }
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
  const resetRequest = await fetch(base + '/auth/recuperar-senha', { method:'POST', headers, body:JSON.stringify({email}) });
  assert.equal(resetRequest.status,200);
  const resetRow = await prisma.recuperacaoSenha.findFirst({ where:{ usuarioId:userId } });
  assert.ok(resetRow?.tokenHash);
  const unknownRequest = await fetch(base + '/auth/recuperar-senha', { method:'POST', headers, body:JSON.stringify({email:'nao-existe@example.test'}) });
  assert.equal(unknownRequest.status,200);

  const meBeforeLogout = await fetch(base + '/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(meBeforeLogout.status, 200);
  const unauthorized = await fetch(base + '/servicos');
  assert.equal(unauthorized.status, 401);
  const beforeInvalidCreate = await prisma.servico.count({ where: { usuarioId: userId } });
  for (const invalid of [
    { descricao: 'curta', categoria: 'A' },
    { descricao: 'x'.repeat(501), categoria: 'Compras' },
    { descricao: 'Solicitação válida', categoria: 'x'.repeat(81) },
  ]) {
    const rejected = await fetch(base + '/servicos', {
      method: 'POST', headers: { ...headers, Authorization: `Bearer ${token}` },
      body: JSON.stringify(invalid),
    });
    assert.equal(rejected.status, 400);
    assert.equal((await rejected.json()).error, 'VALIDATION_ERROR');
  }
  assert.equal(await prisma.servico.count({ where: { usuarioId: userId } }), beforeInvalidCreate,
    'requisições inválidas não devem persistir serviços no MySQL');
  const created = await fetch(base + '/servicos', { method: 'POST', headers: { ...headers, Authorization: `Bearer ${token}` }, body: JSON.stringify({ descricao: 'Comprar remédios na farmácia', categoria: 'Compras' }) });
  assert.equal(created.status, 201);
  serviceId = (await created.json()).data.id;
  const list = await fetch(base + '/servicos', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(list.status, 200);
  assert.equal((await list.json()).data.some(s => s.id === serviceId), true);
  const badPage = await fetch(base + '/servicos?page=-1', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(badPage.status,400);
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
    const blockedProviderCreation = await fetch(base + '/servicos', {
      method:'POST',
      headers: { ...headers, ...providerHeaders },
      body:JSON.stringify({ descricao:'Tentativa indevida de serviço', categoria:'Teste' })
    });
    assert.equal(blockedProviderCreation.status,403);

    const available = await fetch(base + '/servicos/disponiveis', { headers: providerHeaders });
    assert.equal(available.status, 200);
    assert.equal((await available.json()).data.some(item=>item.id===secondId),true);
    const competingEmail = `competidor-${crypto.randomUUID()}@example.test`;
    const competingRegister = await fetch(base + '/auth/registro', {
      method:'POST',headers,body:JSON.stringify({nome:'Outro Prestador',email:competingEmail,senha:'SenhaSegura123!',papel:'PRESTADOR'})
    });
    assert.equal(competingRegister.status,201);
    const competingId = (await competingRegister.json()).data.id;
    try {
      const competingLogin = await fetch(base + '/auth/login',{
        method:'POST',headers,body:JSON.stringify({email:competingEmail,senha:'SenhaSegura123!'})
      });
      assert.equal(competingLogin.status,200);
      const competingToken = (await competingLogin.json()).token;
      const attempts = await Promise.all([
        fetch(base + `/servicos/${secondId}/aceitar`,{method:'PATCH',headers:providerHeaders}),
        fetch(base + `/servicos/${secondId}/aceitar`,{method:'PATCH',headers:{Authorization:'Bearer '+competingToken}})
      ]);
      assert.deepEqual(attempts.map(x=>x.status).sort(),[200,409]);
      const accepted = await prisma.servico.findUnique({where:{id:secondId}});
      assert.equal(accepted.status,'ACEITO');
      assert.ok([providerId,competingId].includes(accepted.prestadorId));
      const noticesBeforeRetry = await prisma.notificacao.count({where:{usuarioId:userId,titulo:'Serviço aceito'}});
      const losingToken = accepted.prestadorId === providerId ? competingToken : providerToken;
      const losingAttempt = await fetch(base + `/servicos/${secondId}/aceitar`,{
        method:'PATCH',headers:{Authorization:'Bearer '+losingToken}
      });
      assert.equal(losingAttempt.status,409);
      const afterLosingAttempt = await prisma.servico.findUnique({where:{id:secondId}});
      assert.equal(afterLosingAttempt.prestadorId,accepted.prestadorId);
      assert.equal(afterLosingAttempt.status,'ACEITO');
      assert.equal(await prisma.notificacao.count({where:{usuarioId:userId,titulo:'Serviço aceito'}}),noticesBeforeRetry,'tentativa rejeitada não deve gerar notificação adicional');
      const notices = await prisma.notificacao.count({where:{usuarioId:userId,titulo:'Serviço aceito'}});
      assert.equal(notices,1,'aceite concorrente gera uma única notificação');
      // Reinicia apenas o cenário de integração após verificar a disputa concorrente.
      await prisma.servico.update({where:{id:secondId},data:{status:'PENDENTE',prestadorId:null}});
      await prisma.notificacao.deleteMany({where:{usuarioId:userId,titulo:'Serviço aceito'}});
    } finally {
      await prisma.sessao.deleteMany({where:{usuarioId:competingId}});
      await prisma.usuario.deleteMany({where:{id:competingId}});
    }
    const prematureCompletion = await fetch(base + `/servicos/${secondId}/concluir`, {method:'PATCH',headers:providerHeaders});
    assert.equal(prematureCompletion.status,409);
    const stillPending = await prisma.servico.findUnique({where:{id:secondId}});
    assert.equal(stillPending.status,'PENDENTE');
    for (const [action, expected] of [['aceitar','ACEITO'],['iniciar','EM_ANDAMENTO']]) {
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
      const sessions = await fetch(base + '/auth/sessoes', {headers:providerHeaders});
      assert.equal(sessions.status,200);
      const otherSessionId = (await sessions.json()).data.find(s=>s.atual)?.id;
      assert.ok(otherSessionId);
      const outsiderSessions = await fetch(base + '/auth/sessoes',{headers:{Authorization:'Bearer '+outsiderToken}});
      assert.equal(outsiderSessions.status,200);
      assert.equal((await outsiderSessions.json()).data.some(s=>s.id===otherSessionId),false);
      const attempt = await fetch(base + '/auth/sessoes/' + otherSessionId, {method:'DELETE',headers:{Authorization:'Bearer '+outsiderToken}});
      assert.equal(attempt.status,404);
      assert.equal((await fetch(base + '/auth/me',{headers:providerHeaders})).status,200);
      const blocked = await fetch(base + `/servicos/${secondId}/mensagens`, { headers:{Authorization:`Bearer ${outsiderToken}`} });
      assert.equal(blocked.status,404);
      const clientNotifications = await prisma.notificacao.findFirst({where:{usuarioId:userId,titulo:'Serviço aceito'}});
      assert.ok(clientNotifications);
      const deniedNotification = await fetch(base + `/notificacoes/${clientNotifications.id}/lida`,{
        method:'PATCH',headers:{Authorization:`Bearer ${outsiderToken}`}
      });
      assert.equal(deniedNotification.status,404);
      const notificationUnchanged = await prisma.notificacao.findUnique({where:{id:clientNotifications.id}});
      assert.equal(notificationUnchanged.lida,false);
      const deniedPost = await fetch(base + `/servicos/${secondId}/mensagens`, {
        method:'POST', headers:{...headers,Authorization:`Bearer ${outsiderToken}`},
        body:JSON.stringify({texto:'Tentativa de acesso não autorizado'})
      });
      assert.equal(deniedPost.status,403);
      const deniedCancel = await fetch(base + `/servicos/${secondId}/cancelar`, {
        method:'PATCH', headers:{Authorization:`Bearer ${outsiderToken}`}
      });
      assert.equal(deniedCancel.status,409);
      const deniedReview = await fetch(base + `/servicos/${secondId}/avaliacao`, {
        method:'POST', headers:{...headers,Authorization:`Bearer ${outsiderToken}`},
        body:JSON.stringify({nota:1,comentario:'Avaliação indevida'})
      });
      assert.equal(deniedReview.status,409);
    } finally {
      await prisma.sessao.deleteMany({ where:{ usuarioId: outsiderId } });
      await prisma.usuario.deleteMany({ where:{ id: outsiderId } });
    }
    const note = await fetch(base+'/notificacoes',{headers:{Authorization:`Bearer ${token}`}});
    assert.equal(note.status,200);
    const notice = (await note.json()).data.find(n=>n.titulo==='Serviço aceito');
    assert.ok(notice);
    const marked = await fetch(base+`/notificacoes/${notice.id}/lida`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`}});
    assert.equal(marked.status,200);
    const customerCannotFinish = await fetch(base + `/servicos/${secondId}/concluir`, {
      method:'PATCH',headers:{Authorization:`Bearer ${token}`}
    });
    assert.equal(customerCannotFinish.status,403);
    const afterDeniedFinish = await prisma.servico.findUnique({where:{id:secondId}});
    assert.equal(afterDeniedFinish.status,'EM_ANDAMENTO');
    assert.equal(afterDeniedFinish.prestadorId,providerId);
    const duplicateStart = await fetch(base + `/servicos/${secondId}/iniciar`,{method:'PATCH',headers:providerHeaders});
    assert.equal(duplicateStart.status,409);
    assert.equal((await prisma.servico.findUnique({where:{id:secondId}})).status,'EM_ANDAMENTO');
    const notificationCountBeforeCompletion = await prisma.notificacao.count({where:{usuarioId:userId}});
    const completion = await fetch(base + `/servicos/${secondId}/concluir`, {method:'PATCH',headers:providerHeaders});
    assert.equal(completion.status,200);
    assert.equal((await completion.json()).data.status,'CONCLUIDO');
    const cannotCancelFinished = await fetch(base + `/servicos/${secondId}/cancelar`, {
      method:'PATCH',headers:{Authorization:`Bearer ${token}`}
    });
    assert.equal(cannotCancelFinished.status,409);
    assert.equal((await prisma.servico.findUnique({where:{id:secondId}})).prestadorId,providerId);
    const notificationCountAfterCompletion = await prisma.notificacao.count({where:{usuarioId:userId}});
    const repeatedCompletion = await fetch(base + `/servicos/${secondId}/concluir`,{method:'PATCH',headers:providerHeaders});
    assert.equal(repeatedCompletion.status,409);
    assert.equal((await prisma.servico.findUnique({where:{id:secondId}})).status,'CONCLUIDO');
    assert.equal(await prisma.notificacao.count({where:{usuarioId:userId}}),notificationCountAfterCompletion,'repetir conclusão não deve criar notificações');
    assert.ok(notificationCountAfterCompletion>=notificationCountBeforeCompletion);
    const finishedChat = await fetch(base + `/servicos/${secondId}/mensagens`, {method:'POST',headers:{...headers,Authorization:`Bearer ${providerToken}`},body:JSON.stringify({texto:'Mensagem após concluir'})});
    assert.equal(finishedChat.status,403);
    const review = await fetch(base + `/servicos/${secondId}/avaliacao`, { method:'POST', headers: { ...headers, Authorization: `Bearer ${token}` }, body:JSON.stringify({ nota:5, comentario:'Atendimento excelente' }) });
    assert.equal(review.status,201);
    const duplicate = await fetch(base + `/servicos/${secondId}/avaliacao`, { method:'POST', headers: { ...headers, Authorization: `Bearer ${token}` }, body:JSON.stringify({ nota:4 }) });
    assert.equal(duplicate.status,409);
  } finally {
    await prisma.mensagem.deleteMany({ where: { servicoId: secondId } });
    await prisma.avaliacao.deleteMany({ where: { servicoId: secondId } });
    await prisma.servico.deleteMany({ where: { id: secondId } });
    await prisma.sessao.deleteMany({ where: { usuarioId: providerId } });
    await prisma.usuario.deleteMany({ where: { id: providerId } });
  }
  // Recuperação real no MySQL: token válido apenas uma vez e revogação das sessões.
  const resetToken = crypto.randomBytes(32).toString('base64url');
  const resetHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  await prisma.recuperacaoSenha.create({ data: { usuarioId: userId, tokenHash: resetHash, expiraEm: new Date(Date.now() + 15*60000) } });
  const invalidReset = await fetch(base + '/auth/redefinir-senha', { method:'POST', headers, body:JSON.stringify({token:'token-que-nao-existe-mesmo-com-comprimento-valido-123',senha:'SenhaNova456!'})});
  assert.equal(invalidReset.status,400);
  const resetDone = await fetch(base + '/auth/redefinir-senha', { method:'POST', headers, body:JSON.stringify({token:resetToken,senha:'SenhaNova456!'}) });
  assert.equal(resetDone.status,200);
  const reuse = await fetch(base + '/auth/redefinir-senha', { method:'POST', headers, body:JSON.stringify({token:resetToken,senha:'SenhaOutra789!'}) });
  assert.equal(reuse.status,400);
  const revokedAfterReset = await fetch(base + '/auth/me', {headers:{Authorization:`Bearer ${token}`}});
  assert.equal(revokedAfterReset.status,401);
  const oldLogin = await fetch(base + '/auth/login', {method:'POST',headers,body:JSON.stringify({email,senha:'SenhaSegura123!'})});
  assert.equal(oldLogin.status,401);
  const freshLogin = await fetch(base + '/auth/login', {method:'POST',headers,body:JSON.stringify({email,senha:'SenhaNova456!'})});
  assert.equal(freshLogin.status,200);
  const freshToken = (await freshLogin.json()).token;
  const activeSessions = await fetch(base + '/auth/sessoes', { headers: { Authorization: `Bearer ${freshToken}` } });
  assert.equal(activeSessions.status,200);
  assert.ok((await activeSessions.json()).data.some(s=>s.atual === true));
  const logout = await fetch(base + '/auth/logout', { method:'POST', headers: { Authorization: `Bearer ${freshToken}` } });
  assert.equal(logout.status, 200);
  const revoked = await fetch(base + '/auth/me', { headers: { Authorization: `Bearer ${freshToken}` } });
  assert.equal(revoked.status, 401);
  const fresh2 = await fetch(base + '/auth/login', {method:'POST',headers,body:JSON.stringify({email,senha:'SenhaNova456!'})});
  assert.equal(fresh2.status,200);
  const secondToken = (await fresh2.json()).token;
  const thirdLogin = await fetch(base + '/auth/login', {method:'POST',headers,body:JSON.stringify({email,senha:'SenhaNova456!'})});
  assert.equal(thirdLogin.status,200);
  const thirdToken = (await thirdLogin.json()).token;
  const sessionList = await fetch(base + '/auth/sessoes',{headers:{Authorization:`Bearer ${secondToken}`}});
  const otherSession = (await sessionList.json()).data.find(s=>!s.atual);
  assert.ok(otherSession);
  const deleteOther = await fetch(base + `/auth/sessoes/${otherSession.id}`,{method:'DELETE',headers:{Authorization:`Bearer ${secondToken}`}});
  assert.equal(deleteOther.status,200);
  const otherBlocked = await fetch(base + '/auth/me',{headers:{Authorization:`Bearer ${thirdToken}`}});
  assert.equal(otherBlocked.status,401);
  // Uma das sessões anteriores foi encerrada; a atual continua autorizada.
  const stillAuthorized = await fetch(base + '/auth/me',{headers:{Authorization:`Bearer ${secondToken}`}});
  assert.equal(stillAuthorized.status,200);
  const revokeAll = await fetch(base + '/auth/sair-de-todas',{method:'POST',headers:{Authorization:`Bearer ${secondToken}`}});
  assert.equal(revokeAll.status,200);
  const blockedAll = await fetch(base + '/auth/me',{headers:{Authorization:`Bearer ${secondToken}`}});
  assert.equal(blockedAll.status,401);
});
