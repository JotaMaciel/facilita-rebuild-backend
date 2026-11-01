# Executando o Facilita Rebuild localmente

## BackEnd
Requisitos: Node.js >=22, Docker Compose e npm.

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:generate
npm run db:deploy
npm test
npm run dev
```

Substitua `JWT_SECRET` por uma chave aleatória com pelo menos 32 caracteres. As credenciais do `docker-compose.yml` são somente para desenvolvimento local.

**Atenção:** `db:push` sincroniza um banco descartável de desenvolvimento sem registrar migrações. Antes de produção, gerar e revisar migrações Prisma, definir uma estratégia de deploy e nunca executar `db:push` contra um banco produtivo sem avaliação.

## FrontEnd

No repositório `facilita-rebuild-frontend`:

```bash
npm install
cp .env.example .env
npm run dev
```

O FrontEnd espera `http://localhost:3000/v1/facilita` por padrão.

## Rotas iniciais

| Método | Rota | Autorização |
|---|---|---|
| GET | /v1/facilita/health | Pública |
| POST | /v1/facilita/auth/registro | Pública |
| POST | /v1/facilita/auth/login | Pública |
| GET | /v1/facilita/auth/me | Bearer JWT |
| GET | /v1/facilita/servicos | Bearer JWT |
| POST | /v1/facilita/servicos | Bearer JWT |

## Validação integrada
O GitHub Actions executa testes unitários e integração real com MySQL. O repositório [FrontEnd Rebuild](https://github.com/JotaMaciel/facilita-rebuild-frontend) executa também um cenário de Chromium contra esta API e um MySQL de testes, incluindo autenticação, criação/cancelamento, atendimento, mensagens, avaliações, notificações e paginação.

Para verificar a API localmente, execute `npm test` e, com o MySQL iniciado e as migrações aplicadas, `npm run test:integration`. O teste completo de navegador é executado no pipeline do FrontEnd; o comando `npm run dev` sozinho não valida os fluxos de ponta a ponta.

## Recursos e limitações atuais
- O MVP implementa cadastro, login, recuperação e redefinição de senha por token, gerenciamento/revogação de sessões, autorização por papel e por recurso, solicitações paginadas, aceite/início/conclusão, mensagens, notificações e avaliações.
- A recuperação de senha depende de configuração de envio de e-mail para uso real. `DEV_PASSWORD_RESET_LOG` é apenas para testes locais e não deve ser habilitado em produção.
- Mensagens e notificações são consultadas periodicamente pelo FrontEnd; não há canal WebSocket em tempo real.
- Não há contratação nem pagamento real, geolocalização ou paridade completa com os sistemas de origem.
- Os testes automatizados cobrem cenários definidos em ambiente de CI. Uma implantação em produção exige revisão de segredos, configuração de CORS, HTTPS, observabilidade, backups e testes de deploy/restart com dados persistidos.

**Observação:** `db:deploy` é indicado para uma base de testes **vazia**. Em banco existente já sincronizado via `db:push`, leia `docs/MIGRACOES.md` antes de executar.

### Persistência após reiniciar a API
O teste `test/mysql.integration.test.js` também encerra o servidor HTTP, desconecta e reconecta o Prisma e inicia uma nova instância da API, sem recriar o banco. Em seguida, autentica a consulta com a sessão anterior e verifica que o serviço persistido continua disponível no MySQL. Esse cenário cobre a reinicialização da API, **não** substitui um teste de reinicialização do contêiner MySQL ou a validação de backup e restauração em produção.
