# Commits, branches e merge

## Commits

- Em inglês, no imperativo, sem prefixo (`feat:`, `fix:`), como no histórico: `Set up pnpm and Turborepo monorepo with Expo app and .NET API`.
- Linha de assunto curta, com o porquê no corpo quando não for óbvio.
- Mudança só mecânica (formatação em massa) vai em commit próprio.
- Sem segredos, nunca. A lista de nomes está em `docs/seguranca/segredos.md`.
- Commit feito por agente termina com a linha `Co-Authored-By` indicada na sessão.

## Branches

- Uma por tarefa do backlog: `task/<ID>-<slug>`, por exemplo `task/E0.3-code-standards`.
- Saem da `main`. Tarefas em paralelo usam worktrees.

## Merge

- Na `main`, com `git merge --no-ff`, assunto `Merge task/<ID>-<slug>: <resumo>`.
- Só depois do ciclo do `CLAUDE.md`: analista, desenvolvedor, revisor, revisor de segurança (tarefas sensíveis) e testador.
- Revisão ou testes falharam: volta ao desenvolvedor. Três ciclos falhando: para e pergunta ao Gabriel.
