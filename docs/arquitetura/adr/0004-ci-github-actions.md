# ADR 0004 · CI no GitHub Actions

**Status:** aceito (30/10/2026). Substitui o ADR 0003. **Tarefa:** E0.4. **Decidido por:** orquestrador; a ausência de proteção de branch é decisão do Gabriel.

## Contexto

A definição de pronto exige CI verde. O repositório é privado, com cota limitada de minutos, e sem proteção de branch. As tarefas até aqui só tinham sido validadas no Windows (ADR 0003).

## Decisão

- **Workflow único**, `.github/workflows/ci.yml`, em Ubuntu, com `permissions: contents: read`, sem segredos, actions fixadas por SHA de commit e versões lidas de `packageManager`, `.nvmrc` e `global.json`.
- **Gatilhos:** `pull_request` e `push` na `main`. O push existe porque o cache de um PR só serve a ele mesmo: só o da `main` chega aos outros PRs. Ele também pega quebra causada por merges paralelos. Execução nova cancela a anterior só em PR.
- **Filtro no job `changes`, sem `paths-ignore`,** que deixaria o PR sem check nenhum. O `verify` é pulado só se todos os arquivos estiverem em `docs/` e fora de `docs/dominio/`, porque testes leem arquivos de lá. Diff vazio ou com erro roda tudo. O `changes` roda `check:eol`, que também olha `docs/`.
- **Job `verify` único e sequencial,** sem `continue-on-error`: `lint:regression` conflita com `tsc` e Vitest em paralelo.
- **Job final `ci-ok`,** com `if: always()`: passa só se `changes` passou e `verify` passou ou foi pulado com `code=false`. Qualquer outro resultado, inclusive cancelado, reprova. Assim a rotina olha um único check, que não fica ambíguo quando o `verify` é pulado.
- **Rotina de merge em `docs/padroes/commits-e-prs.md`:** ler o SHA com `gh pr view`, exigir `ci-ok` presente e em `pass` em `gh pr checks`, depois `gh pr merge --match-head-commit` com esse SHA.

## Alternativas

- **Proteção de branch:** recusada pelo Gabriel. O aceite "PR só entra com CI verde" é regra de processo.
- **`paths-ignore`:** PR só de docs ficaria sem check, e a rotina não distinguiria isso de CI que não rodou.
- **`cache: true` do `setup-dotnet`:** exige `packages.lock.json`, que o repositório não tem. O NuGet usa `actions/cache`.
- **Jobs paralelos:** gastam mais minutos, porque cada job arredonda para cima, e reabrem o conflito do `lint:regression`.

## Consequências

- Push direto ou `gh pr merge` fora da rotina ainda entram na `main`; o `push` na `main` ao menos revela o erro depois.
- O verde pode estar defasado se a `main` andou entre a execução e o merge; o `push` na `main` pega a quebra.
- O cache do Turbo pode esconder falha quando um arquivo de fora do pacote não está declarado (ADR 0001). Em falha suspeita, reexecutar sem restaurar o cache.
- Cada merge gera mais uma execução. Se o consumo passar de 2000 min/mês no ritmo atual, restringir o `push` na `main` e registrar aqui.

## Consumo medido

Primeira execução, com cache frio, no PR da E0.4 (`changes` 6 s, `verify` 1 min 28 s; cerca de 1 min 40 s do início ao fim). Com o arredondamento por job e o `ci-ok`, acrescentado depois dessa medição, são **4 min cobrados** por execução com código; um PR só de docs gasta 2 min. Cada merge soma uma execução de `push` na `main`, então uma tarefa com um push no PR gasta cerca de 8 min. Para chegar a 2000 min/mês seriam 250 tarefas por mês.

## Prova em Linux

A primeira execução em Ubuntu passou sem nenhum ajuste no código: `expo export` gerou o bundle Hermes (`.hbc`), e Vitest, `lint:regression`, `dotnet build`, `dotnet format` e `dotnet test` passaram.

Sem checks ainda (PR recém-aberto), `gh pr checks` sai com código 1 e a mensagem `no checks reported`, mesmo com `--json`. A rotina trata isso como não aprovado.
