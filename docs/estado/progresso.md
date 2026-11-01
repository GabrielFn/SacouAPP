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
| E0.6 | Em andamento | Branch `task/E0.6-local-postgres`, plano revisado para Docker Desktop e Testcontainers. Falta implementar. |
| Revisão geral de segurança do M1 | Feita | Aprovada com condições, sem a E0.6 ([parecer](../seguranca/revisoes/M1-2026-11-01.md)). Falta o complemento da E0.6. |
| SEC-M1 | Planejada | Correções de A1, A2 (lockfile), A3 e B1. Entra antes das adiantadas do M2. |

## Adiantadas do M2

E1.2, E1.3, E1.4 e E2.1 têm plano pronto em `docs/estado/tarefas/`. Implementadas em branches, só entram na `main` depois da revisão geral de segurança e do relatório do M1. Retomar conforme houver vaga: **no máximo 1 agente de cada função por vez**, decisão do Gabriel (`docs/decisoes.md`).

E1.2 em andamento: branch `task/E1.2-overlap-validator`. Volta ao desenvolvedor para aceitar empate lateral (FIVB 7.4.3.2), decisão do Gabriel.

## Adiadas

- E0.7: tarefa agendada. Adiada pelo Gabriel em 30/10/2026: por enquanto as sessões são abertas manualmente.

## Pendências herdadas

- Lint, lacunas que não violam o aceite da E0.3: `Reflect.get(globalThis, "fetch")` passa na pureza; `*.test.ts` importado por código de produção vai para o `dist`; `scripts/lint-regression.mjs` não tem casos para `functional/immutable-data`, `prefer-readonly` e `no-param-reassign` (as regras funcionam, só a regressão não as cobre).
- CI: rodar sempre `pnpm install --frozen-lockfile` antes do Turbo: editar o `pnpm-lock.yaml` sem reinstalar não invalida o cache.
- E2.4: em `serving`, `liberoReplaces` não significa líbero em quadra (ADR 0006).
- Revisão do M1, A4: a E2.1 só entra na `main` com teste de esquema fechado do envelope e nomes proibidos; a regra em C#, por reflexão, fica na E2.10 ou E3.7.
- Revisão do M1, B3 e B4: lockfile e mapeamento de fontes do NuGet antes do primeiro pacote de produção; estreitar os namespaces permitidos antes do primeiro código de domínio em C#.
- Revisão do M1, B5: trocar o e-mail realista de `design/telas/Conta.dc.html:42`; sem Google Fonts na página web da E3.12.
- E1.2: incluir a relação `CourtPosition`/`RotationSlot` e o nome do modo de regra, delegados pelo ADR 0010 e pelo glossário.
- E4.1: validar cedo o Unistyles com React Native 0.88 (sem confirmação nas fontes).

## Lembretes para o Gabriel

- Internacionalização: citar no relatório do marco, até ele decidir quando entra (`docs/ideias.md`).

## Bloqueadas

Nenhuma.
