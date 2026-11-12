# Operação e observabilidade — Facilita Rebuild

## Endpoints de saúde
- `GET /v1/facilita/live` retorna HTTP 200 e `{"status":"alive"}` sem consultar o banco. Indicado como *liveness probe*, para confirmar que o processo HTTP responde.
- `GET /v1/facilita/health` consulta MySQL (`SELECT 1`) e retorna HTTP 200 com `{"status":"ok","database":"connected"}` se conectado. Indicado como *readiness check*.

Use `/live` para identificar processos travados e `/health` para retirar uma instância sem acesso ao banco do balanceador. Configurar tempos de inicialização e intervalos no provedor de hospedagem. Nunca adicionar dados pessoais ou credenciais a essas respostas.

## Pré-requisitos de homologação
1. Node 22, MySQL 8.4, HTTPS e banco isolado.
2. Definir `DATABASE_URL`, `JWT_SECRET` e `FRONTEND_URL` no provedor de segredos.
3. Executar `npm run db:deploy` no banco de homologação e depois `npm run db:status`.
4. Testar ambos os endpoints e a rota autenticada `/auth/me` com conta sintética.
5. Confirmar logs de erros sem senha ou token, registro de falhas de e-mail e capacidade de restaurar backup.
6. Confirmar que configurações `DEV_PASSWORD_RESET_LOG` estão desabilitadas.

## Limitações atuais
Não há métricas Prometheus/OpenTelemetry, tracing, logs estruturados com correlation ID nem alarmes de indisponibilidade. É necessário configurar isso antes da operação pública. O check de banco apenas valida conectividade, não qualidade dos dados ou capacidade transacional.
