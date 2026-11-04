# ADR 0034 · Arquitetura do app e métricas de código na CI

**Status:** aceito (03/11/2026). **Tarefa:** E4.0. Plano em [`docs/estado/tarefas/E4.0.md`](../../estado/tarefas/E4.0.md). As regras em uso estão em [`docs/padroes/app.md`](../../padroes/app.md) e [`docs/padroes/codigo.md`](../../padroes/codigo.md).

## Contexto

Antes do front (E4.1 em diante), o Gabriel pediu as regras de arquitetura e de criação de componentes, com análise de duplicidade, complexidade ciclomática e tamanho de componentes e arquivos, sem componente e subcomponente no mesmo arquivo, conferidas na CI. O que a ferramenta conferir não depende da atenção do revisor.

## Decisões

### App (`apps/mobile/src`)

| # | Decisão | Como é imposta |
|---|---|---|
| A1 | Pastas por funcionalidade: `app/` (rotas finas), `features/<feature>/` com `screens/`, `components/`, `hooks/`, `api/` e `state/`, `ui/` (design system, com `tokens/` e `theme/`), `lib/` (infraestrutura) e `strings/` | Convenção; as fronteiras abaixo dependem dos nomes |
| A2 | Fronteiras: `ui/` não importa `features/`, `lib/` nem `app/`; uma feature não importa outra; `app/` só importa `features/*/screens`; `screens/` e `components/` não importam `api/` nem `lib/` | `@typescript-eslint/no-restricted-imports` por pasta |
| A3 | Um componente por arquivo, nome do arquivo igual ao do componente | `react/no-multi-comp` com `ignoreStateless: false`; o nome do arquivo fica com o revisor |
| A4 | Sem estilo inline e sem cor solta fora de `ui/tokens/` | `no-restricted-syntax` |
| A5 | Fora de `ui/`, sem `Pressable` e `Touchable*` de `react-native` e `react-native-gesture-handler` | `no-restricted-imports` com `importNames` |
| A6 | Dado da API no TanStack Query; estado de interface compartilhado no Zustand, em `features/*/state/`; log da quadra no expo-sqlite, por `lib/`; motor da partida só pelos hooks da feature da quadra | Convenção e revisor |
| A7 | Tokens das telas em `ui/tokens/`, com os temas Sol e Noite (E4.1) | A regra de cor (A4) |
| A8 | Testes do app com React Native Testing Library, instalada na E4.1 | `docs/padroes/testes.md` |

**Imports pelo alias `@/`.** Quem sai da própria pasta importa por `@/` (`apps/mobile/tsconfig.json`, `"paths": { "@/*": ["./src/*"] }`); `../` reprova em todo `apps/mobile/src`, e `./` vale só para a mesma pasta. Assim a pasta que o import alcança está escrita nele, e as fronteiras são padrões de texto, sem plugin novo e sem resolver caminho. Sem isso, `../../outra-feature/hooks` não diz de onde vem.

**Uma feature não importa outra.** O `eslint.config.mjs` lê `apps/mobile/src/features/` ao carregar e gera, para cada pasta, um bloco que recusa `@/features/<outra>`. Feature nova entra na regra sem mexer na configuração. O ESLint carrega a configuração a cada execução, e o Turborepo invalida o cache do lint quando os arquivos do app mudam.

**`import/no-unresolved` ignora `^@/` no app.** O preset do Expo resolve imports com o resolvedor do Node, que não lê o `paths` do `tsconfig`. O `eslint-import-resolver-typescript` está no preset, mas o pnpm isolado não o expõe à raiz, e instalar outro pacote estava fora da autorização da tarefa. Quem confere esses imports é o `tsc` (`pnpm typecheck` e `pnpm build`). Imports relativos e de pacote seguem conferidos pela regra. O Metro do Expo lê o `paths` do `tsconfig`; a E4.1 confirma no primeiro import real.

**Estilo inline.** Reprova objeto literal em prop `style` ou terminada em `Style` (`contentContainerStyle`), também dentro de array ou condição. Objeto passado como argumento de chamada não conta, porque variantes e estilos dinâmicos do Unistyles recebem um.

**Cor.** Reprova texto com `#` seguido de 3, 4, 6 ou 8 dígitos hexadecimais, ou com `rgb(`, `rgba(`, `hsl(` ou `hsla(`, em literal ou template, fora de `ui/tokens/`. `"Rodada #12"` passa. Nomes de cor (`"red"`) não são barrados: ficam com o revisor.

**Combinação de regras.** No flat config, a mesma regra em dois blocos não soma: vale a do último. Por isso cada bloco de import repete o que vale para a pasta, e o bloco de cor do app repete as restrições de `*.data.ts` (função e `import()`), para um arquivo de dados do app continuar sem cor solta.

### Métricas

| # | Métrica | TS de produção | TS de testes | C# (`apps/api/src`) |
|---|---|---|---|---|
| M1 | Complexidade ciclomática | `complexity` 10 | sem limite | CA1502 com 10 |
| M2 | Linhas por arquivo | `max-lines` 300 em `.ts`, 200 em `.tsx`, sem brancos e comentários | 800 | 300 linhas não brancas, por teste |
| M3 | Linhas por função | `max-lines-per-function` 50 em `.ts`, 80 em `.tsx`, sem brancos e comentários | sem limite | não |
| M4 | Aninhamento, parâmetros, callbacks | `max-depth` 4, `@typescript-eslint/max-params` 4, `max-nested-callbacks` 3 | sem limite | não |
| M5 | Duplicação | `jscpd`, 50 tokens | fora | no mesmo relatório |

