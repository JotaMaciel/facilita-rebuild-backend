# API Facilita Rebuild — Contrato inicial

Base: `/v1/facilita`; autenticação: `Authorization: Bearer <token>`.

| Método | Caminho | Acesso |
|---|---|---|
| GET | /health | Público |
| POST | /auth/registro | Público |
| POST | /auth/login | Público |
| GET | /auth/me | Autenticado |
| GET | /servicos | Solicitante (próprios serviços) |
| POST | /servicos | Autenticado |
| GET | /servicos/disponiveis | Prestador |
| GET | /servicos/atribuidos | Prestador |
| PATCH | /servicos/:id/aceitar | Prestador |
| PATCH | /servicos/:id/iniciar | Prestador atribuído |
| PATCH | /servicos/:id/concluir | Prestador atribuído |
| PATCH | /servicos/:id/cancelar | Solicitante enquanto pendente |
| POST | /servicos/:id/avaliacao | Solicitante após conclusão |
| GET | /servicos/:id/mensagens | Participante de serviço aceito |
| POST | /servicos/:id/mensagens | Participante de serviço aceito |
| GET | /notificacoes | Autenticado |
| PATCH | /notificacoes/:id/lida | Dono da notificação |

A persistência das mensagens usa HTTP, **não WebSocket em tempo real**. O FrontEnd carrega mensagens sob demanda. A implementação atual das notificações envia um evento ao aceitar o serviço; os demais tipos serão adicionados depois.

## Limitações
Protótipo sujeito a validação de segurança e autorização ampliada; sem integração com pagamentos reais, implantação pública ou paridade total com o Facilita original. Não publicar antes de concluir análise de segurança, migrações versionadas, observabilidade e testes.
