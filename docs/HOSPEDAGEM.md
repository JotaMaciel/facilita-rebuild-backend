# Implantação e homologação — Facilita Rebuild

## Situação
Documentação de preparação. **Nenhuma hospedagem foi configurada por este documento.** Publicar somente depois dos testes e da revisão de segurança.

## Requisitos
- Node.js 22 ou superior
- Serviço MySQL com backup e conexão TLS
- Serviço Node.js com HTTPS e healthcheck
- FrontEnd configurado com a URL da API

## Variáveis necessárias (definir na plataforma, nunca no Git)
| Nome | Exemplo/descrição |
|---|---|
| NODE_ENV | production |
| PORT | porta fornecida pelo provedor |
| DATABASE_URL | string de conexão MySQL com TLS |
| JWT_SECRET | segredo aleatório longo gerado fora do Git |
| FRONTEND_URL | URL HTTPS da interface |

O arquivo `.env.example` é somente um modelo de desenvolvimento. Configure domínios autorizados de forma explícita.

## Comandos sugeridos
Build: `npm install && npm run db:generate`.
Início: `npm start`.

**Atenção ao banco:** a migração inicial versionada está em `prisma/migrations/20261031_initial_baseline/`. Ela é adequada a um **banco MySQL vazio de homologação**, e o CI valida `npm run db:deploy`. Não aplique a baseline sobre um banco existente sem inspeção, backup e processo de baselining. Leia `docs/MIGRACOES.md` e `docs/DEPLOY_HOMOLOGACAO.md`. Não rode `prisma db push` no banco hospedado.

## Healthcheck
`GET /v1/facilita/health` verifica também a conexão com o MySQL. Em indisponibilidade do banco, responde erro de servidor. Configure o probe HTTP do provedor com essa rota após validar o comportamento em homologação.

## Checklist para liberar hospedagem
- [ ] Testes de integração passando na revisão final
- [ ] Banco de homologação separado, sem informações pessoais reais
- [ ] Migrações criadas, revisadas e testadas
- [ ] Política de expiração/renovação de tokens e rate limit analisada
- [ ] Autorização por objeto e limites de paginação revisados
- [ ] CORS e tratamento de erros verificados
- [ ] Logs sem senha, token ou dados pessoais
- [ ] Backup, restauração, monitoramento e rollback testados
- [ ] Nenhum pagamento real integrado no ambiente de demonstração
