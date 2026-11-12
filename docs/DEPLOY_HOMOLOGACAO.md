# Deploy de homologação — Facilita Rebuild

Esta configuração usa **Aiven MySQL Free**, **Render Web Service Free** e **Vercel Hobby**. Use exclusivamente um banco novo e contas fictícias. Os serviços ainda não estão publicados apenas por adicionar estes arquivos.

## Ordem obrigatória

1. Aiven: crie um serviço **MySQL Free**, na região disponível mais próxima. Aguarde o serviço ficar ativo. Copie host, porta, usuário, senha, nome do banco e CA/certificado conforme o painel, sem publicar credenciais no GitHub. Monte uma URL `mysql://` adequada ao Prisma 6, com TLS e verificação de certificado; teste a conexão antes de publicar. Não cole senhas em mensagens de chat.
2. Render: conecte o repositório `JotaMaciel/facilita-rebuild-backend` e a branch `feat/persistencia-autenticacao`. Use **Blueprint** do `render.yaml`, confirme **Free** e não aceite upgrades pagos. Preencha `DATABASE_URL` (secreta) e `FRONTEND_URL` com a origem HTTPS da Vercel. Preencha `JWT_SECRET` com uma chave aleatória forte de **pelo menos 48 caracteres**, gerada localmente em um gerenciador de segredos. Não use o gerador padrão do Blueprint sem verificar seu comprimento. Caso ainda não exista URL da Vercel, crie o projeto Vercel primeiro para obtê-la, sem precisar publicar um FrontEnd funcional.
3. Vercel: importe `JotaMaciel/facilita-rebuild-frontend`, branch `feat/interface-integrada-api`, framework **Vite**, comando `npm run build`, saída `dist`; defina `VITE_API_BASE_URL=https://<nome-real-da-api>.onrender.com/v1/facilita` **antes do build** e faça redeploy ao alterar essa variável.
4. Render: confira `FRONTEND_URL=https://<dominio-real>.vercel.app`, sem barra final nem caminho, e publique novamente a API se necessário. O código impede iniciar em `NODE_ENV=production` sem `DATABASE_URL`, `FRONTEND_URL` HTTPS e `JWT_SECRET` forte.
5. Teste `GET /v1/facilita/live` e `GET /v1/facilita/health` (este segundo precisa retornar `database: connected`). Então teste cadastro de CLIENTE e PRESTADOR, login, criação e aceitação de serviços, mensagens, conclusão, avaliação, notificações, logout e bloqueio de acesso de terceiros.

## Cuidados

- O plano **Free do Render** não possui pre-deploy command. **Somente para homologação em banco novo**, o `render.yaml` usa `npm run db:deploy && npm start` no início do serviço. O comando é idempotente, mas reexecuta a checagem de migrações após reinícios. Ao migrar para produção, separe migrations do processo web, restrinja permissões de DDL e configure backup/rollback.
- **Não execute** `prisma migrate deploy` sobre um banco antigo do Facilita/TCC ou preparado previamente por `prisma db push` sem backup e procedimento de baseline. A migração inicial presente no repositório pressupõe banco vazio.
- A hospedagem Free do Render hiberna por inatividade e o primeiro acesso pode demorar. Discos locais no Render são efêmeros. MySQL deve permanecer no Aiven, com TLS.
- Em `FRONTEND_URL`, use apenas origens reais HTTPS autorizadas. Para previews da Vercel, adicione explicitamente cada origem confiável; não use `*`.
- A aplicação pode iniciar sem `RESEND_API_KEY` e `RESET_EMAIL_FROM`, mas **recuperação de senha por e-mail não enviará mensagens**. Configure provedor verificado antes de exigir esse fluxo.
- Nunca coloque `JWT_SECRET`, credenciais MySQL ou chaves de e-mail em `VITE_*`, arquivos commitados, logs ou chats.
- Este ambiente é de **homologação**, não de uso público com dados reais.

## Variáveis por plataforma

| Plataforma | Variável | Valor |
| --- | --- | --- |
| Aiven | — | Serviço MySQL Free vazio, com TLS |
| Render | `NODE_ENV` | `production` |
| Render | `DATABASE_URL` | String MySQL **secreta** com TLS |
| Render | `JWT_SECRET` | Segredo aleatório com pelo menos 48 caracteres, informado apenas no Render |
| Render | `FRONTEND_URL` | Origem exata `https://...vercel.app` |
| Render | `DEV_PASSWORD_RESET_LOG` | `false` |
| Vercel | `VITE_API_BASE_URL` | `https://...onrender.com/v1/facilita` |

Após validar o MVP, atualize o processo de migration para execução separada e prepare um plano de produção com backups testados, monitoramento e domínio estável.
