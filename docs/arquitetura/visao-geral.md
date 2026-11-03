# Visão geral da arquitetura

Estrutura da tarefa E0.2, com stack, fluxos e rastreio de decisões da E0.8. `docs/decisoes.md` prevalece. Motivos da estrutura em [ADR 0005](adr/0005-estrutura-modular-api.md).

## Stack

Detalhes no [ADR 0008](adr/0008-stack-backend-app-services.md); monorepo no [ADR 0001](adr/0001-monorepo-pnpm-turborepo.md).

| Parte | Escolha |
|---|---|
| API | ASP.NET Core .NET 10, Minimal APIs, monólito modular |
| Banco | PostgreSQL (Neon) + EF Core |
| Tempo real e jobs | SignalR; Hangfire com intervalo de consulta alto |
| Página da rodada | Razor Pages no mesmo projeto |
| Login | Firebase Auth; a API valida com FirebaseAdmin ([ADR 0014](adr/0014-firebase-auth.md)) |
| App | Expo + TypeScript strict, com log de eventos em expo-sqlite |
| Regras compartilhadas | `packages/match-engine`, `packages/volley-rules` |
| Serviços | Cloudflare R2, RevenueCat, Sentry, PostHog, Resend, Expo Push |
| Hospedagem | Railway Hobby |

## Módulos da API

Monólito modular em .NET 10, com 7 módulos: Identity, Groups, Sessions, Matches, Payments, Summaries e Stats. Cada um é um `.csproj` em `apps/api/src/Sacou.Modules/<Module>/`.

| Módulo | Responsabilidade | Modelo |
|---|---|---|
| Identity | Usuário, perfil, posições, nível | CRUD |
| Groups | Membros, papéis, mensalistas, configuração padrão, plano | Agregado Group |
| Sessions | Presença, vagas, lista de espera, sorteio | Agregado Session |
| Matches | Placar, fila, rotação, banco | Stream `CourtSession` com event sourcing ([ADR 0009](adr/0009-court-session-event-sourcing.md)) |
| Payments | Pix copia e cola, "já paguei", confirmação | CRUD |
| Summaries | Resumo da rodada com IA, com cota por grupo | Serviço |
| Stats | Estatísticas, MVP e rating Glicko-2 ([ADR 0018](adr/0018-rating-and-mvp.md)) | Projeções recalculáveis |

Fonte: `produto.md:257-266`. Cada módulo tem o próprio schema no Postgres e nunca lê tabelas de outro.

## Dependências permitidas

```
Sacou.Api  ->  Sacou.Modules.*  ->  Sacou.Shared  ->  só BCL
```

- Um módulo só enxerga de outro o namespace `Sacou.Modules.<Outro>.Contracts`. Hoje nenhum módulo referencia outro.
- `Domain` só usa uma lista fechada de namespaces da BCL, `Sacou.Shared` e o próprio `Domain`.
- As regras são testes em `apps/api/tests/Sacou.Architecture.Tests`, provados contra violações plantadas em `Sacou.Architecture.Fixtures`.

## Onde fica cada coisa

| Local | Conteúdo |
|---|---|
| `src/Sacou.Api/` | Composição (`Program.cs`, `/health`) e, depois, Razor Pages |
| `src/Sacou.Shared/Results/` | `Result`, `Result<T>`, `Error`, `ErrorKind`. Namespace público novo exige ADR |
| `src/Sacou.Modules/<Module>/<Module>Module.cs` | Entrada pública: `AddXModule(IServiceCollection)` |
| `.../<Module>/Contracts/` | Única superfície pública para outros módulos |
| `.../<Module>/Domain/` | Domínio `internal`, sem infraestrutura |
| `.../<Module>/<Slice>/` | Fatia vertical `internal`: endpoint, request, handler, validação |
| `.../<Module>/Infrastructure/` | `DbContext` etc., a partir da E0.6 |
| `tests/Sacou.Modules.<Module>.Tests/<Slice>/` | Testes da fatia, criados com a primeira fatia |

Caminhos relativos a `apps/api/`. Pastas de módulo só existem quando têm conteúdo.

## Fluxos principais

**Confirmar presença pelo link.** Prévia no WhatsApp → página da rodada (Razor) → VOU → login via Firebase, uma vez → Sessions grava a presença e controla as vagas com `xmin` → Pix, se a cobrança estiver ligada. Promoção da espera sai pela Outbox e pelo Hangfire, em push (`produto.md:115, 308, 310`).

**Jogo na quadra.** O app aplica as regras em `match-engine` e grava os eventos em expo-sqlite, mesmo sem internet → sincroniza em lote, com reenvio idempotente → Matches aplica os eventos ao stream `CourtSession`, sem reimplementar a lógica → SignalR leva ao espectador → Stats recalcula as projeções ([ADR 0009](adr/0009-court-session-event-sourcing.md)).

**Entregar o placar.** QR na tela do admin → código de uso único troca por token só daquele stream → um celular escreve por vez → o admin pode retomar ([ADR 0013](adr/0013-scorekeeper-qr-token.md)).

