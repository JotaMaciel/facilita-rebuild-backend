# Facilita Rebuild — preparação de implantação

Este repositório possui **Dockerfile de demonstração**, mas a aplicação ainda não foi implantada. 

## Construir e testar a imagem
```bash
docker build -t facilita-rebuild-backend .
docker run --rm -p 3000:3000 --env-file .env facilita-rebuild-backend
```

O MySQL precisa estar acessível **a partir do container**. Se estiver usando Docker Compose, lembre-se de que `localhost` dentro do contêiner se refere ao próprio contêiner. Para rodar API e MySQL em conjunto, conecte ambos a uma rede Docker e configure `DATABASE_URL` com o hostname correto do banco.

## Serviço de hospedagem
- Runtime Node.js >=22, HTTPS e suporte a variáveis de ambiente.
- Banco MySQL separado por ambiente, com backups e acesso restrito.
- Configurar `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `NODE_ENV=production` e `PORT` no painel do provedor.
- Healthcheck `/v1/facilita/health`.
- Não publicar o banco MySQL diretamente na internet.
- Usar um processo de migração versionada do banco antes de qualquer deploy produtivo. `db:push` é apenas para homologação descartável.

## Estado
A imagem Docker foi adicionada ao GitHub, mas **não foi construída nem executada** nesta entrega. O GitHub Actions atual valida testes Node e integração com MySQL; ainda falta um job dedicado para construção da imagem.
