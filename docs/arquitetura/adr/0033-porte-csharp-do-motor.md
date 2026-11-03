# ADR 0033 · Porte C# da função de estado e golden compartilhados

**Status:** aceito (03/11/2026). **Tarefa:** E2.10. Plano em [`docs/estado/tarefas/E2.10.md`](../../estado/tarefas/E2.10.md). Cumpre os contratos C# dos ADRs [0022](0022-event-envelope-replay.md), [0023](0023-placar-e-catalogo-de-eventos.md), [0024](0024-saque-e-rotacao-derivados.md), [0026](0026-posicoes-no-saque.md), [0027](0027-banco-manual.md), [0028](0028-libero-ligado.md), [0029](0029-fila-da-quadra.md), [0030](0030-correcoes-da-linha-do-tempo.md), [0031](0031-ponto-individual.md) e [0032](0032-estatisticas-por-jogador.md), sobre a base do [ADR 0025](0025-json-compartilhado-no-csharp.md).

**Aceite:** TS e C# produzem o mesmo estado nos 14 golden de `packages/match-engine/golden/` (`queue-plans.json` fica fora, ADR 0029), lidos pelo caminho como recurso embutido, sem cópia, cada um com lista literal de IDs no teste. O motor TS não mudou durante o porte.

## Decisões (D1 a D14 do plano)

| # | Decisão |
|---|---|
| D1 | Domínio puro em `Matches/Domain/CourtSessions/` (`EventLog`, `Score`, `Score/PayloadParsers`, `Score/Appliers`, `Rotation`, `Alignment`, `Queue`, `Attributions`, `PlayerStatistics`). JSON só em `Matches/CourtSessionJson/` (`RawValueReader`, `CourtSessionStateWriter`). Tudo `internal`. As estatísticas ficam em `Matches`; a E3.9 decide como o `Stats` consome |
| D2 | Entrada como árvore própria (`RawValue`: objeto com membros na ordem recebida e repetidos, lista, texto, número `double`, booleano, nulo). O adaptador só converte; profundidade, nós, chaves e esquema são do parser do domínio, na ordem do TS. `JsonDocumentOptions { AllowDuplicateProperties = true, MaxDepth = 64 }`: acima de 64 níveis o `JsonDocument` lança `JsonException` antes do domínio, e a E3.7 trata como corpo inválido |
| D3 | **Chave repetida em evento recebido é recusada:** no envelope, `invalid-envelope` com `field` `envelope`; no payload, em qualquer nível, `payload`. Comparação ordinal depois do unescape, então `"x"` e `"\u0078"` colidem. O JS fica com a última, mas o app grava com `JSON.stringify`, que nunca repete: só entrada hostil diverge, e diverge fechando. Chamado direto (sem envelope), o parser de payload também recusa a repetida, como `unknown-field` |
| D4 | `Result<TValue, TError>` local em `CourtSessions/`, com `EnvelopeError(Field)`, `PayloadError(Field)` e `ReplayError(Code, EventId)`. Não sobe para `Shared` (um só consumidor, ADR 0005). `OverlapResult` fica como está |
| D5 | Números sempre pelo `double` (`SafeInteger`: finito, inteiro por valor, `|x| ≤ 2^53−1`), nunca `GetInt32`: `25.0` e `2.5e1` valem 25; `9007199254740992`, `1e400` e frações são recusados. `int` para placar, sets, zonas e índices; `long` para `batch`, `sequence` e versões |
| D6 | Saída por listas fixas de campos, sem serializador nem dicionário enumerado; `null` e `[]` sempre escritos. O `CourtSessionStateWriter` escreve o texto do `JSON.stringify`: escapes curtos, `\u` minúsculo para os outros controles e para surrogate solto, e o resto literal. O texto escapado vai por `WriteRawValue`, porque o `Utf8JsonWriter` lança com surrogate solto. Teste: o texto do estado é igual byte a byte ao JSON compacto do golden em todos os casos aceitos de `score-events` |
| D7 | Testes comparam a saída escrita com o `expected` do golden nó a nó: tipo, sequência de chaves, texto ordinal e número por valor; as coordenadas também por bits |
| D8 | UUID por laço de caracteres (8-4-4-4-12, minúsculo, 36), sem regex nem `$`. Textos só ordinais |
| D9 | Tabelas sem aritmética: zona seguinte, anterior e índice→vaga por posição na tabela. Um teste de repositório reprova o operador `%` em `Domain/CourtSessions` (fora de comentários), porque um `%` certo passa nos golden |
| D10 | Determinismo por teste de arquitetura: `DeterministicDomainViolations` reprova em `CourtSessions` dependência de `DateTime`, `DateTimeOffset`, `TimeProvider`, `Random`, `Guid`, `Thread`, `Task`, `ValueTask`, `Parallel`, `HashSet<>` e `Dictionary<,>`, com casos plantados. Outros domínios seguem livres (`AllowedBclAndShared`). A regra geral de domínio, que lê `Domain` em qualquer profundidade, também barra `Environment` e `Stopwatch` em `CourtSessions`, com caso plantado |
| D11 | Aplicador total: recusa com `Result`, nunca exceção. O replay C# **não captura** exceção do aplicador (CA1031), ao contrário do TS, que a converte em `event-rejected`. Fuzz com semente fixa no envelope, nos payloads dos 8 tipos e nos logs aceitos de `score-events` exige zero exceção e nenhum eco |
| D12 | Esquema fechado e nomes proibidos por reflexão (revisão A4): propriedades, campos e parâmetros de construtor de todo tipo de `CourtSessions` e `CourtSessionJson` sem `email`, `name`, `nickname`, `phone`, `pix`, `photo`, `userId` nem `*UserId` (sem caixa, sem `_` inicial), com casos plantados. Por payload, as propriedades e os parâmetros de construtor de cada record são exatamente as chaves do esquema, em todos os níveis (18 pares), e todo `ScorePayload` concreto tem esquema |
| D13 | `ImmutableArray<T>` em todo o estado, com cópia em `Add`. A medição abaixo não mostra custo de cópia de `finishedMatches` (200 partidas: 0,14 s), então não há troca por `ImmutableList` |
| D14 | Golden por `EmbeddedResource` (`golden/<arquivo>`), registrados em `SharedJsonFiles`; o teste de recurso passou a aceitar também `packages/match-engine/golden/`. `onCourt` e `consecutiveMatches` são conferidos; `servingPlayer` e `substitutions` ignorados (funções só TS). `initialState` lido sem validar partição (ADR 0027) |

