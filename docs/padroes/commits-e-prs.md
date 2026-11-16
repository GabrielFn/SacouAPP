# Commits, branches e merge

- **Commits:** em inglês, no imperativo, em [Conventional Commits](https://www.conventionalcommits.org/): `<tipo>[(escopo)]: <descrição>`. Tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `build`, `ci`, `chore`. Sem segredos. O histórico anterior a esta regra não foi reescrito.
- **Branches:** uma por tarefa, `task/<ID>-<slug>`. Tarefas independentes em paralelo usam worktrees.
- **PR:** o título segue o mesmo formato e a descrição cita o ID da tarefa. Toda tarefa entra na `main` por PR, depois do ciclo de agentes descrito no `CLAUDE.md`. Não há proteção de branch: a rotina abaixo é a barreira (ADR 0004).

## Rotina de merge do orquestrador

1. Ler o SHA antes dos checks: `gh pr view <n> --json headRefOid`.
2. Esperar a CI: `gh pr checks <n> --watch`.
3. Conferir o resultado: `gh pr checks <n> --json name,bucket`. O check `ci-ok` precisa estar presente e em `pass`; é o único que a rotina olha, porque ele já resume `changes`, `secrets` e `verify`.
   - Lista sem `ci-ok`, comando com erro ou sem checks (PR recém-aberto) não é aprovação: esperar e repetir.
   - Qualquer outro estado de `ci-ok` (`fail`, `cancel`, `pending`, `skipping`) reprova.
4. Fazer o merge fixando o SHA lido no passo 1: `gh pr merge <n> --squash --subject "<título do PR>" --match-head-commit <sha conferido>`. O squash deixa um commit por tarefa na `main`, com o título em Conventional Commits, e o `--match-head-commit` barra commit chegado depois da conferência.

`main` vermelha depois de um merge passa à frente das demais tarefas.

## Leitura obrigatória do revisor

Sem proteção de branch, um PR pode alterar a própria barreira, e a CI verde não prova nada sobre isso. O diff que tocar qualquer item abaixo exige leitura explícita do revisor, citada no parecer (`docs/seguranca/varredura-ci.md`):

- **CI:** qualquer arquivo em `.github/workflows/`, inclusive novo, e `scripts/ci-areas.mjs` com `scripts/lib/ci-areas.mjs` (decidem o que o `verify` pula).
- **Varredura:** `.gitleaks.toml`, `.gitleaksignore`, `scripts/check-dotnet-audit.mjs`, `scripts/lib/*` e os scripts `audit:api` e `test:tooling` do `package.json`.
- **Exceções:** `scripts/nuget-audit-exceptions.json`, `scripts/npm-audit-exceptions.json` e `NuGetAuditSuppress`.
- **Dependências:** `audit.ignore`, `overrides` e `allowBuilds` em `pnpm-workspace.yaml`; `pnpm-lock.yaml` (fonte dos pacotes), `.npmrc`, `nuget.config` e `packages.lock.json`.
- **Build:** `NuGetAudit*`, `RestoreLockedMode`, `RestorePackagesWithLockFile`, `NoWarn`, `WarningsNotAsErrors` e `AnalysisMode*` em `Directory.Build.props` ou em `.csproj`.
- **Ignorados:** `.gitignore`.
