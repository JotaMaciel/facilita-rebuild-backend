# Revisão de autorização e abuso — outubro de 2026

## Controles reforçados
- Criação de solicitações restrita ao papel cliente.
- Aceite restrito ao prestador, com atualização condicional de estado.
- Mensagens acessíveis somente ao cliente solicitante e ao prestador atribuído.
- Mensagens de serviços pendentes ou cancelados não ficam acessíveis.
- Após conclusão, histórico continua consultável pelos participantes, mas novas mensagens não são permitidas.
- Envio de mensagens limitado a 30 requisições por minuto, por IP, em uma instância.
- Gestão de sessões vinculada ao usuário autenticado.

## Pendências e riscos
- O limitador por IP em memória não é distribuído entre instâncias. Usar armazenamento compartilhado e configuração de proxy revisada antes de escalar.
- Falta política de retenção de mensagens, expiração de dados e proteção antifraude.
- Sem mecanismos de denúncia ou bloqueio de usuários.
- Avaliação de autorização deve ser complementada por revisão independente de segurança.
- Os serviços disponíveis mostram solicitações a todos os prestadores autenticados; região, privacidade e critérios de correspondência ainda não são implementados.

Estas verificações são automáticas e não substituem testes de penetração.

## Testes negativos de acesso cruzado
O teste HTTP com MySQL utiliza um terceiro usuário autenticado que não participa do serviço. Confirma que ele não consegue ler ou enviar mensagens da conversa, cancelar a solicitação, avaliá-la ou marcar como lida uma notificação do cliente. Também verifica que a notificação permanece não lida após a tentativa. As operações de cancelamento e avaliação usam HTTP 409 quando não são elegíveis; mensagens e notificações retornam 403/404 conforme a rota. Esses testes complementam, mas não substituem, a revisão de autorização da API.
