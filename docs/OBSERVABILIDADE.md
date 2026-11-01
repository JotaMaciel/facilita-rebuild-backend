# Observabilidade da API

Cada requisição recebe um UUID gerado pelo servidor. A resposta expõe o cabeçalho `X-Request-ID`, incluindo respostas de erro (401 e 404).

Em exceções internas, o log inclui `requestId`, método HTTP, caminho e mensagem de erro. Isso permite relacionar o erro reportado pelo cliente com a requisição do servidor. O identificador é sempre gerado pelo servidor e não é aceito de um cabeçalho fornecido pelo cliente.

Exemplo de diagnóstico:

```bash
curl -i http://localhost:3000/v1/facilita/live
```

Procure o cabeçalho `X-Request-ID` na resposta. Em atendimento, encaminhe esse identificador junto com a hora aproximada do erro. Não compartilhe o cabeçalho `Authorization`, tokens de recuperação ou senhas em relatórios.

Os testes automatizados verificam o formato UUID v4, a unicidade por requisição e a presença em respostas de sucesso, autenticação negada e rota inexistente.

## Erros internos
Respostas HTTP 500 usam o formato `{ "error": "INTERNAL_ERROR", "requestId": "<uuid>" }`. O `requestId` corresponde ao cabeçalho `X-Request-ID`. Detalhes de exceções e mensagens do banco permanecem apenas nos logs do servidor e não são incluídos na resposta pública. O tratamento respeita respostas que já tenham enviado cabeçalhos.

## Erros de entrada
Corpos JSON inválidos retornam HTTP `400` com `error: INVALID_JSON`, e corpos maiores que o limite configurado de 100 KB retornam HTTP `413` com `error: PAYLOAD_TOO_LARGE`. Ambas as respostas incluem `requestId`, correspondente ao cabeçalho `X-Request-ID`, sem reproduzir os dados recebidos. Erros inesperados continuam sendo retornados como HTTP `500` e `INTERNAL_ERROR`.

## Liveness e readiness
O endpoint `/v1/facilita/live` não depende do MySQL e responde mesmo quando o banco está indisponível. Já `/v1/facilita/health` testa a conexão com o banco e devolve erro 500 com `requestId`, sem revelar detalhes internos da configuração. Um teste unitário confirma esses comportamentos e verifica que a liveness continua funcional após a falha de readiness.

## Recuperação da disponibilidade
O teste unitário também simula o retorno da conexão ao MySQL na mesma instância da API. Primeiro `/health` retorna 500 durante a falha; após restabelecer a conexão simulada, responde 200 com `{ "status": "ok", "database": "connected" }`, sem reiniciar o servidor. Cada requisição recebe um `X-Request-ID` diferente.
