# ADR 0042 · Contrato OpenAPI, tipos gerados no app, cliente HTTP e cache persistido

**Status:** aceito (10/11/2026): Parte 1 (contrato e portões) e Parte 2 (cliente, TanStack Query, cache persistido). **Tarefa:** E4.2. Plano: [`E4.2.md`](../../estado/tarefas/E4.2.md). Fecha o "sem OpenAPI nesta tarefa" do [ADR 0036](0036-verificacao-do-token-e-usuario.md) (D7) e usa os `Results<...>` tipados do [ADR 0039](0039-sacou-http-e-contratos-entre-modulos.md) (D1).

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

**D4 · Compatibilidade do `/v1`.** `pnpm check:api-compat` compara o `v1.json` do PR com o da `origin/main` (a CI busca só a ponta da `main` com `git fetch --depth=1`; ref ausente reprova, e só um ref sem o arquivo passa sem comparar) e reprova: rota ou método removido; parâmetro novo obrigatório ou que virou obrigatório; `requestBody.required` novo; tipo que mudou (na resposta, o da head contido no da base; na requisição, o contrário, com `integer` dentro de `number`); campo de resposta que virou anulável e campo de requisição que deixou de aceitar `null`; campo de resposta que deixou de ser obrigatório; campo de requisição removido; campo de requisição que virou obrigatório; campo novo obrigatório na requisição; campo removido de resposta 2xx (também dentro de listas); resposta 2xx removida; valor de enum removido (em requisição ou resposta: o app instalado manda e lê esses valores). Campo novo opcional, rota nova e valor novo de enum passam. Corpo de erro fica fora (é `ApiProblem` em todo lugar). Exceção: `BREAKING-V1` no corpo do PR, lido do evento da CI, com ADR. Editar o corpo depois exige rodar a CI de novo.

**Guardas** (`Sacou.Api.Tests/OpenApi`): as 15 operações, em lista literal, com `operationId`; enums iguais à serialização e à lista literal; erros de regra em `ApiProblem` com `code` obrigatório; 401/503 com `Retry-After` em toda operação; 400 com corpo e 413 com limite; catálogo de códigos contado por reflexão independente; cada DTO serializado tem exatamente as propriedades do esquema; esquemas de requisição com `additionalProperties: false`; documento sem `servers`, nome de máquina, caminho de disco nem `ProjectId`; `Production` e `Staging` não servem o documento. `ProblemContractGuard`: endpoint que devolve `ProblemHttpResult`, ou rota com `{groupId}` (o filtro de grupo responde 403/404), sem nenhum `ProducesProblem` reprova, com casos plantados. **Desvio do plano:** o caso plantado fica em `Sacou.Api.Tests` (app mínimo, como o `GroupRouteGuardTests`), não em `Sacou.Architecture.Fixtures`; e a "ida e volta" (C9) serializa cada DTO com as opções da API em vez de reusar respostas dos testes de integração, para rodar sem Postgres.

## Decisões (Parte 2)

**D5 · Portas e adaptadores** (`frontend.md`, regra 3). Interfaces em `apps/mobile/src/services/api/` e `src/services/query/`; implementações em `src/adapters/`, cada uma com o seu falso.

| Porta | Real | Falsa |
|---|---|---|
| `SacouApi` (15 métodos, tipos de `components["schemas"]`, `Promise<ApiResult<T>>`) | `http-sacou-api.ts` sobre `openapi-fetch` | `fake-sacou-api.ts` (respostas programáveis, registro das chamadas) |
| `IdTokenProvider` | E4.3 (Firebase) | `fake-id-token-provider.ts`: token fixo só com `__DEV__`; no release, `null`, e o app não chama a API |
| `HttpTransport` | `fetch-http-transport.ts` (o único `fetch` do app) | `fake-http-transport.ts` (fila de respostas) |
| `NetworkStatus` | `netinfo-network-status.ts` (`@react-native-community/netinfo` `12.0.1`, a do `bundledNativeModules` do SDK 58) | `fake-network-status.ts` (interruptor) |
| `KeyValueStore` | `sqlite-key-value-store.ts` + `expo-cache-store.ts` (`sacou-cache.db`) | `memory-key-value-store.ts` |

O ESLint passa a reprovar o global `fetch` e o import `openapi-fetch` fora de `src/adapters/` (o NetInfo já caía na regra de `@react-native-community/`), com casos no `lint:regression`.

**D6 · Erros e repetições.** `ApiError` é uma união (`problem`, `session-expired`, `not-registered`, `too-large`, `unavailable`, `offline`, `unexpected`) sem corpo, cabeçalho nem URL; o texto vem de `strings/api-errors.pt-BR.ts` pelo `code`. `api-policy.ts` é pura: classifica a resposta, lê o `Retry-After` (segundos ou data HTTP, teto de 60 s, 30 s sem cabeçalho) e decide a única repetição de cada tipo: depois de um 401, uma renovação forçada do token (compartilhada entre chamadas simultâneas) e uma nova tentativa; depois de um 403 `identity.user-not-registered`, `POST /v1/me` e uma nova tentativa. As duas valem também para mutação, porque saem antes de qualquer handler. O segundo 401 chama `onSessionExpired()`. Tempo limite de 15 s, que vira `offline`. Só `ApiFailure` (uma `Error` com o `ApiError`) é lançada, e só em `unwrap`, no `queryFn` e no `mutationFn`.

