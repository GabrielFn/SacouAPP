# ADR 0019 · Processo de agentes e merge automático

**Status:** aceito (decidido em 30/10/2026, registrado em 31/10/2026). **Tarefa:** E0.8.

**Fontes:** `decisoes.md:35-37`; `perguntas.md:12, 15`; `plano-mvp.md:10, 94`. Regras completas no `CLAUDE.md`; rotina de merge em [`commits-e-prs.md`](../../padroes/commits-e-prs.md); CI no [ADR 0004](0004-ci-github-actions.md).

## Decisão

- **Ciclo:** analista → desenvolvedor → revisor (novo) → revisor de segurança, nas tarefas sensíveis → testador (novo) → merge.
- **Merge automático** na `main` quando revisão e testes passam. O repositório é privado e grátis, sem proteção de branch: o orquestrador confere a CI verde antes do merge.
- **Sessões contínuas,** rodadas manualmente quando o Gabriel quiser.
- **Commits e títulos de PR** em Conventional Commits (`commits-e-prs.md`).

## Conflitos entre as fontes

**Tarefa agendada** a cada 4 horas (`plano-mvp.md:10`) ou diária (E0.7, `plano-mvp.md:94`): vale `decisoes.md:37`, com sessões manuais e E0.7 para depois (`perguntas.md:15`). O plano só muda quando a E0.7 for retomada.

## Alternativas

Proteção de branch: recusada pelo Gabriel (ADR 0004).

## Consequências

Os riscos de merge fora da rotina estão no ADR 0004.
