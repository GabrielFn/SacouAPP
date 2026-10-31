# Progresso

**Marco atual:** M1 · Fundação

| Tarefa | Status | Observação |
|---|---|---|
| E0.1 | Feita | Plano em `docs/estado/tarefas/E0.1.md`; decisões no ADR 0001. Aprovada no ciclo 2 de revisão. |
| E0.3 | Feita | Plano em `docs/estado/tarefas/E0.3.md`; decisões no ADR 0002. Aprovada na 3ª revisão. Testador validou `7cd507e`; o commit final `807dbe8` (docs e bloqueio de JS no app) teve lint e regressão rodados pelo desenvolvedor. |
| E0.4 | Feita | PR #1; decisões no ADR 0004. Aprovada no ciclo 2 de revisão. Sondas reais: `ci-ok` passa em PR só de docs e reprova com falha plantada. |
| E0.5 | Feita | `docs/backlog.md` enxuto por decisão do Gabriel; ADR 0003. Aprovada na 4ª revisão. |
| E0.2 | Em andamento | Revisor aprovou `3edd16a`; falta o testador. Branch `task/E0.2-dotnet-solution`. ADR 0005. |
| E1.1 | Em andamento | Em revisão e testes. Branch `task/E1.1-formations`. O ADR dela muda de 0004 para 0006 (a E0.4 ficou com o 0004). |
| E0.8 | Em andamento | Plano pronto; implementação depois do merge da E0.2 e da E1.1, por causa da numeração de ADRs e da `visao-geral.md`. ADRs novos começam em 0007. |
| E0.9 | Em andamento | Análise. |

## Adiadas

- E0.7: tarefa agendada. Adiada pelo Gabriel em 30/10/2026: por enquanto as sessões são abertas manualmente.

## Pendências herdadas

- Lint, lacunas que não violam o aceite da E0.3: `Reflect.get(globalThis, "fetch")` passa na pureza; `*.test.ts` importado por código de produção vai para o `dist`; `scripts/lint-regression.mjs` não tem casos para `functional/immutable-data`, `prefer-readonly` e `no-param-reassign` (as regras funcionam, só a regressão não as cobre).
- CI: rodar sempre `pnpm install --frozen-lockfile` antes do Turbo: editar o `pnpm-lock.yaml` sem reinstalar não invalida o cache.
- `.claude/agents/testador.md:9` cita `formacoes.json` sem o caminho novo depois da E1.1: atualizar a definição do agente com o Gabriel ciente.
- E4.1: validar cedo o Unistyles com React Native 0.88 (sem confirmação nas fontes).

## Bloqueadas

Nenhuma.