## Desvios do plano, por parte

**P1 (envelope, normalização, replay, linha do tempo).**
- **O leitor recebe texto ou bytes, não `JsonElement`:** `GetString()` e `JsonProperty.Name` lançam com surrogate solto (`"\ud800"`), que o JS aceita. O `RawValueReader` decodifica nomes e textos dos bytes crus (`JsonMarshal`) com unescape próprio, e um surrogate solto chega ao domínio como no JS (recusado em UUID, aceito como `type`).
- **`ReplayError` só com `Code` e `EventId`,** sem o `Field?` do D4: nenhum golden de eventos espera `field` num erro de replay, como no TS.
- **Aplicador como `Func<TState, EventEnvelope, Result<TState, EventRejection>>`:** um delegate declarado implementa `ISerializable`, que a barreira de domínio recusa. A barreira não mudou.
- **`EventReplayer` estático com métodos genéricos** (`ReplayEvents`, `ReplayTimeline`), como as funções do TS.
- **Correção na regra de namespace:** `IsCompilerGenerated` passou a olhar o tipo pai, porque um array constante gera `<PrivateImplementationDetails>+__StaticArrayInitTypeSize=N`.
- **`NaN` não vem de texto JSON no .NET 10:** `TryGetDouble` sempre devolve verdadeiro, e até `1e99999999999` vira `Infinity`. O ramo `NaN` do leitor é defesa; um teste mostra que o expoente enorme lido do texto e um `RawNumber(NaN)` montado em código são recusados pelo envelope, pelo payload e pela cópia.

**P2 (regras puras).**
- `BySide<T>(A, B)` genérico no lugar de `SetScore`, `SetsWon`, `MatchTeams`, `TeamRotations` e `SetterZones`.
- `ScoringRules` (record) e `ScoreRules` (funções); `ServeAlignment` (record) e `ServeAlignmentRules`.
- `TeamSide.Opponent()` é método: como propriedade, o `ToString` do record entraria em recursão.
- Zona fora da tabela em `GetLineupBySlot`/`GetServingPlayer` lança `ArgumentOutOfRangeException` (erro de programa; o parser garante 1 a 6), onde o TS rotacionaria em silêncio.
- `getConsecutiveMatches` e `getMatchesPlayed` foram para a P4 (dependem do estado); `onCourtInTheRally` para a P5. `MIDDLE_BLOCKER_LINEUP_INDEXES` e `getCurrentServingPlayer` ficam só em TS.

