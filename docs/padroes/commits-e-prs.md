# Commits, branches e merge

- **Commits:** em inglês, no imperativo, sem prefixo (`feat:`, `fix:`), como no histórico. Sem segredos.
- **Branches:** uma por tarefa, `task/<ID>-<slug>`. Tarefas independentes em paralelo usam worktrees.
- **PR:** toda tarefa entra na `main` por PR, depois do ciclo de agentes descrito no `CLAUDE.md`. Não há proteção de branch: a rotina abaixo é a barreira (ADR 0004).

## Rotina de merge do orquestrador

1. Esperar a CI: `gh pr checks <n> --watch`.
2. Conferir o resultado: `gh pr checks <n> --json name,bucket`. A lista precisa vir **não vazia**, com tudo em `pass` ou `skipping`.
   - `fail` e `cancel` reprovam.
   - `skipping` só vale com `changes` em `pass`.
   - Comando com erro ou sem checks (PR recém-aberto) não é aprovação: esperar e repetir.
3. Fazer o merge fixando o commit conferido: `gh pr merge <n> --merge --match-head-commit <sha conferido>`. Isso preserva o `--no-ff` e barra commit chegado depois da conferência.

`main` vermelha depois de um merge passa à frente das demais tarefas.
