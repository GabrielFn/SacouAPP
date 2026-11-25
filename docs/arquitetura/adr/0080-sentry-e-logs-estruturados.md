# ADR 0080 — Sentry e logs estruturados

Status: aceita (24/11/2026). Tarefa E5.2 ([plano](../../estado/tarefas/E5.2.md)). Cobre a **API** (Parte 1, D1 a D8) e o
**app** (Parte 2, D9 a D13). Perguntas 208 a 212 com o padrão adotado do plano (região US, sem id de usuário,
sem tracing, dois projetos, prova só no teste).

## Contexto

O piloto precisa ver os erros da API sem ler log à mão, e o log do Cloud Run precisa ser pesquisável por requisição.
O Sentry é um terceiro: nada de dado pessoal pode sair para ele (`produto.md:375`, `dados-pessoais.md`). O Cloud Run
congela a CPU fora da requisição (ADR 0068, D2), então um envio em segundo plano pode nunca sair.

## Decisão

- **D1 · Desligado sem DSN.** Sem `SACOU_SENTRY_DSN` o Sentry nem é registrado (sem `IHub`): desenvolvimento, CI e
  testes nunca enviam nada. A API avisa com o **nome** da variável. Um DSN fora do formato (não `https`, sem chave ou
  sem projeto) para a subida com uma mensagem que só cita o nome.
- **D2 · Pacote e ligação.** `Sentry.AspNetCore` **7.0.1, versão exata** (o filtro depende do formato do evento),
  ligado por `AddSacouObservability` em `Sacou.Api/Observability/` (`builder.WebHost.UseSentry`). Ambiente =
  `ASPNETCORE_ENVIRONMENT` em minúsculas; release = `SENTRY_RELEASE` (`sacou-api@<12 primeiros do digest>`, posto pela
  action de deploy; não é segredo).
- **D3 · Opções fixas.** `SendDefaultPii = false`, `MaxRequestBodySize = None`, `AttachStacktrace = true`,
  `SampleRate = 1`, `TracesSampleRate = 0` (pergunta 210), `MinimumEventLevel = Error`,
  `MinimumBreadcrumbLevel = Information`, `ServerName` vazio, sem usuário no escopo (pergunta 209). Breadcrumbs só das
  categorias `Sacou.*` e `http`; o logger de hosting (`Microsoft.AspNetCore.Hosting.Diagnostics`, que escreve o caminho
  preenchido) e o do EF ficam fora. Os logs do acesso a dados (`Microsoft.EntityFrameworkCore.*` e `Npgsql.*`) não
  viram nem evento nem breadcrumb (`AddLogEntryFilter`): o `Error` do comando traz o SQL e seria um segundo evento ao
  lado do 500, que já leva a exceção (R2, caso 12; teste de integração `SentryDatabaseErrorTests`).
- **D4 · Filtro por lista permitida (`SentryEventScrubber`).** No `BeforeSend` o evento vira JSON e só passam campos
  conhecidos: id, horário, nível, logger, release, ambiente, SDK, módulos, pilha, `transaction`, mensagem, exceção,
  tags `trace_id` e `route`, contextos `trace`, `runtime` e `os`, e o pedido só com método, `Content-Type`/`Accept` e
  a **URL trocada pelo modelo da rota** (`/r/{code}`, nunca o código; `[unmatched]` sem rota). Saem `user`, IP,
  `server_name`, `extra`, corpo, cookies, query, demais cabeçalhos, `data` do mecanismo e os parâmetros do modelo de
  log. Mensagem, `logentry`, valor da exceção e breadcrumbs passam por `SensitiveText` (e-mail, `Bearer ...`, JWT
  `eyJ...`, Pix `000201...` viram `[filtrado]`). O mesmo filtro corre no `BeforeBreadcrumb` (URL sem query, só `url`,
  `method`, `status_code` e `eventId` nos dados), e na mensagem do log e nos breadcrumbs todo GUID vira `[id]`: um log `Sacou.*` em
  `Information` pode nomear o `MemberId` (ex.: `RoundLog.Promoted`), e o Sentry nunca recebe `MemberId`. O id segue
  na linha do Cloud Logging, achada pelo `trace_id`. O evento original não é alterado.