**P3 (parsers de payload).**
- Índice do líbero lido como inteiro por valor: `2.5` é recusado (no TS, por `includes`), `2.0` vale 2.
- `Optional<T>` para sucesso que pode ser `null` (rotação desligada, `nextSet: null`), porque o `Result` exige valor não nulo.
- O teste "esquema igual à lista de campos" do TS não foi portado: a lista `fields` do TS não segue regra uniforme (tem `nextSet.setterZones.a`, mas não os filhos do líbero). O D12 por record cobre o objetivo.

**P4 (estado e aplicadores).**
- `FinishedMatch` por composição (`Match`, `EndReason`, `Winner`); o escritor põe `endReason` e `winner` nas posições do TS.
- Aplicadores agrupados por tema (`MatchAppliers`, `SetAppliers`, `TeamAppliers`) e registro `ScoreAppliers`.
- O `EnvelopeParser` passou a usar `SafeInteger` (commit à parte), fechando a duplicação apontada na revisão leve.
- Todas as strings do estado chegam validadas (UUID ou código de lista fechada); o escape de surrogate solto do escritor fica pronto para a E3.7.

**P5 (atribuições, estatísticas).**
- `PointAttributionResolver.Resolve`, `StatisticsRules.GetPlayerStats`/`GetSideStats` e `MatchTallies` (saldo, pontos por tipo, quem estava em quadra) são portes diretos; o "mesmo estado sem `PointAttributed`" do ADR 0031 é conferido nos casos aceitos sem `RevertedTo` de `attributions-events`.

**Logs anteriores à E2.11** (sem `libero`) seguem recusados também no C#: não há produção.

## Medição (D13)

Teste `Explicit` `VolumeMeasurements`, fora da CI e sem asserção de tempo: `Sacou.Modules.Matches.Tests.exe -explicit only -class Sacou.Modules.Matches.Tests.CourtSessions.VolumeMeasurements`, em Release, .NET 10, máquina de desenvolvimento. Parse é `RawValueReader` mais `EnvelopeParser`; replay é `ReplayTimeline` com os aplicadores (que releem o payload). Medianas de 5. "Retido" inclui o log em texto (UTF-16), os envelopes e a linha do tempo.

| Cenário | Log (UTF-8) | Parse | Replay | Retido | Heap de 256 MB |
|---|---|---|---|---|---|
| 64 mil pontos simples | 18,8 MB | 0,73 s | 0,37 s | 68,9 MB | passa |
| 64 mil pontos, rotação, 24 por time, side-out em todo ponto | 18,8 MB | 0,74 s | 0,40 s | 74,7 MB | passa |
| 64 mil `LineupChanged`, 24 por time | 78,2 MB | 1,75 s | 1,60 s | 293,5 MB | `OutOfMemoryException` |
| 64 mil `QueueChanged`, fila de 96 | 251,8 MB | 10,32 s | 6,83 s | 926,7 MB | `OutOfMemoryException` |
| 200 partidas terminadas | 0,9 MB | 0,08 s | 0,14 s | 3,8 MB | passa |

No .NET a falta de memória é `OutOfMemoryException`, que pode derrubar a requisição ou o processo; a defesa é o limite por bytes: a E3.7 limita corpo e lote por bytes e conta eventos por partida, como já dizia o modelo de ameaças. O `RawValueReader` monta a árvore inteira antes do orçamento de 4096 nós do parser, cerca de 32 vezes o tamanho do corpo (corpo de 2 MB aloca 72,9 MB; de 8 MB, 253,8 MB): a E3.7 limita os bytes de cada envelope antes do leitor (16 a 64 KB cabem um `QueueChanged` máximo), além do corpo e do lote, ou usa um leitor com orçamento de nós. A E3.7 nunca registra `JsonException.Message` em log, porque ela ecoa o byte e a posição inválidos. O leitor decodifica UTF-8 de forma estrita: bytes malformados e surrogate solto cru viram `JsonException`, nunca U+FFFD. O `QueueChanged` continua o evento mais caro por byte.

## Consequências

- A E3.7 usa `RawValueReader.Parse`, `EnvelopeParser`, `EventReplayer` com `ScoreAppliers` e `CourtSessionStateWriter`, e mantém o limite do corpo antes do parser, a autorização e as conferências de "formato, não verdade" (ADR 0023).
- A E3.9 usa `EventReplayer.ReplayTimeline`, `PointAttributionResolver` e `StatisticsRules`.
- Mudar o formato de um evento exige mudar o parser nas duas linguagens e o golden no mesmo PR; caso novo exige o ID na lista literal do C#.
- **Resolve** as pendências do ADR 0025 (chave repetida em eventos, determinismo do domínio, `Result<T, E>` local) e o "se a E3.9 precisar" do ADR 0030 (`ReplayTimeline` e `previousSetterZone` portados).
