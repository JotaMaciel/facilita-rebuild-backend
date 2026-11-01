# Observabilidade da API

Cada requisição recebe um UUID gerado pelo servidor. A resposta expõe o cabeçalho `X-Request-ID`, incluindo respostas de erro (401 e 404).

Em exceções internas, o log inclui `requestId`, método HTTP, caminho e mensagem de erro. Isso permite relacionar o erro reportado pelo cliente com a requisição do servidor. O identificador é sempre gerado pelo servidor e não é aceito de um cabeçalho fornecido pelo cliente.

Exemplo de diagnóstico:

```bash
curl -i http://localhost:3000/v1/facilita/live
```

Procure o cabeçalho `X-Request-ID` na resposta. Em atendimento, encaminhe esse identificador junto com a hora aproximada do erro. Não compartilhe o cabeçalho `Authorization`, tokens de recuperação ou senhas em relatórios.

Os testes automatizados verificam o formato UUID v4, a unicidade por requisição e a presença em respostas de sucesso, autenticação negada e rota inexistente.