- **D5 · Logs do Cloud Run.** Fora de Development, um `ConsoleFormatter` próprio (`CloudRunJsonFormatter`, sem pacote
  novo) escreve uma linha JSON por log: `severity` (`DEBUG`/`INFO`/`WARNING`/`ERROR`/`CRITICAL`), `time` em UTC,
  `message`, `category`, `eventId`, `logging.googleapis.com/trace` (`projects/<NotificationTasks:Project>/traces/<id>`,
  do `Activity.Current`, que o ASP.NET preenche pelo `traceparent` do Cloud Run), `logging.googleapis.com/spanId` e a
  exceção com tipo e pilha. **Escopos nunca são escritos** (o de hosting traz o `RequestPath`). Os outros provedores
  de log são retirados. Development mantém o console simples.
- **D6 · Níveis.** `appsettings.json` ganha `Microsoft.EntityFrameworkCore: Warning` e
  `System.Net.Http.HttpClient: Warning`.
- **D7 · Correlação.** A tag `trace_id` do evento (`RequestTagsProcessor`, do `Activity.Current`) é o mesmo id do
  `traceId` do ProblemDetails (`00-<id>-<span>-..`) e do campo de trace da linha de log.
- **D8 · Erro proposital.** `GET /dev/fail` só em Development e Staging, com o login padrão (sem `AllowAnonymous`) e o
  limite global; lança `DeliberateFailureException` com mensagem fixa em inglês. Em Production a rota não existe.
- **R1 · Envio antes de a CPU congelar.** A opção `FlushBeforeRequestCompleted` do SDK é **interna** na 7.0.1. Em
  vez dela, `FlushOnFailureStartupFilter`, registrado antes do `UseSentry` (o primeiro filtro é o middleware mais
  externo), espera o envio (`FlushAsync`, até 2 s) quando a resposta é ≥ 500, antes de a requisição terminar.
- **R2 · Um evento só.** O `SentryMiddleware` captura a exceção pelo `IExceptionHandlerFeature`; o SDK já ignora o
  log de erro do `ExceptionHandlerMiddleware`. Teste garante exatamente um evento.
- **Deploy.** `service.yaml` lê `SACOU_SENTRY_DSN` por `secretKeyRef` (`${SENTRY_SECRET}`) entre os marcadores
  `# sentry-begin`/`# sentry-end`; a action recebe `sentry-secret` **opcional** e apaga o bloco quando vazio. O
  workflow ainda não passa a entrada: depois de o Gabriel criar `sacou-sentry-dsn-api`, acrescentar
  `sentry-secret: sacou-sentry-dsn-api` nos dois jobs de `deploy-api.yml`. Teste de arquitetura: o DSN só por
  `secretKeyRef`, nunca valor, e a action nunca cita o nome da variável.

## Decisão: app (Parte 2)

- **D9 · Porta e adaptador.** `@sentry/react-native` **8.28.1, versão exata** (a que o `expo install` dá para o
  SDK 58; o filtro depende do formato do evento). **Dependência nativa: exige APK novo.** A porta `ErrorReporter`
  (`src/services/error-reporting/`: `captureError(error, { area })` e `crashNatively()`, só para a tela de dev)
  entra no `Services`; o real é `src/adapters/sentry-error-reporter.ts` (`startErrorReporter` antes de qualquer
  outro serviço do `_layout.tsx` e `withErrorReporting(RootLayout)`, que é o `Sentry.wrap`), o desligado é
  `noop-error-reporter.ts` e o falso de teste `fake-error-reporter.ts`. **Só `src/adapters/` importa `@sentry/*`**,
  o `_layout.tsx` também não (mais estrito que o plano): `@sentry/` entrou no padrão de SDKs do lint, com casos
  no `lint:regression` (tela, tipo numa fatia e adaptador). DSN em `EXPO_PUBLIC_SENTRY_DSN`: **público** (vai no
  APK, como todo DSN de cliente), lido em `src/config/sentry.ts`, que aceita só `https://<chave>@<host>/<projeto>`;
  ausente, vazio ou fora do formato, o Sentry nem inicia (D1). Ambiente em `EXPO_PUBLIC_SENTRY_ENVIRONMENT`
  (`eas.json`: `development` no perfil de desenvolvimento, `staging` no `preview`; `production` no perfil de loja da
  E5.4); ausente ou fora do formato, `development`.
