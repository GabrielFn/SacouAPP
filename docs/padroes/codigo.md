# Padrões de código

Regras de `CLAUDE.md`, separadas entre o que a ferramenta impõe e o que só o revisor confere. Decisões e motivos no [ADR 0002](../arquitetura/adr/0002-padroes-e-lint.md).

## Comandos

| Comando | Faz |
|---|---|
| `pnpm lint` | ESLint em pacotes, app, `scripts/` e `eslint.config.mjs`, `--max-warnings 0`. Compila os pacotes antes, porque o lint com tipos lê `dist/*.d.ts` |
| `pnpm lint:regression` | Confirma que as regras ainda reprovam os desvios conhecidos e aceitam o código legítimo (`scripts/lint-regression.mjs`). Regra nova ou furo novo ganha um caso ali |
| `pnpm format` / `pnpm format:check` | Prettier (corrige / só verifica) |
| `pnpm check:eol` | Falha se houver arquivo de texto com CRLF **no índice do Git** |
| `pnpm check:size` | Tamanho dos arquivos C# (`scripts/check-file-size.mjs`) |
| `pnpm check:duplication` | Duplicação de código em TS e C# (`jscpd`, `scripts/check-duplication.mjs`) |
| `pnpm test:tooling` | Testes dos scripts: políticas de exceção do audit e dos portões, tamanho, duplicação, gerador de tipos da API e compatibilidade do `/v1` |
| `pnpm api:contract` | Reescreve `apps/api/openapi/v1.json` pela API real (teste do contrato com `SACOU_UPDATE_OPENAPI=1`) e regenera os tipos do app (ADR 0042). Rode depois de mudar rota, DTO, enum ou erro |
| `pnpm api:types` | Só regenera `apps/mobile/src/api/generated/` a partir do `v1.json` |
| `pnpm check:api-types` | Falha se `apps/mobile/src/api/generated/` não for o que o `v1.json` gera |
| `pnpm check:api-compat` | Falha se o `v1.json` quebrar o `/v1` da `origin/main` (rota, campo ou valor de enum removido; campo de requisição novo ou passado a obrigatório). Exceção: `BREAKING-V1` no corpo do PR, com ADR |
| `pnpm lint:api` | `dotnet build` (analisadores) e `dotnet format --verify-no-changes` |
| `pnpm format:api` | `dotnet format` |

## Imposto por ferramenta: TypeScript

