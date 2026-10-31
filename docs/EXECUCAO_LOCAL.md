# Executando o Facilita Rebuild localmente

## BackEnd
Requisitos: Node.js >=22, Docker Compose e npm.

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:generate
npm run db:push
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

## Limitações atuais
- API e UI foram implementadas, **não testadas ponta a ponta** nesta entrega (sem download de dependências no ambiente disponível).
- Não há refresh token, recuperação de senha ou autorização por recurso/papel.
- Não há contratação, pagamento real, chat, geolocalização ou integração com o projeto original.
- A listagem retorna até 100 serviços; é necessário implementar paginação e checagem de acesso antes do uso real.
- API é uma reimplementação inicial e ainda não tem paridade com o Facilita original.
