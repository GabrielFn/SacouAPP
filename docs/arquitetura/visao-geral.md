# Visão geral da arquitetura

Estrutura da tarefa E0.2, com stack, fluxos e rastreio de decisões da E0.8. `docs/decisoes.md` prevalece. Motivos da estrutura em [ADR 0005](adr/0005-estrutura-modular-api.md).

## Stack

Detalhes no [ADR 0008](adr/0008-stack-backend-app-services.md); monorepo no [ADR 0001](adr/0001-monorepo-pnpm-turborepo.md).

| Parte | Escolha |
|---|---|
| API | ASP.NET Core .NET 10, Minimal APIs, monólito modular |
| Banco | PostgreSQL (Neon) + EF Core |
| Tempo real e jobs | SignalR (placar ao vivo, pós-piloto, [ADR 0046](adr/0046-escopo-do-piloto-e-papel-placar.md)); Hangfire com intervalo de consulta alto |
| Página da rodada | Razor Pages no mesmo projeto |
| Login | Firebase Auth; a API valida o ID token como JWT pelas chaves públicas do Google ([ADR 0036](adr/0036-verificacao-do-token-e-usuario.md)); FirebaseAdmin só para administrar contas (E3.16) ([ADR 0014](adr/0014-firebase-auth.md)) |
| App | Expo + TypeScript strict, com log de eventos em expo-sqlite; tipos da API gerados do contrato OpenAPI versionado (`apps/api/openapi/v1.json`), que a API só serve em `Development` ([ADR 0042](adr/0042-contrato-openapi-e-cliente.md)) |
| Regras compartilhadas | `packages/match-engine`, `packages/volley-rules` |
| Serviços | Cloudflare R2 (backups no piloto; fotos depois), Sentry, Resend, Expo Push; RevenueCat e PostHog depois do piloto ([ADR 0046](adr/0046-escopo-do-piloto-e-papel-placar.md)) |
| Hospedagem | Railway Hobby |

## Módulos da API

Monólito modular em .NET 10, com 7 módulos: Identity, Groups, Sessions, Matches, Payments, Summaries e Stats. Cada um é um `.csproj` em `apps/api/src/Sacou.Modules/<Module>/`.

| Módulo | Responsabilidade | Modelo |
|---|---|---|
| Identity | Usuário, perfil, posições, nível | CRUD |
| Groups | Membros, papéis, mensalistas, configuração padrão, plano. Schema `groups` (grupos, membros, convites) e autorização por grupo desde a E3.2 ([ADR 0040](adr/0040-grupos-membros-papeis-e-autorizacao.md)); catálogo e resolver da configuração no domínio desde a E3.3 ([ADR 0041](adr/0041-configuracao-herdada-e-modelos.md)) | Agregado Group |
| Sessions | Presença, vagas, lista de espera, sorteio. Domínio das rodadas, da recorrência semanal e da presença desde a E3.4 ([ADR 0043](adr/0043-rodadas-presenca-e-espera.md), [rodadas.md](../dominio/rodadas.md)) | Agregado Round (`Session` no glossário) |
| Matches | Placar, fila, rotação, banco | Stream `CourtSession` com event sourcing ([ADR 0009](adr/0009-court-session-event-sourcing.md)) |
| Payments | Pix copia e cola, "já paguei", confirmação | CRUD |
| Summaries | Resumo da rodada com IA, com cota por grupo | Serviço |
| Stats | Estatísticas, MVP e rating OpenSkill ([ADR 0018](adr/0018-rating-and-mvp.md), [ADR 0047](adr/0047-nota-do-admin-e-rating-openskill.md)) | Projeções recalculáveis |

Fonte: `produto.md:257-266`. Cada módulo tem o próprio schema no Postgres e nunca lê tabelas de outro.

## Dependências permitidas

```
Sacou.Api  ->  Sacou.Modules.*  ->  Sacou.Http (ASP.NET)  ->  Sacou.Shared  ->  só BCL
```

- Um módulo só enxerga de outro o namespace `Sacou.Modules.<Outro>.Contracts`. Desde a E3.2, o Groups referencia o Identity e usa só `Identity.Contracts.ICurrentUser` (primeiro contrato, [ADR 0039](adr/0039-sacou-http-e-contratos-entre-modulos.md)); o Groups expõe `Groups.Contracts.IGroupMembership`.
- `Sacou.Http` (fora de `Sacou.Modules/`, não é módulo): `Result → ProblemDetails` e as regras de JSON dos corpos. Só referencia ASP.NET e `Sacou.Shared`; nenhum domínio pode usá-lo (ADR 0039).
- `Domain` só usa uma lista fechada de namespaces da BCL, `Sacou.Shared` e o próprio `Domain`.
- As regras são testes em `apps/api/tests/Sacou.Architecture.Tests`, provados contra violações plantadas em `Sacou.Architecture.Fixtures`.

