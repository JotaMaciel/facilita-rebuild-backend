# Facilita Rebuild — BackEnd

**Responsável pela versão Rebuild:** João Pedro de França Maciel ([@JotaMaciel](https://github.com/JotaMaciel)).

Este repositório foi criado para a reconstrução e evolução técnica do BackEnd do Facilita, com foco em boas práticas de engenharia de software e portfólio profissional.

> **Estado atual:** API Rebuild executável em Node.js 22 com Express 5, Prisma e MySQL. Implementação independente, ainda sem paridade completa com o sistema original e sem publicação em produção.

## Objetivos técnicos
- API REST com Node.js e TypeScript, separação de responsabilidades e validação de dados.
- Persistência MySQL com Prisma e migrações versionadas.
- Autenticação e autorização por papéis com políticas verificáveis.
- Tratamento de erros, logs estruturados, rate limiting e CORS configurável.
- Testes unitários, de integração e documentação OpenAPI.
- Ambiente local reproduzível com Docker Compose, sem credenciais reais.
- Integração segura com pagamentos em modo sandbox, WebSocket e FrontEnd.

## Origem e créditos
O projeto Facilita foi desenvolvido originalmente em equipe. A implementação usada como referência e futura base de migração pertence ao repositório [gioxavier7/servidor-facilita](https://github.com/gioxavier7/servidor-facilita), cuja documentação atribui o BackEnd original a **Giovanna Soares Xavier**. Esta nova versão terá manutenção e contribuições de João Pedro de França Maciel, sem apagar a autoria do trabalho preexistente.

## Etapas
1. Auditar licenças, dependências, estrutura, segredos e integrações.
2. Migrar o código de modo rastreável, sem publicar tokens ou dados reais.
3. Estabilizar a execução local e os testes de endpoints existentes.
4. Refatorar incrementalmente com testes de regressão.
5. Conectar ao [Facilita Rebuild FrontEnd](https://github.com/JotaMaciel/facilita-rebuild-frontend).

## Constatações iniciais
- O `package.json` da origem exige **Node.js >=22**, embora o README informe 16+.
- A aplicação original lê `.env.development` fora da produção.
- A rota de healthcheck aparece comentada em `app.js`.
- CORS contém origens fixas e uma variável `FRONTEND_URL`.
- O comentário de `app.js` declara rate limiting desativado para testes.

Esses itens serão revisados antes de considerar o sistema pronto para produção.

## Segurança
Não registre chaves PagBank, tokens JWT, senhas, URLs com credenciais ou dados pessoais. Integrações financeiras serão validadas apenas em ambiente de testes.

## Estado de validação
O GitHub Actions executa testes unitários, testes de integração com MySQL 8.4, migrações Prisma e build/smoke test do contêiner. Consulte os resultados do commit mais recente na aba Actions.

## Implementação desta branch

Esta branch inclui API Express 5, modelos Prisma/MySQL, registro e login JWT, serviços com escopo por usuário, criação, consulta e cancelamento de solicitações pendentes e testes automatizados com mocks. **Ainda não é paridade com o sistema original**.

Instruções de instalação e limitações: [Execução local](docs/EXECUCAO_LOCAL.md).

Requisitos para validar: Node.js >=22, npm e Docker Compose. Testes unitários e de integração com MySQL são executados pelo GitHub Actions; para reproduzir localmente, siga o guia de execução.

### Paginação de serviços
`GET /v1/facilita/servicos?page=1` retorna os serviços do usuário autenticado, com até 20 itens por página e os campos `data`, `page`, `pageSize` (20) e `hasNextPage` (booleano). O campo `hasNextPage` é calculado consultando um item adicional, sem exigir contagem total. O FrontEnd pode apresentar **Carregar mais** enquanto `hasNextPage` for `true`.
