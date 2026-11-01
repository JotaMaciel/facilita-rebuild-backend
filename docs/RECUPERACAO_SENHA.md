# Recuperação de senha — implementação inicial

## Fluxo
1. `POST /v1/facilita/auth/recuperar-senha` recebe e-mail e retorna resposta neutra, mesmo para contas inexistentes.
2. Para uma conta cadastrada, cria um token criptograficamente aleatório de uso único, guarda apenas SHA-256 e define validade de 15 minutos.
3. `POST /v1/facilita/auth/redefinir-senha` recebe `{ "token": "...", "senha": "..." }`; verifica expiração e consumo e atualiza o hash da senha.

## Restrições
**O envio de e-mail ainda não existe.** Não há recuperação de senha utilizável em produção. Para testes locais isolados, `DEV_PASSWORD_RESET_LOG=true` pode escrever o token em logs. Nunca ligar essa opção em servidores compartilhados nem publicar logs que contenham tokens.

A troca de senha ainda **não revoga JWTs emitidos anteriormente**. É necessário implementar armazenamento e revogação de sessões efetivos antes de produção. O modelo Prisma `Sessao` ainda não está conectado ao middleware de autenticação.

Também faltam limpeza de tokens expirados, controle de repetição por conta, remetente de e-mail verificado, filas e observabilidade.

## Segurança
Não devolver o token de recuperação em respostas da API. Não usar links de produção com URLs previsíveis. Usar HTTPS e restringir as operações ao ambiente controlado até completar o fluxo.

## Interface web
A interface permite solicitar redefinição e informar token no ambiente de desenvolvimento. **Ainda não existe entrega por e-mail**: o usuário não receberá instruções sem uma integração de e-mail configurada. Não divulgar esta funcionalidade como operacional em produção.

## Testes de revogação após recuperação
Após redefinir a senha, o teste de integração com MySQL tenta consultar sessões, serviços e notificações usando o token anterior e também tenta criar um serviço. Todas as operações devem retornar HTTP 401. O login com senha antiga permanece bloqueado; somente a nova senha permite abrir uma nova sessão.

## Token expirado
O teste de integração cria um token de recuperação já vencido. A tentativa de redefinição deve retornar HTTP 400, sem alterar a senha antiga nem revogar uma sessão ainda válida. Em seguida, o teste confirma que a autenticação com a senha original continua funcionando.

## Reutilização do token
Além de rejeitar a segunda tentativa com HTTP 400, o teste MySQL agora verifica que a senha definida no primeiro uso permanece válida e que a senha enviada na tentativa de reutilização não é aceita no login.

## Limite de autenticação nos testes
O teste de integração configura `authRateLimit: 100` ao construir a aplicação, pois o cenário realiza várias autenticações em sequência no mesmo IP de teste. A aplicação em uso normal mantém o limite padrão de 20 tentativas por 15 minutos. Isso preserva o teste de recuperação de senha sem enfraquecer o limite padrão de segurança.
