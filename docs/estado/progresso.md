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
| E0.9 | Feita | PR #13 (`6eb61cf`), ADR 0007. Revisor, revisor de segurança e sonda de merge real aprovados. Exceção do `zod` aprovada pelo Gabriel até 31/01/2027. |
| E0.8 | Feita | PR #15; ADRs 0008–0019, glossário, ameaças, LGPD, segredos e checklist. O checklist segue todo pendente: não há código sensível ainda. |
| E0.6 | Bloqueada | Branch `task/E0.6-local-postgres`, ainda sem código. Parada no portão de procedência: `postgres.exe` sem assinatura (`perguntas.md`, item 5). Ver o diário de 01/11. |

## Adiantadas do M2

E1.2, E1.3, E1.4 e E2.1 têm plano pronto em `docs/estado/tarefas/`. Implementadas em branches, só entram na `main` depois da revisão geral de segurança e do relatório do M1. Retomar conforme houver vaga: **no máximo 1 agente de cada função por vez**, decisão do Gabriel (`docs/decisoes.md`).

## Adiadas

- E0.7: tarefa agendada. Adiada pelo Gabriel em 30/10/2026: por enquanto as sessões são abertas manualmente.

## Pendências herdadas

- Lint, lacunas que não violam o aceite da E0.3: `Reflect.get(globalThis, "fetch")` passa na pureza; `*.test.ts` importado por código de produção vai para o `dist`; `scripts/lint-regression.mjs` não tem casos para `functional/immutable-data`, `prefer-readonly` e `no-param-reassign` (as regras funcionam, só a regressão não as cobre).
- CI: rodar sempre `pnpm install --frozen-lockfile` antes do Turbo: editar o `pnpm-lock.yaml` sem reinstalar não invalida o cache.
- E0.9, achado não bloqueante do revisor de segurança: `catalog:<nome>` passa pela checagem de `zod`; reprovar qualquer spec diferente de `catalog:` exato. Levar à revisão geral de segurança do M1.
- E2.4: em `serving`, `liberoReplaces` não significa líbero em quadra (ADR 0006).
- Revisão geral de segurança do M1: `modelo-de-ameacas.md`, seção 10, cobre só segredo em commit: faltam cadeia de suprimentos (actions, dependências, `zod`) e abuso do workflow. `dados-pessoais.md` não lista IP e logs de acesso (E5.2 ou E6.2).
- E1.2: incluir a relação `CourtPosition`/`RotationSlot` e o nome do modo de regra, delegados pelo ADR 0010 e pelo glossário.
- E4.1: validar cedo o Unistyles com React Native 0.88 (sem confirmação nas fontes).

## Lembretes para o Gabriel

- Internacionalização: citar no relatório do marco, até ele decidir quando entra (`docs/ideias.md`).

## Bloqueadas

- E0.6: aguarda o Gabriel (`perguntas.md`, item 5). Sem ela, o M1 não fecha.