- **D10 · Opções fixas** (`src/adapters/sentry-options.ts`, com teste). `sendDefaultPii: false` (o núcleo marca a
  opção como obsoleta em favor de `dataCollection`, que o SDK do React Native não aceita: continua sendo a única
  chave, também no lado nativo); `attachScreenshot`, `attachViewHierarchy` e `reportAccessibilityIdentifier`
  desligados (a tela e a árvore mostram apelidos); `enableLogs`, `enableCaptureFailedRequests` e
  `enableAutoPerformanceTracing` desligados; sem replay e sem perfil. **Sem tracing por omissão de
  `tracesSampleRate`**: o plano pedia 0, mas no SDK qualquer número (0 também) liga as integrações de tracing (início
  do app, quadros, rotas). `enableAutoSessionTracking` ligado (saúde da versão, sem usuário), `maxBreadcrumbs: 30`.
  `beforeSend` e `beforeBreadcrumb` passam pelo `scrub-event.ts` (puro, sem o SDK), espelho do D4 por lista
  permitida: o evento perde `server_name` (o `user` vira o anônimo, D14), `extra`, tudo do `request` menos URL e método, as tags fora de
  `area`/`event.origin`/`event.environment` e o nome do aparelho no contexto; URL sem query nem fragmento (o token do
  convite fica depois do `#`), `/c/...` e `/r/...` (web ou `sacou://`) viram `{code}`, todo GUID vira `[id]`, e
  e-mail, `Bearer`, JWT e Pix viram `[filtrado]` na mensagem, na exceção e nos breadcrumbs. Breadcrumb de `console`
  é descartado; HTTP fica com método, status e URL limpa; navegação e deep link só com a rota limpa; toque só com os
  nomes dos componentes (o `Sentry.wrap` também recebe `extractTextFromChildren: false`, porque o texto de um botão
  pode ser um apelido); os demais ficam com a mensagem filtrada e sem `data`.
- **D11 · Mapa de fontes.** Plugin `@sentry/react-native/expo` no `app.json` com `project: sacou-mobile` e a URL;
  **a organização não fica no repositório**: o build lê `SENTRY_ORG` (variável comum do EAS), para não depender do
  slug no código. `metro.config.js` usa `getSentryExpoConfig` (ids de depuração no bundle) e mantém o bloqueio das
  worktrees (teste do Metro). Upload no build do EAS com `SENTRY_AUTH_TOKEN` (variável **secreta do EAS**). Perfil
  `development` com `SENTRY_DISABLE_AUTO_UPLOAD=true`; o `preview` tem `SENTRY_ALLOW_FAILURE=true`, para um build sem
  token (antes do passo do Gabriel) não falhar: o upload que falha aparece no log do EAS e a pilha sai sem
  simbolizar. O `pnpm build` local (`expo export`) não precisa do token. `@sentry/cli` em `allowBuilds: false`: o
  binário vem no pacote da plataforma (dependência opcional) e o postinstall só baixaria outra cópia.
- **D12 · Erro proposital.** Na tela de dev `app/dev/catalog.tsx` (só com `EXPO_PUBLIC_DEV_TOOLS=1`), a seção
  "Erros (Sentry)" com "Enviar erro de teste" (`DeliberateFailure`, mensagem fixa em inglês, tag `area=dev-catalog`)
  e "Travar o app (teste)" (`Sentry.nativeCrash()` pela porta). Textos em `strings.catalog.errorTest`.
- **D13 · Cota e lacuna aceita.** O DSN do app é público e pode ser usado para encher a cota grátis: aceito (padrão
  do Sentry), com o limite de 300 eventos por hora na chave do `sacou-mobile` (passo 3 do roteiro). Uma falha **nativa** (Java/Kotlin/NDK) não passa pelo `beforeSend` do JS: sai com a pilha
  nativa, o contexto do aparelho sem nome (`sendDefaultPii: false` no lado nativo) e os breadcrumbs já filtrados
  (o SDK copia para o nativo só o que passou pelo `beforeBreadcrumb`). Os filtros do painel (Data Scrubber e
  "Prevent Storing of IP Addresses", passo 3 do roteiro) cobrem o resto.
