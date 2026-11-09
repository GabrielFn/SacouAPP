# ADR 0035 · Portões de qualidade: complexidade, tamanho, duplicação e regras do front

Data: 08/11/2026 · Tarefa: E0.10 · Status: aceito

## Contexto

O `CLAUDE.md` pede funções pequenas, Clean Code e as regras de `docs/padroes/frontend.md`, mas até a E0.10 isso dependia só do revisor. O backlog pede que a CI reprove cada violação plantada, em TS e C#, e que o código atual fique dentro dos limites ou com exceção justificada e com prazo.

## Decisões

**Limiares num lugar só por linguagem.**

| Portão | TS | C# |
|---|---|---|
| Complexidade ciclomática | ESLint `complexity` 10 (produção e `scripts/`; testes isentos) | CA1502 10 (`CodeMetricsConfig.txt` na raiz, `AdditionalFiles` no `Directory.Build.props`, `warning` no `.editorconfig`, que vira erro). Vale em todos os projetos, inclusive testes |
| Tamanho de arquivo | `max-lines` 300; 600 em `*.test.*` e `*.test.fixture.ts`. Conta linhas físicas (`skipBlankLines` e `skipComments` desligados) | `pnpm check:size` (`scripts/check-file-size.mjs`): 300 em `apps/api/src`, 600 em `apps/api/tests`, linhas físicas |
| Duplicação | `pnpm check:duplication` (`jscpd` 5.4.2, `.jscpd.json`): 50 tokens, `minLines: 1`, qualquer clone reprova | Idem, formato `csharp` |

As constantes do TS ficam no topo do `eslint.config.mjs`; as do C# no `CodeMetricsConfig.txt` e em `scripts/lib/file-size.mjs`. A mesma conta de linhas (a do `wc -l`) nos dois lados evita duas métricas.

**Duplicação só em produção.** `packages/*/src`, `apps/mobile/src` e `apps/api/src`, ignorando testes, golden, `*.data.ts`, `dist`, `bin`, `obj` e `node_modules`. Clone TS↔C# não é detectado (formatos diferentes), e isso é desejado: o motor é portado de propósito ([ADR 0033](0033-porte-csharp-do-motor.md)). Linhas `using` são ignoradas (`ignorePattern`), porque blocos iguais de `using` não são lógica duplicada. `**/Infrastructure/Migrations/**` também é ignorado: as migrações do EF Core (E3.1) são geradas e repetem o modelo por natureza. O `jscpd` 5.4.2 não aceita glob em `path` (`packages/*/src` dá "path does not exist"), então os pacotes estão listados um a um em `.jscpd.json`: **pacote novo em `packages/` precisa entrar nessa lista**. `minLines: 1` faz o corte valer só por tokens, sem o mínimo de linhas padrão do `jscpd`, que deixava clones curtos e densos passarem.

**Exceções num arquivo só: `scripts/quality-exceptions.json`.** Cada entrada tem `gate` (`max-lines`, `complexity` ou `duplication`), `path`, `reason` e `expires` (AAAA-MM-DD). `scripts/lib/quality-exceptions.mjs` valida o arquivo reaproveitando o leitor das exceções do audit (`audit-exceptions.mjs`); entrada malformada, `gate` desconhecido, vencida, com prazo além de hoje + 60 dias, com `path` que tenha caractere de glob (`* ? [ ] { } !`) ou que não seja arquivo rastreado (`git ls-files`) reprova todos os portões que o leem e não libera nada. Sem a barreira do glob, `"path": "**"` desligaria `complexity` e `max-lines` no ESLint inteiro, porque o config usa o `path` como padrão de `files`. O `eslint.config.mjs` gera os overrides a partir dele, e os scripts de tamanho e duplicação o leem também. Prazo máximo: 60 dias a partir do dia da leitura, imposto pelo validador. **CA1502 não aceita exceção**, porque supressão por `.editorconfig` ou `#pragma` criaria um segundo lugar: o método é refatorado. No fim da E0.10 o arquivo está vazio (`[]`).

