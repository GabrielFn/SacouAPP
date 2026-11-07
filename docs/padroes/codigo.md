# Padrões de código

Regras de `CLAUDE.md`, separadas entre o que a ferramenta impõe e o que só o revisor confere. Decisões e motivos no [ADR 0002](../arquitetura/adr/0002-padroes-e-lint.md).

## Comandos

| Comando | Faz |
|---|---|
| `pnpm lint` | ESLint em pacotes, app, `scripts/` e `eslint.config.mjs`, `--max-warnings 0`. Compila os pacotes antes, porque o lint com tipos lê `dist/*.d.ts` |
| `pnpm lint:regression` | Confirma que as regras ainda reprovam os desvios conhecidos e aceitam o código legítimo (`scripts/lint-regression.mjs`). Regra nova ou furo novo ganha um caso ali |
| `pnpm format` / `pnpm format:check` | Prettier (corrige / só verifica) |
| `pnpm check:eol` | Falha se houver arquivo de texto com CRLF **no índice do Git** |
| `pnpm lint:api` | `dotnet build` (analisadores) e `dotnet format --verify-no-changes` |
| `pnpm format:api` | `dotnet format` |

## Imposto por ferramenta: TypeScript

| Regra | Como | Exceções |
|---|---|---|
| Sem `any` | `strictTypeChecked`, `no-explicit-any`, `no-unsafe-*`, em `.ts`, `.tsx`, `.mts` e `.cts` | Nenhuma |
| Sem número mágico | `@typescript-eslint/no-magic-numbers`. Liberados `-1`, `0`, `1`, valor de `const` nomeado, enum, tipo literal, campo `readonly`, índice de array, valor em objeto | Testes e `*.data.ts`, que não pode ter função |
| Sem supressão no código | `noInlineConfig`: `eslint-disable` e `/* eslint regra: "off" */` não têm efeito e geram aviso, que reprova | Nenhuma. Ver "Supressões" |
| Imutabilidade | `prefer-const`, `no-param-reassign`, `functional/no-let`, `functional/immutable-data`, `prefer-readonly` | Testes não usam `functional/*`. No app, `.current` e `.value` (refs, Reanimated) podem receber atribuição. `let` no `for` só em `match-engine/src/event-log/replay-events.ts`, e `budget.remaining` só em `parse-envelope.ts` (ADR 0022) |
| Pacotes puros | Em `packages/{match-engine,volley-rules}/src`: sem React, Expo, React Native, `@react-native-community/*`, `@testing-library/*`, módulos do Node, caminho para `apps/`, `import()` (também em tipo), `/// <reference>` nem `window`, `document`, `navigator`, `localStorage`, `fetch`, `process`, `Buffer`. `volley-rules` não importa `match-engine`. Em `packages/*/src` e `apps/mobile/src` só há TypeScript: `.js`, `.jsx`, `.cjs` e `.mjs` reprovam | Testes podem usar `node:*` (golden lê JSON) |
| Motor determinístico | Em `packages/match-engine/src`: sem `Date`, `crypto`, `performance`, `Intl`, `setTimeout` e `Math.random` | Testes |
| TS strict | `tsconfig.base.json` (`pnpm typecheck`) | Nenhuma |

## Imposto por ferramenta: C#

| Regra | Como | Exceções |
|---|---|---|
| Nullable e avisos como erro | `Directory.Build.props` | Nenhuma |
| Analisadores | `AnalysisLevel=10.0-recommended`, fixo para patch do SDK não criar aviso novo | `CA1707` e `CA1515` desligadas só em `apps/api/tests` |
| Estilo no build | `EnforceCodeStyleInBuild` com IDE0005, IDE0044, IDE0051, IDE0052, IDE0055, IDE0059, IDE0161 e CA2227 como `warning` | Nenhuma |
| Sem MediatR e AutoMapper | `Directory.Build.targets` reprova o build se a referência resolvida, direta ou transitiva, tiver esses nomes | Nenhuma |

## Supressões

Corrija a causa. Quando não der, a exceção legítima vai para o `eslint.config.mjs`, na menor abrangência possível (arquivo e regra), com o motivo em comentário e registro no ADR 0002. No TypeScript, comentário de supressão não funciona. No C#, `#pragma warning disable` funciona, e quem barra é o revisor. Nunca desligue uma categoria inteira de analisadores.

## Fim de linha e formatação

- O `.gitattributes` é a autoridade: tudo entra no índice em LF. `pnpm check:eol` confere e ignora o estado do disco.
- `.editorconfig` e Prettier fixam LF, para o `dotnet format` não usar o padrão do sistema.
- O Prettier não formata `design/`, `docs/`, `.claude/`, Markdown, `pnpm-lock.yaml` nem `apps/api/`.
- Arquivo de código salvo com CRLF falha no `format:check`; `pnpm format` corrige. Não rode `git reset --hard` para normalizar um checkout.

## Só o revisor confere

- Número mágico em C#: não há regra nativa, e o S109 traria o SonarAnalyzer com muito ruído.
- `#pragma warning disable` em C#.
- Desvios aceitos no TypeScript: número solto em objeto fora de `*.data.ts` (`detectObjects: false`), `as unknown as` e `declare const require`.
- Nomes do glossário, funções pequenas, DDD enxuto e fatias verticais. No domínio C#, os testes de arquitetura já barram `Environment`, `Console`, `Process`, `Marshal` e P/Invoke ([ADR 0025](../arquitetura/adr/0025-json-compartilhado-no-csharp.md)); determinismo, `System.Type` e uso manual de `MemoryMarshal` e `CollectionsMarshal` ficam com o revisor.
- Result pattern em vez de exceção para regra de negócio.
- Eventos sem dado pessoal; tudo aponta para `MemberId`.
- Comentários e nomes em inglês; textos de interface em pt-BR, centralizados em `apps/mobile/src/strings/`.
- Telas iguais ao design, toque ≥ 44 px, contraste AA.
- Imutabilidade no C# além de IDE0044 e CA2227 (por exemplo, `record` e coleções somente leitura no domínio).

## Front-end do app (E4.1)

Regras do Gabriel em `docs/padroes/frontend.md`. Onde fica cada coisa: tokens em `apps/mobile/src/theme/tokens.data.ts` (única fonte de números e hex), escala por janela em `scale.ts`, temas em `themes.ts`, componentes base em `src/ui/` (um por arquivo, props em `interface` exportada), serviços em `src/services` e adaptadores em `src/adapters`, textos em `src/strings/pt-BR.ts`. Componente não escreve hex nem pixel: lê `useTheme()`. Ver ADR 0034.
