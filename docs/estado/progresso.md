# Progresso

**Marco atual:** M1 · Fundação

| Tarefa | Status | Observação |
|---|---|---|
| E0.1 | Feita | Plano em `docs/estado/tarefas/E0.1.md`; decisões no ADR 0001. Aprovada no ciclo 2 de revisão. |
| E0.3 | Feita | Plano em `docs/estado/tarefas/E0.3.md`; decisões no ADR 0002. Aprovada na 3ª revisão. Testador validou `7cd507e`; o commit final `807dbe8` (docs e bloqueio de JS no app) teve lint e regressão rodados pelo desenvolvedor. |
| E0.4 | Feita | PR #1; decisões no ADR 0004. Aprovada no ciclo 2 de revisão. Sondas reais: `ci-ok` passa em PR só de docs e reprova com falha plantada. |
| E0.5 | Feita | `docs/backlog.md` enxuto por decisão do Gabriel; ADR 0003. Aprovada na 4ª revisão. |
| E1.1 | Feita | PR #7; decisões no ADR 0006. Comparação independente: 168 coordenadas, 0 diferenças do explorador. |
| E0.2 | Feita | PR #8; decisões no ADR 0005. Testes de arquitetura reprovam cada violação plantada. Aprovada no 3º ciclo de testes. |
| E0.9 | Em andamento | PR #13, ADR 0007. Revisor aprovou e testador passou; faltam o revisor de segurança e a decisão do Gabriel sobre o `zod` (`perguntas.md`). |
| E0.8 | Em andamento | Implementação na branch `task/E0.8-knowledge-base`. ADRs novos começam em 0008. |
| E0.6 | Em andamento | Análise. |

## Adiantadas do M2

O Gabriel pediu mais agentes em paralelo. E1.2, E1.3, E1.4 e E2.1 estão em análise e podem ser implementadas em branches, mas só entram na `main` depois da revisão geral de segurança e do relatório do M1.

## Adiadas

- E0.7: tarefa agendada. Adiada pelo Gabriel em 30/10/2026: por enquanto as sessões são abertas manualmente.

## Pendências herdadas

- Lint, lacunas que não violam o aceite da E0.3: `Reflect.get(globalThis, "fetch")` passa na pureza; `*.test.ts` importado por código de produção vai para o `dist`; `scripts/lint-regression.mjs` não tem casos para `functional/immutable-data`, `prefer-readonly` e `no-param-reassign` (as regras funcionam, só a regressão não as cobre).
- CI: rodar sempre `pnpm install --frozen-lockfile` antes do Turbo: editar o `pnpm-lock.yaml` sem reinstalar não invalida o cache.
- `.claude/agents/testador.md:9` cita `formacoes.json` sem o caminho novo depois da E1.1: atualizar a definição do agente com o Gabriel ciente.
- E2.4: em `serving`, `liberoReplaces` não significa líbero em quadra (ADR 0006).
- E4.1: validar cedo o Unistyles com React Native 0.88 (sem confirmação nas fontes).

## Lembretes para o Gabriel

- Internacionalização: citar no relatório do marco, até ele decidir quando entra (`docs/ideias.md`).

## Bloqueadas

Nenhuma.