**Regras do front no ESLint** (`scripts/lib/eslint-mobile-rules.mjs`), em `apps/mobile/src` fora dos testes:

- Cor: literal hex, hex em template e `rgb(`/`rgba(` reprovam fora de `src/theme/`.
- Número em estilo: literal numérico dentro de `StyleSheet.create(...)`, de atributo JSX `*style`/`*Style` ou de variável anotada com tipo `*Style` reprova. Livres: `flex`, `flexGrow`, `flexShrink`, `opacity`, `aspectRatio`, `zIndex`.
- Props: `type XProps`, `interface XProps` sem `export` e tipo literal inline no parâmetro de componente PascalCase reprovam.
- SDK de dispositivo ou serviço só em `src/adapters/`, em `import`, `export ... from`, `import()` e `require()` (os dois últimos por `no-restricted-syntax` com o mesmo regex, em blocos gerados aos pares, dentro e fora de `src/adapters/`): `expo`, `expo/*`, `expo-*`, `react-native-*`, `@react-native-community/*` e `@react-native-async-storage/*` reprovam. Livres (UI e navegação): `expo-router`, `expo-status-bar`, `react-native-svg`, `react-native-safe-area-context`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-screens`.
- Reducer: arquivo `*.reducer.ts` (convenção). Neles `switch-exhaustiveness-check` com `considerDefaultExhaustiveForUnions: false` e `default` proibido, porque o `default` esconde ação nova.
- As listas de `no-restricted-syntax` são compostas em constantes, porque um bloco posterior substitui a regra inteira: arquivo `*.data.ts` do app continua sem função, e fora de `src/theme/` continua sem hex.

**Regressão.** `pnpm lint:regression` ganhou os casos de `scripts/lib/quality-regression.mjs`: casos ESLint (complexidade 11 reprova, testes isentos; 301/601 linhas reprovam, 300/600 passam; cada regra do front reprova e o uso legítimo passa), uma sonda que planta dois arquivos com o mesmo bloco acima de 50 tokens em TS e em C# (71 e 65 tokens, reprova) e abaixo do limite (cerca de 40, passa); o caso que deve reprovar só conta se o relatório citar o clone e roda `scripts/check-duplication.mjs`, e uma sonda que cria `apps/api/__lint-regression__probe/Probe.csproj` com um método de 11 ramos e exige `CA1502` no `dotnet build`. Sem `dotnet` no PATH, a sonda falha em vez de pular. O tamanho C# e as exceções têm testes de unidade em `pnpm test:tooling` (`file-size.test.mjs`, `quality-exceptions.test.mjs`, `duplication.test.mjs`).

**Refatorar em vez de excetuar.** As violações medidas no início (8 de tamanho, 3 de complexidade TS, 2 de CA1502, 10 clones) foram refatoradas sem mudar comportamento: golden TS e C# verdes e a lista de exportações de `packages/match-engine/dist/index.d.ts` idêntica à da `main`.

## Alternativas descartadas

- **SonarAnalyzer / SonarCloud** para complexidade e duplicação: muito ruído e serviço externo (ADR 0002).
- **Exceção de CA1502 por `.editorconfig`**: segundo lugar de exceções, sem prazo.
- **Contar só linhas de código (sem brancos e comentários)**: o script C# teria de entender comentários; a conta física é a mesma nos dois lados.

## Consequências

- O que o ESLint não alcança fica com o revisor (lista em `docs/padroes/codigo.md`): registro único de estado, reducer sem efeito colateral, interface junto do consumidor, implementação falsa de cada serviço, estilo montado em função ou vindo de variável sem tipo `*Style`.
- ESLint `complexity` e CA1502 contam diferente (`??`, `?.`, `switch`); o limite é por linguagem.
- `lint:regression` ficou cerca de 30 s mais lento pelo `dotnet build` da sonda.
- `jscpd` é dependência de dev com versão exata; `pnpm audit --audit-level high` cobre a cadeia.
