# ADR 0036 · Verificação do ID token do Firebase e usuário

**Status:** aceito (08/11/2026). **Tarefa:** E3.1. Atualiza o [ADR 0014](0014-firebase-auth.md). Plano: [`E3.1.md`](../../estado/tarefas/E3.1.md).

## Contexto

O app entra pelo Firebase Auth (Google, Apple, e-mail e senha) e manda o ID token à API. O ADR 0014 dizia "a API valida o token com FirebaseAdmin", mas o Admin SDK exige a chave da conta de serviço até para só verificar token, e a busca de chaves dele não pode ser trocada nos testes. É o primeiro endpoint da API: o padrão de autenticação, de erro e de rota vira precedente.

## Decisões

**D1 · JWT pelas chaves públicas do Google, sem FirebaseAdmin.** Segue "Verify ID tokens using a third-party JWT library" da documentação do Firebase, com `Microsoft.IdentityModel.JsonWebTokens` 8.23.0. As chaves vêm só de `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`. A E3.1 não precisa de segredo: só do ID do projeto, que é público. Perde-se o `checkRevoked` (ver Riscos). O FirebaseAdmin continua na stack (`decisoes.md:25`) para administrar contas na E3.16. **Troca:** `IIdTokenVerifier` (interno ao Identity) devolve `Result<VerifiedLogin>`, e `VerifiedLogin(AuthSubject, SignInProvider)` não cita o Firebase; trocar de verificador é registrar outra implementação. As chaves ficam atrás de `ISigningKeySource`.

**D2 · Regras de aceitação.** `alg` só `RS256`, conferido no cabeçalho antes de buscar chave e de novo pela biblioteca (`ValidAlgorithms`). `kid` obrigatório, e o resolvedor devolve só a chave daquele `kid` (`TryAllIssuerSigningKeys = false`); `jwk`, `jku` e `x5u` são ignorados. `RequireSignedTokens = true`. Depois da assinatura, `FirebaseTokenRules` (funções puras, uma por regra) confere: `aud` igual ao ID do projeto e como **string** (lista é recusada, mesmo com o valor certo; a biblioteca ignora barra final, a regra não); `iss` exatamente `https://securetoken.google.com/<projectId>`; `exp`, `iat` e `auth_time` obrigatórios e inteiros, com tolerância de 60 s (`ClockSkew`); `nbf`, se vier; `sub` de 1 a 128 caracteres ASCII visíveis (`AuthSubject`); `firebase.sign_in_provider` em `password`, `google.com` ou `apple.com`; `firebase.tenant` ausente. Token acima de 8 KB e JWE (5 partes) são recusados antes de qualquer leitura. Payload com chave repetida é recusado. A biblioteca também confere tempo, emissor e audiência, como segunda barreira. **Relógio:** o `TokenValidationParameters` da 8.23.0 não expõe `TimeProvider` público, então a biblioteca lê o relógio do sistema e as regras puras usam o `TimeProvider` injetado. As bordas exatas (60 s aceita, 61 s recusa) são testadas na função pura; no HTTP, com relógio real, as margens são de 30 s e 120 s.

**Erros sem oráculo.** O motivo é o enum interno `IdTokenRejection`, registrado no log só como categoria (`ID token refused: Expired.`). A resposta é sempre o mesmo 401 `ProblemDetails` com `WWW-Authenticate: Bearer`, sem `error`. A mensagem de exceção da biblioteca nunca é lida nem registrada (pode ecoar o token); `LogValidationExceptions = false`, `LogTokenId = false`, e `ShowPII` e `LogCompleteSecurityArtifact` nunca são ligados (guarda de texto em `Sacou.Architecture.Tests`).

**D3 · E-mail não verificado é aceito; a API não usa nem guarda e-mail.** A identidade é o `sub`. Confirmado pelo Gabriel em 08/11/2026 (pergunta 11). Consequência para a E3.5: reivindicar convidado nunca usa coincidência de e-mail, só o link.

**D4 · Senha e tentativas ficam com o Firebase.** A senha nunca passa pela API. O Firebase bloqueia excesso de tentativas e tem proteção contra enumeração de e-mails. Senha mínima: 6 caracteres, padrão do Firebase (pergunta 12, 08/11/2026). O limite de requisições do `POST /v1/me` é da E5.3.

**D5 · `User` e `MemberId`.** A E3.1 cria só o `User` do Identity: `UserId` interno (UUID v7 gerado pela API, com o relógio injetado), `AuthSubject` (UID do Firebase) e `CreatedAt`. O UID não é chave interna. O `MemberId` nasce na E3.2, e eventos só apontam para ele (ADR 0012). `UserId` é `internal`; a E3.2 decide como expô-lo em `Identity.Contracts`. **Minimização:** só `id`, `firebase_uid` e `created_at`; um teste de modelo trava as 3 colunas.

