# Sessões autenticadas — versão inicial

- Login emite JWT HS256 com `jti` aleatório e expiração de 1 hora.
- Hash SHA-256 do token é armazenado em `Sessao` com usuário, expiração e flag de revogação.
- Middleware de autenticação exige assinatura válida **e sessão ativa no banco**.
- `POST /v1/facilita/auth/logout` revoga a sessão atual.
- Redefinição de senha revoga as sessões já emitidas do usuário.

## Limitações
- A renovação automática de sessão (refresh token) não está implementada.
- O FrontEnd usa sessionStorage para guardar o token: revisar o risco de XSS e avaliar cookie HttpOnly no domínio de produção.
- Há interface de recuperação, integração Resend e encerramento de todas as sessões. A lista mostra datas, sem identificação de dispositivo/localização.
- O token JWT pode continuar válido criptograficamente após logout, mas não será autorizado pelo banco.
- Não usar em produção antes de validação de migrações, segurança e limites de requisições.

## Novas operações
- `GET /v1/facilita/auth/sessoes`: lista até 50 sessões válidas do usuário, sem retornar tokens ou hashes.
- `POST /v1/facilita/auth/sair-de-todas`: revoga todas as sessões do usuário, inclusive a atual; exige novo login.

- `DELETE /v1/facilita/auth/sessoes/:id`: revoga uma sessão pertencente à conta. Se for a sessão atual, é necessário fazer login novamente.
