# Facilita Rebuild — Docker e homologação

A imagem Docker do BackEnd é construída automaticamente pelo GitHub Actions. O Dockerfile executa Node.js 22 como usuário não privilegiado e inclui healthcheck HTTP em `/v1/facilita/live`. O endpoint `/health` verifica separadamente a conectividade MySQL.

## Imagem da API

```bash
docker build -t facilita-rebuild-backend .
docker run --rm -p 3000:3000 --env-file .env facilita-rebuild-backend
```

**Atenção:** a `DATABASE_URL` precisa apontar para o hostname acessível *de dentro* da rede Docker, e não para `localhost` no host. O arquivo `docker-compose.yml` atual inicia **somente o MySQL local**, com credenciais fictícias para desenvolvimento. Não reutilizar essas credenciais em homologação ou produção.

## Banco e migrações

Em uma base nova e isolada, execute `npm run db:deploy` e `npm run db:status` antes de abrir a API ao tráfego. Não execute `prisma db push` em produção. Bancos já existentes exigem o procedimento de baselining descrito em `docs/MIGRACOES.md`.

## Requisitos antes de publicar

- Configure `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` e `PORT` no gerenciador de segredos da plataforma.
- Use HTTPS e permita conexão com o MySQL apenas pela rede privada.
- Ative backups, testes de restauração, logs protegidos e monitoramento externo.
- A inicialização valida segredos e origens HTTPS; veja `docs/CONFIG_PRODUCAO.md`.
- Configure o endpoint `/v1/facilita/live` para *liveness* e `/v1/facilita/health` para *readiness*.
- O serviço de e-mail permanece opcional e requer domínio verificado e credenciais próprias.

O build Docker e o conjunto de testes são executados no CI, mas **nenhuma implantação de homologação ou produção foi realizada**.

## Teste real no GitHub Actions
Além de construir a imagem, o CI agora inicia um contêiner com configurações sintéticas de produção e consulta `GET /v1/facilita/live` via HTTP. Este teste não depende do banco: confirma inicialização, validação de ambiente e resposta HTTP dentro do Docker. A conectividade MySQL e as migrações seguem cobertas pelo job de integração independente.