| Regra | Como | Exceções |
|---|---|---|
| Sem `any` | `strictTypeChecked`, `no-explicit-any`, `no-unsafe-*`, em `.ts`, `.tsx`, `.mts` e `.cts` | Nenhuma |
| Sem número mágico | `@typescript-eslint/no-magic-numbers`. Liberados `-1`, `0`, `1`, valor de `const` nomeado, enum, tipo literal, campo `readonly`, índice de array, valor em objeto | Testes e `*.data.ts`, que não pode ter função |
| Sem supressão no código | `noInlineConfig`: `eslint-disable` e `/* eslint regra: "off" */` não têm efeito e geram aviso, que reprova | Nenhuma. Ver "Supressões" |
| Imutabilidade | `prefer-const`, `no-param-reassign`, `functional/no-let`, `functional/immutable-data`, `prefer-readonly` | Testes não usam `functional/*`. No app, `.current` e `.value` (refs, Reanimated) podem receber atribuição. `let` no `for` só em `match-engine/src/event-log/replay-events.ts`, e `budget.remaining` só em `parse-envelope.ts` (ADR 0022) |
| Pacotes puros | Em `packages/{match-engine,rating,volley-rules}/src`: sem React, Expo, React Native, `@react-native-community/*`, `@testing-library/*`, módulos do Node, caminho para `apps/`, `import()` (também em tipo), `/// <reference>` nem `window`, `document`, `navigator`, `localStorage`, `fetch`, `process`, `Buffer`. `volley-rules` não importa `match-engine`. O app, o motor e o `volley-rules` não importam `@sacou/rating` (teste `architecture.test.ts` do pacote). Em `packages/*/src` e `apps/mobile/src` só há TypeScript: `.js`, `.jsx`, `.cjs` e `.mjs` reprovam | Testes podem usar `node:*` (golden lê JSON) |
| Motor determinístico | Em `packages/{match-engine,rating}/src` (o rating é refeito do zero): sem `Date`, `crypto`, `performance`, `Intl`, `setTimeout` e `Math.random` | Testes |
| TS strict | `tsconfig.base.json` (`pnpm typecheck`) | Nenhuma |
| Complexidade | ESLint `complexity` 10 em produção e `scripts/` | Testes. Exceção com prazo em `scripts/quality-exceptions.json` |
| Tamanho de arquivo | ESLint `max-lines` 300 (linhas físicas); 600 em `*.test.*` e `*.test.fixture.ts` | Exceção com prazo em `scripts/quality-exceptions.json` |
| Duplicação | `pnpm check:duplication`: qualquer clone de 50 tokens reprova, só em produção | Exceção com prazo em `scripts/quality-exceptions.json` |
| Código gerado (app) | `apps/mobile/src/api/generated/**` fica fora do ESLint e do `check:duplication`, e dentro do `format:check` e do `typecheck`; quem o guarda é o `check:api-types` (ADR 0042) | Ninguém edita à mão |
| Cor só no tema (app) | Hex, hex em template e `rgb(`/`rgba(` reprovam em `apps/mobile/src` fora de `src/theme/` | Testes |
| Sem número em estilo (app) | Literal numérico em `StyleSheet.create`, em atributo `*style` ou em variável com tipo `*Style` reprova | Livres: `flex`, `flexGrow`, `flexShrink`, `opacity`, `aspectRatio`, `zIndex` |
| Props como `interface` exportada (app) | `type XProps`, `interface XProps` sem `export` e props inline em componente PascalCase reprovam | Testes |
| SDK só em adaptador (app) | `expo`, `expo-*`, `react-native-*`, `@react-native-community/*`, `@react-native-async-storage/*` só em `src/adapters/`, também em `import()` e `require()`. Do próprio `react-native`, `BackHandler`, `Vibration` e `AccessibilityInfo` também (o resto, como `View`, é livre) | Livres: `expo-router`, `expo-status-bar`, `react-native-svg`, `react-native-safe-area-context`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-screens` |
| Reducer exaustivo (app) | Arquivo `*.reducer.ts`: `switch-exhaustiveness-check` sem aceitar `default` e `default` proibido | Nenhuma |

## Imposto por ferramenta: C#

| Regra | Como | Exceções |
|---|---|---|
| Nullable e avisos como erro | `Directory.Build.props` | Nenhuma |
| Analisadores | `AnalysisLevel=10.0-recommended`, fixo para patch do SDK não criar aviso novo | `CA1707` e `CA1515` desligadas só em `apps/api/tests` |
| Estilo no build | `EnforceCodeStyleInBuild` com IDE0005, IDE0044, IDE0051, IDE0052, IDE0055, IDE0059, IDE0161 e CA2227 como `warning` | Nenhuma |
| Complexidade | CA1502 10 (`CodeMetricsConfig.txt` na raiz), em todos os projetos, inclusive testes | Nenhuma: refatore |
| Tamanho de arquivo | `pnpm check:size`: 300 linhas físicas em `apps/api/src`, 600 em `apps/api/tests` | Exceção com prazo em `scripts/quality-exceptions.json` |
| Duplicação | `pnpm check:duplication` em `apps/api/src` (50 tokens; linhas `using` ignoradas) | Exceção com prazo em `scripts/quality-exceptions.json` |
| Sem MediatR e AutoMapper | `Directory.Build.targets` reprova o build se a referência resolvida, direta ou transitiva, tiver esses nomes | Nenhuma |

## Portões de qualidade

Decisão e motivos no [ADR 0035](../arquitetura/adr/0035-portoes-de-qualidade.md).

| Portão | Limite | Onde está o limiar |
|---|---|---|
| Complexidade ciclomática | 10 (TS e C#) | `eslint.config.mjs` (`MAX_COMPLEXITY`) e `CodeMetricsConfig.txt` |
| Tamanho de arquivo | 300 linhas físicas; 600 em testes | `eslint.config.mjs` (`MAX_LINES`, `MAX_LINES_IN_TESTS`) e `scripts/lib/file-size.mjs` |
| Duplicação | 50 tokens, qualquer clone reprova | `.jscpd.json` (pacote novo em `packages/` entra na lista `path`, porque o `jscpd` não aceita glob ali; migrações do EF Core ignoradas) |

**Exceções: só em `scripts/quality-exceptions.json`.** Cada entrada é `{ "gate": "max-lines" | "complexity" | "duplication", "path": "...", "reason": "...", "expires": "AAAA-MM-DD" }`, com prazo de até 60 dias a partir de hoje. Entrada malformada, com `gate` desconhecido, vencida, com prazo além de 60 dias, com `path` que tenha glob (`* ? [ ] { } !`) ou que não seja arquivo rastreado pelo Git reprova o lint e os scripts, e não libera nada. A exceção vale só para aquele arquivo e aquele portão. CA1502 não tem exceção: refatore. A meta é o arquivo vazio (`[]`).

**Convenção de reducer:** o reducer de tela fica em `<nome>.reducer.ts`, que é onde o ESLint confere a exaustividade.

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
- Front-end, o que o ESLint não alcança: registro único de estado (cópia de prop ou de consulta em `useState`/`useEffect`, flag que repete outro estado), reducer puro e sem efeito colateral (API, armazenamento, vibração, navegação fora dele), interface junto do consumidor, implementação falsa de cada serviço, reducer fora da convenção `*.reducer.ts`, estilo montado em função ou objeto de estilo em variável sem tipo `*Style`, `width`/`height` fixos vindos de token, props declaradas em `memo`, `forwardRef`, `React.FC<{...}>` ou em parâmetro com valor padrão, hex embutido em string maior (`"1px solid #fff"`) e cor em `hsl(...)`.
- Imutabilidade no C# além de IDE0044 e CA2227 (por exemplo, `record` e coleções somente leitura no domínio).

## Front-end do app (E4.1)

Regras do Gabriel em `docs/padroes/frontend.md`. Onde fica cada coisa: tokens em `apps/mobile/src/theme/tokens.data.ts` (única fonte de números e hex), escala por janela em `scale.ts`, temas em `themes.ts`, componentes base em `src/ui/` (um por arquivo, props em `interface` exportada), serviços em `src/services` e adaptadores em `src/adapters`, textos em `src/strings/pt-BR.ts`. Componente não escreve hex nem pixel: lê `useTheme()`. Ver ADR 0034.
