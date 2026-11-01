# Migrações Prisma versionadas

A migração inicial foi gerada pelo Prisma CLI a partir de `prisma/schema.prisma` para um banco **vazio** em 31/10/2026. Está em `prisma/migrations/20261031_initial_baseline/migration.sql`.

## Em ambiente novo
1. Crie uma base MySQL 8.4 separada e vazia.
2. Configure a `DATABASE_URL` correta e com acesso limitado.
3. Execute `npm install`, `npm run db:generate`, `npm run db:deploy`.
4. Confira `npm run db:status`.
5. Execute os testes de integração somente na base de testes.

## Bancos existentes
**Não aplique diretamente essa baseline a um banco que já foi configurado via `prisma db push`**, pois as tabelas já estarão presentes. Nesse caso, avalie o esquema e faça o baselining com `prisma migrate resolve --applied 20261031_initial_baseline` **apenas depois de comparar e confirmar a equivalência**. Faça backup antes. Nunca use `migrate reset` em produção.

O CI passa a executar `migrate deploy` em banco limpo para verificar a migração. A baseline não representa migração dos dados do projeto original.
