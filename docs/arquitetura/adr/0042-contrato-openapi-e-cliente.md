# ADR 0042 · Contrato OpenAPI, tipos gerados no app, cliente HTTP e cache persistido

**Status:** aceito (10/11/2026) para a Parte 1 (contrato e portões). A Parte 2 (cliente, TanStack Query, cache persistido) acrescenta a sua seção aqui. **Tarefa:** E4.2. Plano: [`E4.2.md`](../../estado/tarefas/E4.2.md). Fecha o "sem OpenAPI nesta tarefa" do [ADR 0036](0036-verificacao-do-token-e-usuario.md) (D7) e usa os `Results<...>` tipados do [ADR 0039](0039-sacou-http-e-contratos-entre-modulos.md) (D1).

## Contexto

O aceite da E4.2 é "tipos sempre iguais aos da API". O app em TypeScript e a API em C# precisam de uma fonte única do contrato, verificada pela CI, sem ninguém copiar tipo à mão.

## Decisões (Parte 1)

**D1 · A API descreve o contrato.** `Microsoft.AspNetCore.OpenApi` `[10.0.14]` (o pacote da plataforma, que lê os `Results<...>`), com o `Microsoft.OpenApi` `[2.12.2]` referenciado direto e exato, para o `audit:api` ver sempre a mesma versão. Só `Sacou.Api` os referencia; os módulos ganham apenas `.ProducesProblem(...)`. Documento OpenAPI 3.1, `v1`. Transformadores em `apps/api/src/Sacou.Api/OpenApi/`:

- `EnumAsTextSchemaTransformer`: o gerador deixava `GroupRole` e `MemberType` com esquema vazio (não entende o `SingleValueEnumConverter`). Escreve `type: string` e os valores **serializados com as mesmas opções JSON das respostas**.
- `NumberAsNumberSchemaTransformer` (**acréscimo ao plano**): os padrões web do `System.Text.Json` também leem número escrito como texto, e o gerador descrevia todo `int` como `integer | string` com `pattern`. A API sempre escreve número e o app sempre manda número: o contrato diz `integer`, e o TS fica `number`.
- `RuleProblemOperationTransformer` + `ProblemSchemaDocumentTransformer`: todo status declarado com `ProducesProblem` (403, 404, 409 e o 400 de regra) aponta para **`ApiProblem`** (`type`, `title`, `status`, `code` obrigatório, `traceId`).
- `CommonResponsesOperationTransformer`: 401 e 503 (com `Retry-After`) em toda rota com login; 400 em toda rota com corpo; 413 em toda rota com `RequestSizeLimit`. Esses saem do pipeline, sem `code`, e usam **`ProblemDetails`** (o mesmo formato, `code` opcional). **Desvio do plano:** o 400 de rota com corpo junta o erro de binding (sem `code`) e o de regra (com `code`), então nessas rotas ele é `ProblemDetails`; o app lê o `code` quando vier.
- `ErrorCodeCatalogDocumentTransformer`: `x-sacou-error-codes` na raiz, com os `code` de todo campo `static readonly Error` das classes `*Errors` dos 7 módulos, em ordem. A convenção do sufixo `Errors` deixa de fora erro privado que nunca chega ao HTTP (como o `invalid-rating` da cartinha).
- `PublicSurfaceDocumentTransformer`: sem `servers` (o gerador punha a URL da máquina), título fixo e sem `tags`.

**D2 · Só em `Development`.** `MapOpenApi("/openapi/{documentName}.json").AllowAnonymous()` só quando `IsDevelopment()`. Em qualquer outro ambiente a rota não existe (401 da `FallbackPolicy`). O app não baixa o documento: os tipos são compilados. A lista fechada de rotas fora do filtro de grupo (ADR 0040) aceita essa rota só em `Development`. Caminho usado: o `MapOpenApi` servido pelo `WebApplicationFactory` (o mesmo que os testes HTTP usam), e não o `IOpenApiDocumentProvider`, para o teste também provar a exposição.

**D3 · A corrente do aceite.** Cada elo reprova a CI:

