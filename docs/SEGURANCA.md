# Segurança e limites da versão Rebuild

## Implementado
- Senhas protegidas com `scrypt` e salt aleatório.
- JWT HS256 com emissor, audiência, emissão e expiração de 1 hora.
- Rate limit para cadastro e login.
- Proteção de serviços por identidade, tipo de conta e estado.
- Limite de tamanho JSON e validação de dados via Zod.
- Listagem de serviços próprios paginada em blocos de 20 (`?page=1`).
- Mensagens limitadas a participantes de atendimentos aceitos.

## Pendente antes de produção
- Refresh tokens e revogação de sessão.
- Troca e recuperação segura de senha com e-mail configurado.
- Testes dedicados contra enumeração e abuso de recursos.
- Estratégia de auditoria de operações sensíveis e proteção contra replay.
- Cookies HttpOnly ou outra política de armazenamento de tokens adequada ao domínio final.
- Chaves de produção no provedor de segredos; nunca no frontend ou código.
- Migrações SQL versionadas e ambiente de staging.
- Auditoria do chat, retenção de dados e política de privacidade.

Os testes executados pelo CI não substituem revisão de segurança nem testes end-to-end em ambiente implantado.
