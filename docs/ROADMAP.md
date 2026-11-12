> Documento histórico. Para o estado atual, consulte `EXECUCAO_LOCAL.md`, `ESTABILIZACAO.md` e `DEPLOY_HOMOLOGACAO.md`.

# Roadmap BackEnd — Facilita Rebuild

## Fase 1 — Reprodução
- [ ] Verificar permissão/licença de reutilização do código original
- [ ] Importar e creditar o código existente
- [ ] Mapear variáveis de ambiente e dependências externas
- [ ] Reproduzir execução local Node.js 22 + MySQL
- [ ] Corrigir configuração de CORS, erros e healthcheck
- [ ] Verificar integração com o FrontEnd

## Fase 2 — Qualidade
- [ ] Testes automatizados para autenticação, usuários e serviços
- [ ] Validação de requisições com schemas
- [ ] Padronização de respostas HTTP e tratamento centralizado de erros
- [ ] OpenAPI e exemplos de requisições
- [ ] CI para lint, testes e build

## Fase 3 — Evolução de arquitetura
- [ ] Avaliar migração incremental de JavaScript para TypeScript
- [ ] Separar controllers, services, repositories e infraestrutura
- [ ] Observabilidade com logs estruturados
- [ ] Transações e idempotência em fluxos de pagamento
- [ ] Testes de integração, WebSocket e pagamentos sandbox

As caixas representam trabalho planejado, não funcionalidades já implementadas.