1. `apps/api/openapi/v1.json` versionado, que ninguém edita. `OpenApiContractTests.Document_matches_committed_file` compara o documento servido (JSON normalizado, LF) com o arquivo; com `SACOU_UPDATE_OPENAPI=1` reescreve.
2. `scripts/generate-api-types.mjs` (`openapi-typescript` `7.13.0`, exato, nas `devDependencies` do app) gera `apps/mobile/src/api/generated/{schema.ts,error-codes.ts,contract-hash.ts}`, formatados pelo Prettier. `pnpm check:api-types` (com `--check`, compara em memória, sem `git diff`) falha se algum estiver diferente ou faltando.
3. `pnpm typecheck`: o app só usa os tipos gerados (Parte 2). `openapi-fetch` `0.17.0` (exato) já entra como dependência para a Parte 2.
4. `apps/mobile/src/strings/api-errors.pt-BR.ts` é `Record<ApiErrorCode, string>`: código novo sem texto, ou texto de código removido, não compila.

Atalho local: `pnpm api:contract` (teste em modo de escrita + gerador). `pnpm api:types` só regenera o TS.

**D4 · Compatibilidade do `/v1`.** `pnpm check:api-compat` compara o `v1.json` do PR com o da `origin/main` (o `verify` da CI passa a buscar o histórico inteiro) e reprova: rota ou método removido; campo de requisição removido; campo de requisição que virou obrigatório; campo novo obrigatório na requisição; campo removido de resposta 2xx (também dentro de listas); resposta 2xx removida; valor de enum removido (em requisição ou resposta: o app instalado manda e lê esses valores). Campo novo opcional, rota nova e valor novo de enum passam. Corpo de erro fica fora (é `ApiProblem` em todo lugar). Exceção: `BREAKING-V1` no corpo do PR, lido do evento da CI, com ADR. Editar o corpo depois exige rodar a CI de novo.

**Guardas** (`Sacou.Api.Tests/OpenApi`): as 15 operações, em lista literal, com `operationId`; enums iguais à serialização e à lista literal; erros de regra em `ApiProblem` com `code` obrigatório; 401/503 com `Retry-After` em toda operação; 400 com corpo e 413 com limite; catálogo de códigos contado por reflexão independente; cada DTO serializado tem exatamente as propriedades do esquema; esquemas de requisição com `additionalProperties: false`; documento sem `servers`, nome de máquina, caminho de disco nem `ProjectId`; `Production` e `Staging` não servem o documento. `ProblemContractGuard`: endpoint que devolve `ProblemHttpResult`, ou rota com `{groupId}` (o filtro de grupo responde 403/404), sem nenhum `ProducesProblem` reprova, com casos plantados. **Desvio do plano:** o caso plantado fica em `Sacou.Api.Tests` (app mínimo, como o `GroupRouteGuardTests`), não em `Sacou.Architecture.Fixtures`; e a "ida e volta" (C9) serializa cada DTO com as opções da API em vez de reusar respostas dos testes de integração, para rodar sem Postgres.

## Alternativas descartadas

- **Swashbuckle ou NSwag:** dependência de terceiros para o que a plataforma faz e lê dos `Results<...>`.
- **Documento publicado em produção:** facilita varredura e ninguém de fora precisa dele.
- **Escrever os tipos do app à mão:** é o que o aceite proíbe.
- **`git diff --exit-code` no `check:api-types`:** não pega arquivo novo não versionado e depende do estado do índice; a comparação em memória faz as duas coisas.

## Consequências

- Mudou um DTO, um enum ou uma rota: `pnpm api:contract` e commit dos dois lados, ou a CI fica vermelha.
- `.ProducesProblem(...)` à mão por endpoint: um status esquecido não aparece no contrato (a guarda só pega a ausência total). O app trata qualquer `code` conhecido, de qualquer status.
- `src/api/generated/**` fica fora do ESLint e do `check:duplication`, e dentro do `format:check`. `apps/api/openapi/v1.json` fica sob o `.prettierignore` de `apps/api/` (o teste já o normaliza).
