# Checklist de configuração de produção

A inicialização em `NODE_ENV=production` exige:
- `JWT_SECRET`: pelo menos 48 caracteres, sem marcadores óbvios de desenvolvimento.
- `DATABASE_URL`: URL com prefixo `mysql://`.
- `FRONTEND_URL`: uma ou mais **origens HTTPS** separadas por vírgula, sem caminho, parâmetros ou credenciais.
- `DEV_PASSWORD_RESET_LOG` diferente de `true`.

As verificações são executadas antes de abrir a porta HTTP. Testes em `test/config.test.js` cobrem cenários válidos e inválidos.

**Atenção:** a validação de `DATABASE_URL` confere o formato básico, não garante que a base seja isolada, privada ou que o transporte MySQL esteja criptografado. Confirme TLS, permissões mínimas, backup, restauração e acesso de rede no provedor.

Para validar a implantação, execute `npm run db:deploy` em uma base nova de homologação e teste `/v1/facilita/live`, `/v1/facilita/health` e autenticação. Não execute migrações com dados reais sem backup e comparação do esquema.
