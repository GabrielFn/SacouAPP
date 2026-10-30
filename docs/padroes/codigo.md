# Padrões de código

Regras de `CLAUDE.md`, separadas entre o que a ferramenta impõe e o que só o revisor confere. Decisões e motivos no [ADR 0002](../arquitetura/adr/0002-padroes-e-lint.md).

## Comandos

| Comando | Faz |
|---|---|
| `pnpm lint` | ESLint em pacotes e app, `--max-warnings 0`. Compila os pacotes antes, porque o lint com tipos lê `dist/*.d.ts` |
| `pnpm format` / `pnpm format:check` | Prettier (corrige / só verifica) |
| `pnpm check:eol` | Falha se houver arquivo de texto com CRLF **no índice do Git** |
| `pnpm lint:api` | `dotnet build` (analisadores) e `dotnet format --verify-no-changes` |
| `pnpm format:api` | `dotnet format` |

## Imposto por ferramenta: TypeScript

| Regra | Como | Exceções |
|---|---|---|
| Sem `any` | `strictTypeChecked`, `no-explicit-any`, `no-unsafe-*`. Diretiva `eslint-disable` sem uso reprova | Nenhuma |
| Sem número mágico | `@typescript-eslint/no-magic-numbers`. Liberados `-1`, `0`, `1`, valor de `const` nomeado, enum, tipo literal, campo `readonly`, índice de array, valor em objeto | Testes, `**/golden/**`, `**/*.data.ts` |
| Imutabilidade | `prefer-const`, `no-param-reassign`, `functional/no-let`, `functional/immutable-data`, `prefer-readonly` | Testes não usam `functional/*`. No app, `.current` e `.value` (refs, Reanimated) podem receber atribuição |
| Pacotes puros | Em `packages/{match-engine,volley-rules}/src`: sem React, Expo, React Native, módulos do Node, `import()` nem `window`, `document`, `navigator`, `localStorage`, `fetch`, `process`, `Buffer`. `volley-rules` não importa `match-engine` | Testes podem usar `node:*` (golden lê JSON) |
| TS strict | `tsconfig.base.json` (`pnpm typecheck`) | Nenhuma |

## Imposto por ferramenta: C#

| Regra | Como | Exceções |
|---|---|---|
| Nullable e avisos como erro | `Directory.Build.props` | Nenhuma |
| Analisadores | `AnalysisLevel=10.0-recommended`, fixo para patch do SDK não criar aviso novo | `CA1707` e `CA1515` desligadas só em `apps/api/tests` |
| Estilo no build | `EnforceCodeStyleInBuild` com IDE0005, IDE0044, IDE0051, IDE0052, IDE0055, IDE0059, IDE0161 e CA2227 como `warning` | Nenhuma |
| Sem MediatR e AutoMapper | `Directory.Build.targets` reprova o build se a referência resolvida, direta ou transitiva, tiver esses nomes | Nenhuma |

## Supressões

Corrija a causa. Quando não der, a supressão fica na menor abrangência possível (uma linha, uma regra) e com o motivo no próprio comentário. Regra que gera ruído em código legítimo se ajusta na configuração, com registro no ADR 0002, em vez de `eslint-disable` espalhado. Nunca desligue uma categoria inteira de analisadores.

## Fim de linha e formatação

- O `.gitattributes` é a autoridade: tudo entra no índice em LF. `pnpm check:eol` confere e ignora o estado do disco.
- `.editorconfig` e Prettier fixam LF, para o `dotnet format` não usar o padrão do sistema.
- O Prettier não formata `design/`, `docs/`, `.claude/`, Markdown, `pnpm-lock.yaml` nem `apps/api/`.
- Arquivo de código salvo com CRLF falha no `format:check`; `pnpm format` corrige. Não rode `git reset --hard` para normalizar um checkout.

## Só o revisor confere

- Número mágico em C#: não há regra nativa, e o S109 traria o SonarAnalyzer com muito ruído.
- Nomes do glossário, funções pequenas, DDD enxuto e fatias verticais; domínio sem infraestrutura no C#.
- Result pattern em vez de exceção para regra de negócio.
- Eventos sem dado pessoal; tudo aponta para `MemberId`.
- Comentários e nomes em inglês; textos de interface em pt-BR, centralizados em `apps/mobile/src/strings/`.
- Telas iguais ao design, toque ≥ 44 px, contraste AA.
- Imutabilidade no C# além de IDE0044 e CA2227 (por exemplo, `record` e coleções somente leitura no domínio).