## Onde fica cada coisa

| Local | Conteúdo |
|---|---|
| `src/Sacou.Api/` | Composição (`Program.cs`, `/health`) e, depois, Razor Pages |
| `src/Sacou.Shared/Results/` | `Result`, `Result<T>`, `Error`, `ErrorKind`. Namespace público novo exige ADR |
| `src/Sacou.Http/` | `ProblemResults`, `ToHttpResult`, `ApiJson` (ADR 0039) |
| `src/Sacou.Modules/<Module>/<Module>Module.cs` | Entrada pública: `AddXModule(IServiceCollection)` |
| `.../<Module>/Contracts/` | Única superfície pública para outros módulos |
| `.../<Module>/Domain/` | Domínio `internal`, sem infraestrutura |
| `.../<Module>/<Slice>/` | Fatia vertical `internal`: endpoint, request, handler, validação |
| `.../<Module>/Infrastructure/` | `DbContext` do módulo, mapeamentos, stores e `Migrations/` (geradas, `internal`), desde a E3.1 ([ADR 0037](adr/0037-persistencia-por-modulo-ef-core.md)) |
| `tests/Sacou.Modules.<Module>.Tests/<Slice>/` | Testes da fatia, criados com a primeira fatia |

Caminhos relativos a `apps/api/`. Pastas de módulo só existem quando têm conteúdo.

## Fluxos principais

**Confirmar presença pelo link.** Prévia no WhatsApp → página da rodada (Razor) → VOU → login via Firebase, uma vez → Sessions grava a presença e controla as vagas com `xmin` → Pix, se a cobrança estiver ligada. Promoção da espera sai pela Outbox e pelo Hangfire, em push (`produto.md:115, 308, 310`).

**Jogo na quadra.** O app aplica as regras em `match-engine` e grava os eventos em expo-sqlite, mesmo sem internet (`apps/mobile/src/features/court/`: o controlador simula o replay e só então grava; o estado da partida é o replay do log persistido, [ADR 0038](adr/0038-log-local-da-quadra.md)) → sincroniza evento a evento quando há sinal ([ADR 0046](adr/0046-escopo-do-piloto-e-papel-placar.md)), com reenvio idempotente; um celular escreve por vez, e o Placar, o Co-admin ou o Admin pode assumir a escrita → Matches aplica os eventos ao stream `CourtSession`, sem reimplementar a lógica → SignalR leva ao espectador (pós-piloto) → Stats recalcula as projeções ([ADR 0009](adr/0009-court-session-event-sourcing.md)).

**Entregar o placar.** QR na tela do admin → código de uso único troca por token só daquele stream → um celular escreve por vez → o admin pode retomar ([ADR 0013](adr/0013-scorekeeper-qr-token.md)).

**Cartinha.** Recorte no celular → upload do WebP sem EXIF para o R2 ([ADR 0016](adr/0016-player-card-photo.md)). Como o arquivo chega ao R2 está a definir na E3.14. **Pós-piloto** ([ADR 0046](adr/0046-escopo-do-piloto-e-papel-placar.md)): no piloto, a cartinha usa avatar.

