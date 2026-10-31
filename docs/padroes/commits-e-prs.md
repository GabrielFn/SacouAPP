# Commits, branches e merge

- **Commits:** em inglês, no imperativo, em [Conventional Commits](https://www.conventionalcommits.org/): `<tipo>[(escopo)]: <descrição>`. Tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `build`, `ci`, `chore`. Sem segredos. O histórico anterior a esta regra não foi reescrito.
- **Branches:** uma por tarefa, `task/<ID>-<slug>`. Tarefas independentes em paralelo usam worktrees.
- **PR:** o título segue o mesmo formato e a descrição cita o ID da tarefa. Toda tarefa entra na `main` por PR, depois do ciclo de agentes descrito no `CLAUDE.md`. Não há proteção de branch: a rotina abaixo é a barreira (ADR 0004).

## Rotina de merge do orquestrador

1. Esperar a CI: `gh pr checks <n> --watch`.
2. Conferir o resultado: `gh pr checks <n> --json name,bucket`. A lista precisa vir **não vazia**, com tudo em `pass` ou `skipping`.
   - `fail` e `cancel` reprovam.
   - `skipping` só vale com `changes` em `pass`.
   - Comando com erro ou sem checks (PR recém-aberto) não é aprovação: esperar e repetir.
3. Fazer o merge fixando o commit conferido: `gh pr merge <n> --squash --subject "<título do PR>" --match-head-commit <sha conferido>`. O squash deixa um commit por tarefa na `main`, com o título em Conventional Commits, e o `--match-head-commit` barra commit chegado depois da conferência.

`main` vermelha depois de um merge passa à frente das demais tarefas.
