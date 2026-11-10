---
name: bateria
description: Roda a bateria de verificação do Sacou (build, lint, testes e portões de qualidade) com saída resumida, para o desenvolvedor antes de entregar e para o testador e o revisor. Use com o argumento `api`, `app` ou `tudo`.
---

# Bateria de verificação

Regra 5 da "Economia de tokens" do `CLAUDE.md`: rode depois do **último commit** e só então entregue. Cada comando mostra só o fim da saída; se algum falhar, rode-o de novo sozinho para ver o erro inteiro.

## Ambiente (Git Bash)

```sh
export PATH="/d/tools/dotnet:$PATH" NUGET_PACKAGES=/d/tools/nuget-packages TEMP=/d/tmp TMP=/d/tmp
```

Em worktree que já tem `node_modules`, não rode `pnpm install` sem `--frozen-lockfile --store-dir /d/tmp/pnpm-store-<pasta>`, e **não rode `pnpm --offline <script>`**: os dois já dispararam um install que travou num prompt e apagou o `node_modules`. Se o `pnpm <script>` tentar instalar, rode a ferramenta direto: `node scripts/<script>.mjs`, `node_modules/.bin/vitest run`, `node_modules/.bin/eslint`, `node_modules/.bin/tsc`.

## `api` (C#)

```sh
dotnet build 2>&1 | tail -3
dotnet test 2>&1 | tail -5
pnpm lint:api 2>&1 | tail -3
pnpm check:size && pnpm check:duplication && pnpm format:check && pnpm check:eol
```

Integração com Postgres real (Docker ligado), filtrando pelo que a tarefa toca, por exemplo `--filter-namespace Sacou.Integration.Tests.Groups`:

```sh
dotnet test --project apps/api/tests/Sacou.Integration.Tests --filter-namespace <namespace> 2>&1 | tail -5
```

Pacote NuGet novo: também `pnpm audit:api`.

## `app` (TS e Expo)

```sh
pnpm build 2>&1 | tail -3
pnpm typecheck 2>&1 | tail -3
pnpm test 2>&1 | tail -5
pnpm lint 2>&1 | tail -3
pnpm lint:regression 2>&1 | tail -2
pnpm check:duplication && pnpm format:check && pnpm check:eol
```

Mudou `scripts/`: também `pnpm test:tooling`. Dependência nova: também `pnpm audit --audit-level high`.

## `tudo`

As duas seções acima.

## Depois

Espere a CI do PR: `gh pr checks <número> --watch --interval 20 >/dev/null; gh pr checks <número>`. No relatório, uma linha por comando com o resultado (por exemplo "dotnet test: 3329, 0 falhas").