- **D14 · Usuário anônimo fixo e geo vazia** (25/11/2026, aceite no emulador com o APK `preview`). Os dois eventos
  (erro JS e falha nativa) chegavam com *Geography: cidade, BR*, mesmo com "Prevent Storing of IP Addresses" e
  `sendDefaultPii: false`: o JS já manda `sdk.settings.infer_ip: "never"` (o IP não vai para `user.ip_address`), mas o
  Relay deriva `user.geo` do IP da conexão sempre que o evento chega sem geo (`normalize_user_geoinfo` usa o IP do
  cliente como alternativa) e só pula a consulta quando `user.geo` já existe. Não há opção do SDK nem do painel que
  desligue isso. Por isso todo evento leva `ANONYMOUS_USER` (`scrub-event.ts`): `{ id: "[id]", geo: { region:
  "[filtrado]" } }`, igual em todo aparelho. O `scrubEvent` troca o usuário por ele (antes apagava), e o adaptador chama
  `Sentry.setUser(ANONYMOUS_USER)` logo depois do `init`; o SDK copia o usuário do escopo para o lado nativo
  (`scopeSync`). Uma falha nativa Android **não passa pelo `beforeSend` do JS** (é gravada no disco pelo SDK Java na
  hora da falha e enviada na abertura seguinte pelo nativo), mas o SDK Java aplica o escopo na captura: ela sai com o
  mesmo usuário. O `id` fixo também impede o SDK Android de pôr o id da instalação (`DefaultAndroidEventProcessor`
  só preenche um id ausente). O `setUser` com `geo` chega ao nativo desde a correção da issue 6306 do SDK (presente na
  8.28.1). Contagem de "usuários afetados" fica sempre 1: aceito (pergunta 209, sem id
  de usuário). **Sem mudança nativa**, mas o APK `preview` leva o bundle do JS: o aceite pede um build novo.
- **D15 · O que a falha nativa ainda leva, sem código nativo.** O RN 8.28.1 não aceita `beforeSend` nativo por
  opção: o `RNSentryStart` só lê opções simples do JS, e o único gancho é `RNSentrySDK.init(context, configuração)`
  em Kotlin/Java no `MainApplication` (plugin do Expo próprio), fora do escopo desta correção. Ficam no evento nativo
  (fora do filtro do JS): `device.timezone`, `device.locale`/`language`, `app.permissions` (as permissões do
  manifesto do Sacou e se foram concedidas) e os demais campos técnicos do aparelho, todos sem identificar a pessoa.
  Uma falha nativa **antes** do `setUser` (no início do app, antes do JS) ainda sai com o id da instalação e **sem `user.geo`**, e o Relay deriva a cidade do IP. As sessões
  de saúde da versão do SDK Android usam o id da instalação como `did` (a conferir no painel). Se for preciso
  apagar esses campos, o caminho sem código é a regra de "Advanced Data Scrubbing" no painel do `sacou-mobile`
  (`Remove`, tipo `Anything`, origem `$user.id || $user.geo || $device.timezone || $device.locale || $device.language || $app.permissions`; o Relay aplica a regra depois da consulta de geo, então ela também cobre a falha anterior ao JS),
  e o caminho com código é o `beforeSend` nativo pelo `RNSentrySDK.init` (exige APK novo).

## Consequências

- Erros esperados (`Result`, 4xx, 401/403/429, cliente que desistiu) não viram evento: não gastam a cota grátis.
- Um log novo com dado pessoal num parâmetro não vaza por padrão (os parâmetros caem; a mensagem formatada passa pelo
  filtro de padrões), mas um apelido solto na mensagem formatada passaria: `LoggerMessage` continua sem apelido nem
  e-mail (revisão de segurança faz o grep).
- Atualizar o SDK exige rever o filtro (versão exata no `Directory.Packages.props`).
- Alternativas descartadas: `Google.Cloud.Logging.Console` (pacote a mais para um formatter); lista negada de campos.
