> Documento histórico. Para o estado atual, consulte `EXECUCAO_LOCAL.md`, `ESTABILIZACAO.md` e `DEPLOY_HOMOLOGACAO.md`.

# Primeira entrega executável

API mínima independente construída na versão Rebuild, sem copiar controllers ou segredos do repositório original.

## Iniciar

Node.js 22+:

```bash
npm install
cp .env.example .env
npm test
npm run dev
```

## Rotas

- `GET /v1/facilita/health` — healthcheck
- `GET /v1/facilita/servicos` — listagem em memória
- `POST /v1/facilita/servicos` — cria um serviço com descrição e categoria

Exemplo:

```bash
curl -X POST http://localhost:3000/v1/facilita/servicos -H 'Content-Type: application/json' -d '{"descricao":"Comprar medicamentos","categoria":"Compras"}'
```

**Limitação:** os serviços são armazenados somente em memória. Não há banco, login, pagamento ou autorização. Essa API é a primeira base isolada; os endpoints atuais não substituem a lógica de negócio do Facilita original.

## Próximas etapas
- Modelo Prisma + MySQL, migrações e camada de repositório
- Autenticação, perfis e autorização
- Integração com FrontEnd, testes E2E e Socket.IO
- Segurança reforçada e pagamentos exclusivamente em sandbox
