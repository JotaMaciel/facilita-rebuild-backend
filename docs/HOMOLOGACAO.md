# Plano de homologação — Facilita Rebuild

## Objetivo e escopo
Validar a reconstrução da API e da interface web em ambientes isolados, antes de liberar dados reais ou publicar um endereço definitivo. Esta documentação não representa uma homologação já realizada.

## Requisitos de ambiente
- BackEnd Node.js 22+, MySQL 8.4 e migração via `npm run db:deploy`.
- FrontEnd compilado com `VITE_API_BASE_URL` apontando para a API HTTPS do ambiente.
- `DATABASE_URL` separado de desenvolvimento e produção; `JWT_SECRET` longo e gerado por gerenciador de segredos.
- `FRONTEND_URL` configurado com o endereço da interface para CORS e links de recuperação.
- Contas de cliente e prestador de teste, sem dados pessoais reais.
- Verificar certificado HTTPS, conectividade privada do banco e backups.
- Configuração de Resend opcional: apenas para testes de entrega com domínio/remetente verificados.

## Roteiro funcional
1. Cadastrar cliente e prestador e conferir que credenciais inválidas retornam 401.
2. Cliente cria serviço; prestador vê o serviço disponível e cliente acompanha a solicitação.
3. Prestador aceita e inicia o serviço; conferir que um segundo prestador não consegue assumir a mesma solicitação.
4. Cliente e prestador trocam mensagens durante o atendimento; uma terceira conta não pode ler ou enviar mensagens.
5. Prestador conclui o serviço; o histórico continua legível e novas mensagens são bloqueadas.
6. Cliente avalia o serviço concluído; duplicar avaliação não deve funcionar.
7. Consultar notificações e marcar uma notificação da própria conta como lida; não permitir acesso de terceiros.
8. Abrir a central de segurança, encerrar uma sessão específica e verificar 401 ao reutilizar seu token.
9. Encerrar todas as sessões, confirmar que as credenciais anteriores não funcionam e realizar novo login.
10. Solicitar recuperação de senha; não revelar se o e-mail existe. Quando e-mail estiver configurado, conferir entrega e expiração do link. Testar token usado duas vezes.
11. Validar visualização e operações em desktop e celular, estados de carregamento, erros e navegação por teclado.

## Critérios para aprovação
- CI verde com testes unitários, integração MySQL, migração e construção Docker.
- Nenhuma violação de controle de acesso nos testes manuais.
- Testes de configuração de domínio, HTTPS e variáveis de ambiente.
- Evidências e incidentes documentados no pull request.
- Sem alterações diretas na `main` até revisão.

## Antes de produção
Incluir monitoramento e alertas, logs sanitizados, retenção de dados, política de backup/restauração, proteção contra abuso distribuído, teste de concorrência e revisão de segurança. Pagamentos e aplicativo mobile continuam fora do escopo atual.
