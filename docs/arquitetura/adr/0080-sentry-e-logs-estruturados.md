# ADR 0080 — Sentry e logs estruturados

Status: aceita (24/11/2026). Tarefa E5.2 ([plano](../../estado/tarefas/E5.2.md)). Esta versão cobre a **API** (Parte 1);
a seção do app entra com a Parte 2. Perguntas 208 a 212 com o padrão adotado do plano (região US, sem id de usuário,
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

## Consequências

- Erros esperados (`Result`, 4xx, 401/403/429, cliente que desistiu) não viram evento: não gastam a cota grátis.
- Um log novo com dado pessoal num parâmetro não vaza por padrão (os parâmetros caem; a mensagem formatada passa pelo
  filtro de padrões), mas um apelido solto na mensagem formatada passaria: `LoggerMessage` continua sem apelido nem
  e-mail (revisão de segurança faz o grep).
- Atualizar o SDK exige rever o filtro (versão exata no `Directory.Packages.props`).
- Alternativas descartadas: `Google.Cloud.Logging.Console` (pacote a mais para um formatter); lista negada de campos.
