# Recuperação por e-mail (Resend)

O BackEnd suporta envio de e-mail transacional via HTTPS utilizando a API da Resend, sem adicionar dependência externa ao Node.js.

## Configuração
Defina as variáveis no provedor de hospedagem, nunca no Git:
- `RESEND_API_KEY`: chave da API do serviço.
- `RESET_EMAIL_FROM`: remetente de domínio verificado, por exemplo `Facilita <contato@seu-dominio>`.
- `FRONTEND_URL`: URL HTTPS pública do FrontEnd em produção.

O link enviado inclui `reset_token` e abre a tela de redefinição automaticamente. O FrontEnd remove o token da barra de endereço após consumi-lo da URL.

## Limitações e segurança
- Envio **não foi testado com credenciais reais**. O recurso só fica operacional após validar domínio, remetente e chave da conta no provedor.
- Sem chave configurada, nenhum e-mail é enviado. A resposta ao usuário permanece neutra para evitar enumeração.
- Falhas de envio são registradas sem exibir o token ou o endereço completo da URL.
- Token é único, persistido apenas por hash, vale 15 minutos e é invalidado ao redefinir senha.
- Em homologação, teste também políticas de entrega de e-mail, SPF/DKIM e abuso de solicitações.
- Nunca habilite `DEV_PASSWORD_RESET_LOG` em ambiente compartilhado.