**Cartinha.** Recorte no celular → upload do WebP sem EXIF para o R2 ([ADR 0016](adr/0016-player-card-photo.md)). Como o arquivo chega ao R2 está a definir na E3.14.

**Planos.** Compra pelas lojas via RevenueCat → `IGroupPlan` e `IUserPlan` controlam o acesso ([ADR 0015](adr/0015-plans-and-billing.md)). Como a API recebe o estado está a definir na E3.15.

**Pix do racha.** Copia e cola gerado da chave do organizador (`volley-rules`) → "Já paguei" → confirmação do admin.

## Decisões registradas

| ADR | Assunto |
|---|---|
| [0001](adr/0001-monorepo-pnpm-turborepo.md) | Monorepo com pnpm e Turborepo |
| [0002](adr/0002-padroes-e-lint.md) | Padrões e lint |
| [0003](adr/0003-local-validation-before-ci.md) | Validação local antes da CI |
| [0004](adr/0004-ci-github-actions.md) | CI no GitHub Actions |
| [0005](adr/0005-estrutura-modular-api.md) | Estrutura modular da API |
| [0006](adr/0006-formacoes-em-json.md) | Formações em JSON e golden compartilhado |
| 0007 | Reservado à E0.9, segurança na CI, ainda sem merge |
| [0008](adr/0008-stack-backend-app-services.md) | Stack: back-end, app, página web e serviços |
| [0009](adr/0009-court-session-event-sourcing.md) | Event sourcing por `CourtSession` |
| [0010](adr/0010-rotation-and-rule-mode.md) | Rotação por time, formações como dados e modo de regra |
| [0011](adr/0011-backend-patterns.md) | Padrões de back-end, sem MediatR e AutoMapper |
| [0012](adr/0012-personal-data-member-id.md) | Dados pessoais: `MemberId` e LGPD |
| [0013](adr/0013-scorekeeper-qr-token.md) | Placar por QR com token por stream |
| [0014](adr/0014-firebase-auth.md) | Login com Firebase Auth |
| [0015](adr/0015-plans-and-billing.md) | Planos, cobrança pelas lojas e Pix |
| [0016](adr/0016-player-card-photo.md) | Foto da cartinha: recorte no celular e R2 |
| [0017](adr/0017-group-settings-queue-bench.md) | Configuração herdada, membros, fila e banco |
| [0018](adr/0018-rating-and-mvp.md) | Rating, faixas, MVP do dia e ponto individual |
| [0019](adr/0019-agent-process.md) | Processo de agentes e merge automático |
| [0020](adr/0020-postgres-local-e-testes-de-integracao.md) | Postgres local e testes de integração com Testcontainers |
| [0021](adr/0021-overlap-validator.md) | Validador de sobreposição, `OverlapRuleMode` e `RotationSlot` |
| [0022](adr/0022-event-envelope-replay.md) | Envelope de evento e função de estado |
| [0023](adr/0023-placar-e-catalogo-de-eventos.md) | Placar e primeiros tipos do catálogo de eventos |
| [0024](adr/0024-saque-e-rotacao-derivados.md) | Saque, side-out e rotação por time |
| [0025](adr/0025-json-compartilhado-no-csharp.md) | Leitura dos JSON compartilhados no C# e barreira do domínio |
| [0026](adr/0026-posicoes-no-saque.md) | Posições no saque por sistema e fase, e versão do catálogo de formações |
| [0027](adr/0027-banco-manual.md) | Banco manual e alteração de escalação em partida |
| [0028](adr/0028-libero-ligado.md) | Líbero ligado: vagas por índice, entrada e saída calculadas |
| [0029](adr/0029-fila-da-quadra.md) | Fila da quadra: gravada inteira, saída parcial calculada no comando |

## Matriz: `decisoes.md` → ADR

| Linha | Decisão | ADR |
|---|---|---|
| 7 | Nome, app nativo e página da rodada | 0008 |
| 8 | Configuração herdada e modelos | 0017 |
| 9 | Padrão de partida | 0017 |
| 10 | Membros e papéis | 0017 |
| 11 | Fila e saída parcial | 0017, 0029 |
| 12 | Rotação e modo de regra | 0010, 0006, 0021, 0024, 0026, 0027, 0028 |
| 13 | Banco no MVP | 0017, 0027 |
| 14 | Ponto individual | 0018 |
| 15 | MVP do dia | 0018 |
| 16 | Rating | 0018 |
| 17 | Faixas da cartinha | 0018 |
| 18 | Foto da cartinha | 0016 |
| 19 | Login | 0014 |
| 20 | Planos | 0015 |
| 21 | Placar por QR | 0013 |
| 25 | Back-end | 0008, 0005 |
| 26 | Event sourcing | 0009, 0022, 0023, 0024, 0026, 0027, 0028, 0029 |
| 27 | Padrões | 0011, 0029 |
| 28 | Dados pessoais | 0012 |
| 29 | App | 0008 |
| 30 | Monorepo | 0001 |
| 31 | Serviços | 0008; varredura na CI: 0007, ainda sem merge |
| 35 | Ciclo de agentes | 0019 |
| 36 | Merge automático | 0019, 0004 |
| 37 | Sessões contínuas | 0019 |
