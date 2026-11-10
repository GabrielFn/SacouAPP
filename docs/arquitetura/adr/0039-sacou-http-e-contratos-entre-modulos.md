# ADR 0039 · `Result → ProblemDetails` no projeto `Sacou.Http` e primeiro contrato entre módulos

**Status:** aceito (09/11/2026). **Tarefa:** E3.2, parte 1. Plano: [`E3.2.md`](../../estado/tarefas/E3.2.md) (D4 e D8). Fecha o desvio do [ADR 0036](0036-verificacao-do-token-e-usuario.md) (D7) e complementa o [ADR 0005](0005-estrutura-modular-api.md).

## Contexto

A E3.2 traz os primeiros erros de regra numa resposta HTTP e o primeiro módulo que precisa de outro (Groups precisa saber quem é o usuário do Identity). O mapeamento depende de ASP.NET, mas `Sacou.Shared` só pode referenciar uma lista fechada da BCL, e módulo não pode depender de `Sacou.Api`. Copiar o mapeamento em cada módulo esbarra no portão de duplicação (ADR 0035).

## Decisões

**D1 · Projeto `apps/api/src/Sacou.Http`.** Namespace `Sacou.Http`, **sem** o prefixo `Sacou.Shared`: a regra do domínio libera qualquer `Sacou.Shared.*`, e o domínio não pode ver ASP.NET. Referencia só `Microsoft.AspNetCore.App` e `Sacou.Shared`. Os módulos com endpoint o referenciam. Fica fora de `Sacou.Modules/`, então o catálogo de módulos continua com 7. Lista fechada do que ele expõe:

- `ProblemResults.From(Error) → ProblemHttpResult`: status por `ErrorKind` (`Validation` 400, `Forbidden` 403, `NotFound` 404, `Conflict` 409), `title` fixo em inglês, `type` da seção da RFC 9110 do status e a extensão **`code`** com o `Error.Code`. Sem `detail`, sem valor recebido, sem ID. `traceId` vem do `AddProblemDetails`, como nos 401 e 500 da E3.1. O texto pt-BR fica no app, por código. `ErrorKind` sem status é erro de programação (exceção), coberto por um teste por valor do enum.
- `ResultHttpExtensions.ToHttpResult(Result<T>, Func<T, TSuccess>) → Results<TSuccess, ProblemHttpResult>`: o endpoint declara os dois formatos para o OpenAPI (E4.2, [ADR 0042](0042-contrato-openapi-e-cliente.md), que acrescenta `.ProducesProblem(...)` por status).
- `ApiJson.AddApiJson()` (**acréscimo ao plano**): regras de JSON de todo corpo de requisição, chamadas no `Program`. `UnmappedMemberHandling = Disallow` (campo que o DTO não declara é 400, contra atribuição em massa), `AllowDuplicateProperties = false` (chave repetida no mesmo objeto é 400, inclusive com caixa diferente, como `{"name":"a","NAME":"b"}`, para nenhum leitor escolher outra cópia) e enums como texto camelCase com `allowIntegerValues: false` (`"role": 0` é 400). **Leitura sem diferenciar caixa, escrita camelCase:** `{"Name":...}` e `"ADMIN"` são aceitos (padrão de `JsonSerializerDefaults.Web`, mantido de propósito: o app manda camelCase, e recusar outra caixa não fecha ameaça nenhuma); a resposta sai sempre em camelCase. **Um valor por enum:** o conversor padrão leria `"admin,player"` como os dois valores combinados; `SingleValueEnumConverter` (`internal`) recusa a vírgula com 400 em todo enum que não é `[Flags]`. Global, e não por atributo em cada DTO, para um DTO novo nascer seguro. Corpo malformado é 400 `ProblemDetails` do pipeline, sem eco do JSON nem da mensagem do `JsonException`.

**Guardas** (`Sacou.Architecture.Tests`): `Sacou.Http` não referencia `Sacou.Modules.*` nem `Sacou.Api`; expõe só o namespace `Sacou.Http`; `InternalsVisibleTo` só para `Sacou.Http.Tests` e tipos sob o nome do assembly (entrou em `ModulesAndShared`); um caso plantado prova que um domínio usando `Sacou.Http` reprova.

**D2 · `Sacou.Modules.Identity.Contracts`.** Primeiro namespace `Contracts` do projeto:

- `ICurrentUser.GetAsync(CancellationToken) → Result<CurrentUser>`, com `CurrentUser(Guid UserId)`. **Desvio do plano**, que previa `FindAsync → CurrentUser?`: o `Result` traz o erro pronto, e quem chama não repete a regra. A falha é `CurrentUserErrors.NotRegistered` (`identity.user-not-registered`, `Forbidden`, **403**): login válido sem linha em `identity.users` (nunca chamou `POST /v1/me`). Não é 401, para o app não deslogar: ele chama `POST /v1/me` e repete.
- A implementação `internal` (`HttpCurrentUser`, escopo da requisição) lê só o `sub` do principal, busca no `IUserStore` e guarda o resultado na requisição. Nada vem de claim além do `sub`: nem papel, nem grupo.
- O `UserId` de domínio do Identity continua `internal`; o contrato expõe o `Guid`.

**D3 · Como um módulo usa outro.** `ProjectReference` direto ao projeto do outro módulo, usando só o namespace `Contracts` (regra existente `Modules_UseEachOtherOnlyThroughContracts`, agora com dependência real: Groups → Identity). O Identity nunca referencia o Groups (o MSBuild recusa o ciclo). Se surgir ciclo, extrair só aquele `Contracts` (ADR 0005).

## Alternativas descartadas

- **Mapeamento em `Sacou.Shared`:** traria ASP.NET para o projeto que o domínio pode usar.
- **Mapeamento no `Sacou.Api`:** módulo não pode depender da API.
- **Cópia por módulo:** duplicação, e o próximo módulo esqueceria uma regra.
- **Atributo `[JsonUnmappedMemberHandling]` por DTO:** um DTO novo sem o atributo aceitaria campo a mais em silêncio.

## Consequências

- **Compatibilidade em `/v1`:** nenhum campo de requisição é removido. Um campo que deixa de ser usado vira opcional e passa a ser ignorado, porque o `Disallow` daria 400 ao app antigo que ainda o manda. Campo novo segue a ordem de publicação: a API que o conhece sobe antes do app que o manda, senão o app novo recebe 400 da API antiga. Mudança que não cabe nisso vai para `/v2`.
- Todo erro de regra da API sai igual: `type`, `title`, `status`, `code`, `traceId`. O app traduz pelo `code`.
- O limite de 4 KB das rotas de grupo é metadado (`RequestSizeLimitAttribute`), que o Kestrel aplica; o `TestServer` dos testes de integração não aplica. Um teste confere o metadado em toda rota do Groups; o 413 em si é testado com Kestrel na parte 2 (M8).