**D7 · Endpoint e pipeline.** `POST /v1/me`, sem corpo, `{ "userId": "<uuid>" }`, 201 quando criou e 200 quando já existia. Prefixo `/v1`. `FirebaseAuthenticationHandler` é o esquema padrão (`IdentityModule.AuthenticationScheme`): lê só **um** cabeçalho `Authorization` que comece por `Bearer ` (maiúsculas como no padrão de uso) e um token sem espaço; nunca query string nem cookie; o principal tem uma claim só, o `sub`. **Seguro por padrão:** `FallbackPolicy` exige usuário autenticado; `AllowAnonymous` só em `Program.cs` (hoje, `/health`), guardado por teste. `AddProblemDetails`, `UseExceptionHandler` e `UseStatusCodePages`: 401 e 503 vazios ganham corpo `ProblemDetails`; erro inesperado é 500 sem detalhe. Chaves do Google fora do ar e sem cache: **503** com `Retry-After: 30`, para o app não deslogar a pessoa. Sem CORS e sem OpenAPI nesta tarefa (E4.2). **Desvio do ADR 0005:** o mapeamento `Result → ProblemDetails` entra na E3.2, o primeiro endpoint com erro de regra.

**D8 · Configuração.** `Firebase:ProjectId` não é segredo e fica em `appsettings.json` (`sacou-79493`). A API não sobe com valor vazio ou fora do formato de ID do GCP (`^[a-z][a-z0-9-]{4,28}[a-z0-9]$`), com mensagem que cita a chave e nunca o valor. `SACOU_FIREBASE_SERVICE_ACCOUNT` passa para a E3.16, em Base64 numa linha (formato em [`segredos.md`](../../seguranca/segredos.md)).

**Cache de chaves.** `GoogleSigningKeySource` guarda as chaves pelo `Cache-Control: max-age`, limitado a 5 min..24 h. Uma busca por vez (`SemaphoreSlim`), e quem esperava reaproveita a tentativa de quem buscou. Com cache, `kid` desconhecido força no máximo uma busca a cada 5 min. Busca com falha e cache: as chaves antigas valem até o `NotAfter` de cada certificado, com aviso no log; um `kid` conhecido com certificado vencido é "indisponível" (503), não "desconhecido" (401). Sem cache: "indisponível" (503), e nova busca no máximo a cada 10 s. A tentativa é registrada num `finally`, mesmo se a busca lançar. O cliente nomeado (`IdentityModule.SigningKeysHttpClientName`) tem `AllowAutoRedirect = false` e corpo de até 64 KB; um prazo único de 5 s (`CancellationTokenSource`) cobre o envio e a leitura do corpo, e `IOException` no corpo é falha de rede. Documento com uma entrada inválida é recusado inteiro, e os certificados lidos são descartados; nenhuma falha de certificado sai do leitor como exceção (chave RSA com bytes inválidos incluída), e o fetcher trata qualquer falha do leitor como documento inválido. A busca não usa o `CancellationToken` de quem pediu, para uma requisição cancelada não cancelar a busca que outras esperam.

## Alternativas descartadas

- **FirebaseAdmin para verificar:** exige a chave da conta de serviço e não permite testar sem rede.
- **`JwtBearer` do ASP.NET com `Authority`:** busca OIDC discovery, que o endpoint do Firebase não tem para esse uso, e esconde as regras específicas (`auth_time`, provedor, tenant).

## Consequências e riscos

- **Sem revogação:** um token emitido antes de bloquear ou apagar a conta vale por até 1 h. **Para a E3.16:** apagar a linha não basta, porque o mesmo token recriaria o usuário no `POST /v1/me`. A E3.16 grava marca de exclusão do UID, ou recusa `auth_time` anterior à exclusão, ou usa `checkRevoked` só nesse endpoint.
- **ID do projeto errado:** todo login real dá 401; o roteiro de 10 minutos da E4.3 pega.
- **Formato do endpoint do Google:** mudança derruba o login com 503 (não 401). Coberto por testes.
- **Log de requisição:** o log de hospedagem do ASP.NET em Information mostra a query string. `appsettings.json` corta `Microsoft.AspNetCore` em Warning; o token nunca vem na query, mas um cliente errado poderia mandá-lo ali.
- `produto.md:250` fica desatualizado ("FirebaseAdmin valida"); este ADR prevalece.
