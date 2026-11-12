# Estabilização para homologação

- Proxy: `TRUST_PROXY_HOPS=0` por padrão; Render configura `1`, a validar na infraestrutura real. Teste HTTP confirma isolamento entre IPs e que um IP falso inserido à esquerda não contorna o limite do salto esperado.
- Redefinição: bloqueia a linha do usuário, consome o token, invalida os demais e revoga sessões na mesma transação. Sem mudança de esquema ou migração nova.
- `GET /servicos/:id/mensagens`: últimas 100 mensagens em ordem cronológica, `hasMoreMessages` e `nextCursor`. `?before=<nextCursor>` carrega anteriores. Cursor deve pertencer à conversa; empates de data são resolvidos por ID.
- Listagem de serviços próprios inclui `avaliacao` (objeto ou null).
- Falha de notificação registra código genérico e requestId, sem exceção bruta. Aceite continua independente da notificação; recuperação de notificações permanece pendente.
- `npm test` inclui testes de erros. `npm run test:integration` inclui regressões MySQL: 205 mensagens, cursor cruzado, avaliação e redefinição concorrente. Usar apenas base local descartável `facilita_test`.
- Lockfile versionado; CI, Docker e Render usam `npm ci`.
- Override restrito `@prisma/config > deepmerge-ts@8.0.0` corrige GHSA-ggr8-5vv4-36mx sem migrar Prisma 6. Reavaliar quando o Prisma incorporar a correção. Geração, validação, carregamento de configuração e migrations devem continuar verificados.

## Limites preservados
Faltam homologação Render/Aiven/Vercel, TLS real, entrega Resend, backup/restauração e monitoramento. Limites em memória não são distribuídos. Sessões continuam com uma hora, sem refresh token. Nenhum deploy ou migração sobre dados reais faz parte desta estabilização.

## Evidências locais
Node 22: 37 testes unitários aprovados e 4 cenários de integração MySQL 8.4 aprovados; baseline aplicada em base vazia. Geração do Prisma Client e carregamento de configuração com override aprovados. Auditoria npm: zero avisos na resolução fixada. Isso não substitui o CI do commit publicado ou a homologação hospedada.

Revisão para commit: `render.yaml` validado contra o schema público Render; testes unitários e integração repetidos com sucesso em MySQL descartável. Validação de schema não aplica o Blueprint nem comprova o proxy na infraestrutura real.
