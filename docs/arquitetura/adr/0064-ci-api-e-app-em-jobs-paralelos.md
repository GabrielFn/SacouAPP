# ADR 0064 · CI com a API e o app em jobs paralelos

**Status:** aceito (17/11/2026). **Decidido por:** Gabriel (pedido de separar back e front). Substitui o "job `verify` único e sequencial" e a recusa de jobs paralelos do [ADR 0004](0004-ci-github-actions.md).

## Contexto

O `verify` rodava a API e o app em sequência (8 a 10 minutos), pulando só os passos da API em PR só do app. O repositório agora é público ([ADR 0058](0058-repositorio-publico.md)), então jobs paralelos não custam minutos. O motivo antigo contra paralelo, o conflito do `lint:regression` com `tsc` e Vitest, só existe dentro do lado do app, que continua sequencial.

## Decisão

`scripts/lib/ci-areas.mjs` (testado no `test:tooling`) emite três saídas:

- `code=false` só quando todo arquivo está em `docs/` e fora de `docs/dominio/`.
- `api=false` só quando todo arquivo de código está em `apps/mobile/`.
- `app=false` só quando todo arquivo de código está em `apps/api/` e fora de `apps/api/openapi/` (o contrato gera os tipos do app).
- Qualquer outro arquivo liga as duas áreas: `packages/` e o JSON compartilhado (formações, golden), arquivos da raiz, `scripts/`, `.github/`, `docs/dominio/`. Diff vazio ou com falha liga tudo.

Jobs, todos dependendo só de `changes`:

- `common` (`code=true`): `format:check`, `check:duplication`, `test:tooling`, auditoria npm.
- `verify-api` (`api != 'false'`): .NET e Node (os scripts de contrato e de auditoria são `.mjs`). `lint:api`, `lint:regression:api` (a sonda do CA1502, que prova as regras do .NET mesmo em PR só da API), `check:size`, `check:api-compat`, build, testes, integração, Ryuk, Postgres e auditoria NuGet.
- `verify-app` (`app != 'false'`): lint, `lint:regression` (que repete a sonda do `dotnet`, por isso o .NET está instalado), build, `check:api-types`, typecheck e testes.
- `changes` segue com `check:eol`; `secrets` (gitleaks) segue sempre, sem `needs`.
- `ci-ok` exige `changes` e `secrets` em `success`; `common`, `verify-api` e `verify-app` em `success`, ou `skipped` só quando a saída da sua área é `false`. Qualquer outro resultado, cancelado inclusive, reprova. Continua sendo o único check obrigatório.

## Consequências

- O tempo total passa a ser o do job mais lento, não a soma.
- `check:api-types` ficou no `verify-app` (e o contrato liga o app): um `v1.json` alterado confere os tipos gerados, e tipos editados à mão no app também são conferidos.
- Cada job instala as dependências por conta própria; o custo extra é a instalação (cache do pnpm).
- A regra "erro ou saída ausente roda tudo" vale para os três jobs; a regra de arquitetura que proíbe `outputs.api ==` segue valendo.