**Planos.** Compra pelas lojas via RevenueCat → `IGroupPlan` e `IUserPlan` controlam o acesso ([ADR 0015](adr/0015-plans-and-billing.md)). Como a API recebe o estado está a definir na E3.15. **Pós-piloto** ([ADR 0046](adr/0046-escopo-do-piloto-e-papel-placar.md)): no piloto, o Pro é liberado.

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
| [0013](adr/0013-scorekeeper-qr-token.md) | Placar por QR com token por stream (substituído pelo 0046 no piloto) |
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
| [0030](adr/0030-correcoes-da-linha-do-tempo.md) | Correções: desfazer, voltar a um ponto, trocar sacador, girar e desgirar |
| [0031](adr/0031-ponto-individual.md) | Ponto individual: autor e tipo num evento à parte, lidos da linha do tempo |
| [0032](adr/0032-estatisticas-por-jogador.md) | Estatísticas por jogador: calculadas da linha do tempo, só das partidas terminadas |
| [0033](adr/0033-porte-csharp-do-motor.md) | Porte C# da função de estado: árvore própria de entrada, chave repetida recusada, golden compartilhados |
| [0034](adr/0034-estilos-e-temas-no-app.md) | Estilos, temas e escala no app: `StyleSheet` com `ThemeProvider` próprio, tokens escalados pela janela |
| [0035](adr/0035-portoes-de-qualidade.md) | Portões de qualidade: complexidade, tamanho, duplicação e regras do front na CI, exceções em `scripts/quality-exceptions.json` |
| [0036](adr/0036-verificacao-do-token-e-usuario.md) | Verificação do ID token do Firebase sem FirebaseAdmin, `User` mínimo, `POST /v1/me`, política de fallback e `ProblemDetails` |
| [0037](adr/0037-persistencia-por-modulo-ef-core.md) | Persistência por módulo com EF Core: `DbContext` e schema por módulo, migrações internas, primeiro login idempotente |
| [0038](adr/0038-log-local-da-quadra.md) | Log local da quadra: SQLite, esquema, `deviceId`, simular antes de gravar |
| [0039](adr/0039-sacou-http-e-contratos-entre-modulos.md) | `Result → ProblemDetails` no projeto `Sacou.Http`, regras de JSON e primeiro contrato entre módulos (`Identity.Contracts.ICurrentUser`) |
| [0040](adr/0040-grupos-membros-papeis-e-autorizacao.md) | Grupos: `MemberId`, papéis, permissões, autorização por grupo, convite e concorrência |
| [0041](adr/0041-configuracao-herdada-e-modelos.md) | Configuração herdada: catálogo JSON único, camadas parciais, resolver por folha, modelos e golden TS/C# |
| [0043](adr/0043-rodadas-presenca-e-espera.md) | Rodadas, recorrência semanal em fuso fixo, presença com espera por sequência, mensalista e avulso |
| [0045](adr/0045-por-que-fatias-verticais.md) | Por que fatias verticais no back-end, e não camadas técnicas |
| [0046](adr/0046-escopo-do-piloto-e-papel-placar.md) | Escopo do piloto, Placar assume a quadra e sincronização a cada ponto |
| [0047](adr/0047-nota-do-admin-e-rating-openskill.md) | Nota definida pelo admin e rating OpenSkill por partida, escondido no piloto |
| [0048](adr/0048-modos-de-fila-votacao-e-areia.md) | Modos de fila, votação do MVP e areia rei da quadra no MVP |
| [0049](adr/0049-ajustes-do-grupo-e-convite-no-app.md) | Ajustes do grupo salvos na hora, criar grupo e convite no app |
| [0050](adr/0050-modos-de-fila.md) | Modos de fila e "vencedor também sai" no planejador |
| [0051](adr/0051-perfil-do-jogador-e-nota-do-admin.md) | Perfil do jogador e nota do membro definida pelo admin |
| [0055](adr/0055-sorteio-no-servidor.md) | Sorteio equilibrado no servidor, com semente própria |
| [0058](adr/0058-repositorio-publico.md) | Repositório público, para a CI não ter limite de minutos |
| [0059](adr/0059-icone-do-app.md) | Ícone do app: silhueta sacando, azul-marinho sobre laranja |
| [0060](adr/0060-sincronizacao-do-stream-da-quadra.md) | Sincronização do stream da quadra: idempotência por `eventId`, lote do servidor, tetos, plausibilidade e membros do grupo |

## Matriz: `decisoes.md` → ADR

| Linha | Decisão | ADR |
|---|---|---|
| 7 | Nome, app nativo e página da rodada | 0008 |
| 8 | Configuração herdada e modelos | 0017, 0041 |
| 9 | Padrão de partida | 0017, 0041 |
| 10 | Membros e papéis | 0017, 0040 |
| 11 | Fila e saída parcial | 0017, 0029, 0048, 0050 |
| 12 | Rotação e modo de regra | 0010, 0006, 0021, 0024, 0026, 0027, 0028, 0030 |
| 13 | Banco no MVP | 0017, 0027 |
| 14 | Ponto individual | 0018, 0031 |
| 15 | MVP do dia | 0018, 0032 |
| 16 | Rating | 0018, 0047, 0051 |
| 17 | Faixas da cartinha | 0018 |
| 18 | Foto da cartinha | 0016 |
| 19 | Login | 0014, 0036 |
| 20 | Planos | 0015 |
| 21 | Placar assume a quadra (antes por QR) | 0013, 0046 |
| 25 | Back-end | 0008, 0005, 0045 |
| 26 | Event sourcing | 0009, 0022, 0023, 0024, 0026, 0027, 0028, 0029, 0030, 0031, 0032, 0033, 0038 |
| 27 | Padrões | 0011, 0029, 0035, 0039, 0040 |
| 28 | Dados pessoais | 0012, 0040 |
| 29 | App | 0008 |
| 30 | Monorepo | 0001 |
| 31 | Serviços | 0008; varredura na CI: 0007, ainda sem merge |
| 35 | Ciclo de agentes | 0019 |
| 36 | Merge automático | 0019, 0004 |
| 37 | Sessões contínuas | 0019 |