**D7 · TanStack Query** (`@tanstack/react-query`, `-persist-client` e `query-async-storage-persister`, `5.107.1`, exatos). Consultas: até 2 retentativas, só em `offline`, `unavailable` e 5xx, com o `Retry-After` do 503 como espera; `gcTime` de 7 dias; `refetchOnReconnect`; foco pelo `AppState` e rede pelo `NetworkStatus`. Mutações: `retry: false`, `networkMode: "always"` (sem fila offline: a única é a da quadra) e `gcTime: 0` (o token do convite sai da memória quando a tela solta a mutação). Chaves em `query-keys.ts`; invalidação pura em `invalidation.ts`; 404 `groups.group-not-found` remove `["groups", id]` e invalida `["groups"]`.

**D8 · Cache persistido.** `sacou-cache.db`, separado do `sacou.db` da quadra (ADR 0038), tabela `kv (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT`, com `user_version` próprio: versão desconhecida recomeça vazia (o cache se refaz pela API). Entram só `["groups"]`, `["groups", id]` e `["groups", id, "members"]` com `status: "success"`; validade de 7 dias (`PERSISTED_CACHE_MAX_AGE_MS`, pergunta 20, opção 1); `buster` = versão do app + `apiContractHash`. `clearSession()` limpa o `QueryClient` e o arquivo; a gravação com o cache vazio vira remoção da linha, para a gravação atrasada do persistidor não deixar nada depois do logout. Sem criptografia (justificativa no modelo de ameaças, seção 12). A faixa "Sem conexão · atualizado há X" é derivada de `dataUpdatedAt` e da rede (`offlineBannerText`), desenhada nas telas das E4.4 e E4.5.

**D9 · URL da API.** `EXPO_PUBLIC_API_URL`, validada por `parseApiBaseUrl`: `https:` sempre; `http:` só em `__DEV__` e só para a rede local. Sem a variável, o build não tem API e o cliente não envia nada (o APK de teste até o primeiro deploy); com valor errado, o app para no início com mensagem que cita a variável, nunca o valor.

**Desvios do plano (Parte 2).** (1) O contrato não declarava o `{groupId}` do prefixo `MapGroup` (quem o lê é o filtro de acesso, não o handler), e o cliente tipado não conseguia preenchê-lo: `RouteParameterOperationTransformer` declara todo segmento da rota como parâmetro de caminho obrigatório (`guid` vira `uuid`), com teste; o `check:api-compat` passa a aceitar a declaração de um segmento que já estava no caminho. (2) Consulta com erro (mesmo `offline`) deixa de ser gravada até voltar a dar certo; com o `networkMode` padrão, consulta sem rede fica pausada e não erra, então isso só acontece quando o NetInfo diz que há rede e não há. (3) Os hooks são finos sobre `queryOptions` (`group-queries.ts`), testados sem React, porque o app ainda não tem biblioteca de teste de componente. (4) Erro de corpo que não é JSON numa resposta 2xx vira `unexpected` com `status: 0`.

**APK novo:** o NetInfo é módulo nativo. O build de teste anterior não o tem; o roteiro da E4.3 inclui "modo avião abre a lista de grupos do cache".

## Alternativas descartadas

- **Swashbuckle ou NSwag:** dependência de terceiros para o que a plataforma faz e lê dos `Results<...>`.
- **Documento publicado em produção:** facilita varredura e ninguém de fora precisa dele.
- **Escrever os tipos do app à mão:** é o que o aceite proíbe.
- **AsyncStorage ou MMKV para o cache:** dependência nativa nova sem ganho; o `expo-sqlite` já está no app.
- **Fila offline de mutações:** um `createGroup` pausado e perdido, ou rodado horas depois, é pior que a mensagem "Sem conexão".
- **`git diff --exit-code` no `check:api-types`:** não pega arquivo novo não versionado e depende do estado do índice; a comparação em memória faz as duas coisas.

## Consequências

- Mudou um DTO, um enum ou uma rota: `pnpm api:contract` e commit dos dois lados, ou a CI fica vermelha.
- `.ProducesProblem(...)` à mão por endpoint: um status esquecido não aparece no contrato (a guarda só pega a ausência total). O app trata qualquer `code` conhecido, de qualquer status.
- `src/api/generated/**` fica fora do ESLint e do `check:duplication`, e dentro do `format:check`. `apps/api/openapi/v1.json` fica sob o `.prettierignore` de `apps/api/` (o teste já o normaliza).
