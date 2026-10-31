# Progresso

**Marco atual:** M1 · Fundação

| Tarefa | Status | Observação |
|---|---|---|
| E0.1 | Feita | Plano em `docs/estado/tarefas/E0.1.md`; decisões no ADR 0001. Aprovada no ciclo 2 de revisão. Validação em Linux fica para a CI (E0.4). |
| E0.3 | Feita | Plano em `docs/estado/tarefas/E0.3.md`; decisões no ADR 0002. Aprovada na 3ª revisão. Testador validou `7cd507e`; o commit final `807dbe8` (docs e bloqueio de JS no app) teve lint e regressão rodados pelo desenvolvedor. |
| E0.4 | Em andamento | Análise. |
| E0.5 | Feita | `docs/backlog.md` enxuto por decisão do Gabriel; ADR 0003. Aprovada na 4ª revisão. |
| E0.8 | Em andamento | Análise. |
| E0.2 | Em andamento | Implementação na branch `task/E0.2-dotnet-solution`, a partir da E0.3. |
| E1.1 | Em andamento | Implementação na branch `task/E1.1-formations`, a partir da E0.3. |

## Adiadas

- E0.7: tarefa agendada. Adiada pelo Gabriel em 30/10/2026: por enquanto as sessões são abertas manualmente.

## Pendências herdadas

- E0.4: validar em Ubuntu o que só foi validado no Windows (`expo export` com Hermes, `pnpm test`, `dotnet build`, `dotnet test`). Rodar sempre `pnpm install --frozen-lockfile` antes do Turbo: editar o `pnpm-lock.yaml` sem reinstalar não invalida o cache.
- Lint, lacunas que não violam o aceite da E0.3: `Reflect.get(globalThis, "fetch")` passa na pureza; `*.test.ts` importado por código de produção vai para o `dist`; `scripts/lint-regression.mjs` não tem casos para `functional/immutable-data`, `prefer-readonly` e `no-param-reassign` (as regras funcionam, só a regressão não as cobre).
- Rodar `pnpm lint:regression` na CI em etapa sequencial (conflita com `tsc` e Vitest em paralelo).
- E4.1: validar cedo o Unistyles com React Native 0.88 (sem confirmação nas fontes).

## Bloqueadas

Nenhuma.