- "TS de testes" é `*.test.*`. Um `*.test.fixture.ts` segue as regras de produção, como já seguia nas outras regras.
- `*.data.ts` tem os mesmos limites de tamanho.
- **CA1502:** `apps/api/src/CodeMetricsConfig.txt` (`CA1502: 10`) entra como `AdditionalFiles` por `apps/api/src/Directory.Build.props`, que importa o da raiz; a severidade `warning`, que `TreatWarningsAsErrors` torna erro, fica numa seção `[apps/api/src/**.cs]` do `.editorconfig`. Testes ficam fora. Testado com um método de complexidade 11 em `Sacou.Shared`: o build reprova; com 10, passa. `CodeMetricsTests` confere que o arquivo e a seção continuam lá.
- **Tamanho no C#:** `CodeMetricsTests` (`Sacou.Architecture.Tests`) conta as linhas não brancas de cada `.cs` de `apps/api/src`, fora de `bin/` e `obj/`, com casos plantados em pasta temporária.
- **Duplicação:** `pnpm dup` roda o `jscpd` 4.0.9 em `packages/match-engine/src`, `packages/volley-rules/src`, `apps/mobile/src` e `apps/api/src`, com `.jscpd.json` (formatos `typescript`, `tsx` e `csharp`; fora `*.test.*`, `golden/`, `dist/`, `bin/`, `obj/` e `node_modules/`). Os caminhos vão no script, não no `.jscpd.json`: no Windows, o `jscpd` torna o `path` da configuração absoluto com `\` e não acha nenhum arquivo. `gitignore` fica desligado, porque o `.gitignore` tem `.claude/worktrees/` e esconderia tudo numa worktree. Passo `Duplication` no job `verify` da CI, logo depois de `Lint regression`.
- **jscpd 4.0.9, não 5.x.** A linha 5 saiu em junho de 2026 e teve mais de 20 versões em 5 meses; a 4.0.9 (abril de 2026) usa o núcleo 4.0.5, estável desde 2024. Não trouxe vulnerabilidade ao `pnpm audit`.

### Catraca da duplicação

| Momento | Clones | Linhas duplicadas | Tokens duplicados |
|---|---|---|---|
| Antes (`943944d`) | 15 (4 TS, 11 C#) | 1,15% | 1,37% |
| Depois desta tarefa | 11 (C#) | 0,82% | 0,94% |

`threshold` 0,9 no `.jscpd.json`: o `jscpd` compara com a porcentagem de linhas duplicadas e reprova acima dela. **O limite só desce.** Quem tirar clones baixa o número no mesmo PR; ninguém sobe o limite para passar.

Os 4 clones TS foram removidos: o início comum dos payloads de set (`parseSetReference`), o início comum de `scorePoint` e `switchServingTeam` (`withSetInPlay`) e a leitura de lista de membros da fila, que agora usa `readUniqueMemberIds`. Os 11 do C# ficaram: 8 são o cabeçalho de `using` e `namespace` dos parsers de payload e dos aplicadores, 2 são o início comum dos aplicadores de set (ler, recusar, achar partida e set), que segue o TS linha a linha (ADR 0033), e 1 é a leitura de `PointScored` em `PointAttributionResolver` e `MatchTallies`. Removê-los mexe no porte sem ganho de regra; fica para quem tocar nesses arquivos.

## O que reprovava e foi corrigido (sem mudar comportamento)

- **Complexidade TS:** `toRecentPoint` (20) em `corrections/timeline.ts`, com `pointRally` e `authorshipOf` extraídos; `parseTeamState` (12), com `parseMatchLibero`; `findRally` (11) em `attributions/commands.ts`. As duas últimas usam `readPointScored` (novo `score/point-scored-event.ts`).
- **Complexidade C#:** `TeamPartsParser.ParseTeamState` (13), com `MatchLineup` e `IsMatchLibero`, no mesmo desenho do TS.
- **Tamanho TS:** `score/parse-payloads.ts` (485 linhas de código) virou `payload-reading.ts` (leitura de valores e esquema fechado), `parse-team-payloads.ts` (times, escalação, líbero, rotações e fila) e `parse-payloads.ts` (campos por tipo e parsers públicos). `score/commands.ts` (316) separou `lineup-commands.ts` e `command-results.ts`. `score/appliers.ts` (303) separou `match-change-appliers.ts` e `applier-lookups.ts`. `commands.ts` reexporta os comandos de escalação, para os testes e o `index.ts` não mudarem.
- **Testes:** `score.golden.test.ts` (959 linhas) separou `score-payloads.golden.test.ts`, com os mesmos testes; os ajudantes de IDs foram para `golden-ids.test.fixture.ts`. `teamStateOf`, em `match-player.test.fixture.ts`, tinha 5 parâmetros e passou a receber um objeto.
- Nenhum golden e nenhum esperado de teste mudou. Os 211 nomes exportados por `packages/match-engine/src/index.ts` e os 50 de `packages/volley-rules/src/index.ts` são os mesmos antes e depois (comparados pelo verificador de tipos).

## Regressão

`pnpm lint:regression` ganhou um caso que reprova e um que passa para cada regra de A2 a A5 e de M1 a M4, inclusive o limite exato (300 passa, 301 reprova). As pastas temporárias levam o prefixo `__lint-regression__`, que está no `.gitignore`.

## Consequências

- Arquivo grande se divide por tema; função complexa vira funções pequenas. Não há lista de permissão nem `eslint-disable` (que não funciona, ADR 0002).
- `CourtSessionStateWriter.cs` tem 302 linhas brutas e 267 não brancas: passa na regra do C#, que conta linhas não brancas, e não foi dividido.
- A E4.1 cria `ui/tokens/`, os primeiros componentes de `ui/` e a RNTL, e confirma o alias `@/` no Metro.
