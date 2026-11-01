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

## Isolamento de sessões entre usuários
O teste de integração com MySQL confirma que um terceiro usuário autenticado não vê a sessão do prestador em `GET /auth/sessoes` nem consegue revogá-la com `DELETE /auth/sessoes/:id` (HTTP 404). Depois da tentativa, o prestador continua autenticado. O controle é realizado pelo BackEnd, usando o identificador do usuário validado na sessão.

## Rejeição de credenciais inválidas
Os testes unitários exercitam as rotas privadas `/auth/me`, `/auth/sessoes`, `/servicos` e `/notificacoes` com cabeçalho `Authorization` ausente, incompleto, com esquema diferente de Bearer e tokens malformados. Todas devem devolver HTTP 401 com `UNAUTHORIZED` e identificador `X-Request-ID`, sem permitir acesso aos dados.

## Validação de entradas
Os testes HTTP também verificam que o cadastro recusa e-mail, senha, nome ou papel inválidos, e que a criação de serviços recusa categorias e descrições fora dos limites definidos. As respostas utilizam HTTP 400 e `VALIDATION_ERROR`, com detalhes dos campos inválidos. A validação é feita no BackEnd antes de persistir os dados.

Os testes também verificam que requisições de criação de serviços rejeitadas por validação não alteram a quantidade de serviços no repositório simulado. Assim, não basta retornar `400`: a operação deve ser livre de efeitos colaterais de criação.

O teste de integração com MySQL também consulta a quantidade de serviços pertencentes ao cliente antes e depois de três tentativas inválidas (descrição curta, descrição excessiva e categoria acima do limite). As respostas devem ser `400 VALIDATION_ERROR` e nenhum registro novo pode ser persistido.

## Transições de estado no MySQL
A integração HTTP com MySQL verifica que um serviço `PENDENTE` não pode ser concluído diretamente, que a transição `iniciar` não pode ser repetida após `EM_ANDAMENTO` e que `concluir` não pode ser executado novamente após `CONCLUIDO`. Cada tentativa inválida deve responder `409`, preservando o estado armazenado no banco.

Os testes também confirmam que o cliente não consegue concluir um serviço iniciado pelo prestador atribuído e que um serviço já concluído não pode ser cancelado. A conclusão tentada pelo cliente retorna `403` por falta de permissão, enquanto o cancelamento após conclusão retorna `409` por conflito de estado. O status e o `prestadorId` permanecem inalterados no MySQL.

O teste de integração também confere a quantidade de notificações antes e depois de repetir a conclusão de um serviço. A repetição rejeitada com `409` não pode gerar novas notificações para o cliente, evitando efeitos colaterais duplicados.

## Aceite concorrente
O teste de integração cria dois prestadores distintos que tentam aceitar o mesmo serviço simultaneamente via `Promise.all`. O resultado esperado é um aceite HTTP 200 e um conflito HTTP 409. O MySQL deve persistir apenas um prestador atribuído e gerar somente uma notificação de aceite para o cliente. Ao final, o cenário de teste é restaurado para continuar o ciclo de atendimento.

O cenário de concorrência também repete a tentativa de aceite usando a conta do prestador que perdeu a disputa. O BackEnd deve retornar novamente `409` e preservar tanto o status `ACEITO` quanto o `prestadorId` registrado no MySQL.

A tentativa adicional do prestador perdedor também é acompanhada de uma contagem de notificações antes e depois do conflito. A quantidade deve permanecer inalterada, evitando notificações redundantes após `409`.
