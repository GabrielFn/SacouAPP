# ADR 0029 · Fila da quadra: gravada inteira, saída parcial calculada no comando

**Status:** aceito (03/11/2026). **Tarefa:** E2.6. Plano e respostas do Gabriel em [`docs/estado/tarefas/E2.6.md`](../../estado/tarefas/E2.6.md). Regras em [`fila.md`](../../dominio/fila.md). Estende o [ADR 0023](0023-placar-e-catalogo-de-eventos.md), o [ADR 0027](0027-banco-manual.md) e o [ADR 0028](0028-libero-ligado.md), e detalha o [ADR 0017](0017-group-settings-queue-bench.md) quanto à fila.

## Decisões do Gabriel (03/11/2026)

- **P1:** todos do time são candidatos a sair, inclusive banco e líbero. Quem entra no lugar do líbero vai para o fim do banco, e o time fica sem líbero. "Partida seguida" conta toda partida em que o jogador estava no time.
- **P2:** no critério padrão, o empate vai para quem jogou mais partidas na rodada; depois, para quem chegou primeiro.
- **P3:** o critério "nível" fica fora do MVP (`docs/ideias.md`; chip retirado de `AjustesGrupo.dc.html`).
- **P4:** só o modo automático no MVP. "N fixo", "sempre time inteiro" e "vencedor sai após X vitórias" vão para `docs/ideias.md`; o interruptor "Saída parcial automática" saiu de `AjustesGrupo.dc.html`, e `produto.md:68` e `decisoes.md:11` dizem isso.

## Decisões

**O evento grava o resultado; a escolha é só cálculo** (`decisoes.md:26`). O critério roda no comando `planNextMatch`, e o `MatchStarted` da partida seguinte grava a fila inteira e a partida inteira. O aplicador não faz conta de fila.

**`MatchStarted` ganha `queue: { teams: [{ memberIds }], players: [MemberId] }`, obrigatório,** com `[]` serializado; ausente ou `null` é `invalid-payload`. Junto com `teams` e `rotations`, isso registra quem saiu, quem entrou e em qual lugar (a diferença para a partida anterior), sem campo redundante que possa contradizer. Fica no `schemaVersion` 1, porque nada foi gravado (ADR 0023). É o último campo validado, porque é conferido contra `teams`.

**Evento novo `QueueChanged { matchId, queue }`,** com a fila inteira e só com partida aberta, para quem chega ou vai embora no meio da partida. O aplicador confere a sobreposição contra o `teams` congelado da partida aberta, nunca contra o estado que muda, e vale o último na ordem canônica, como o `LineupChanged`. Não há evento de "abrir quadra": o stream continua abrindo com `MatchStarted`.

**Nomes do glossário:** a fila é `TeamQueue` (`{ teams, players }`), e cada saída do plano é um `PartialExit` (`{ consecutiveMatches, incoming, outgoing, place }`). O plano usava `CourtQueue`; ficou o nome do glossário.

**`CourtSessionState.queue` fica no topo,** ao lado de `currentMatch`, e é trocado a cada `MatchStarted` e `QueueChanged`, nunca acumulado. O `MatchEnded` mantém a fila. O estado inicial começa com a fila vazia, e `FinishedMatch` não guarda fila. Ordem de chaves: `currentMatch`, `finishedMatches`, `queue`; na fila, `players`, `teams`.

**Validação.** Membros em UUID minúsculo, sem repetir na fila, sem sobrepor `teams.a` nem `teams.b`; cada time da fila tem de 1 a 24 membros (`MAX_TEAM_MEMBERS`); no total, até `MAX_QUEUE_MEMBERS` = 96, quatro times cheios. É limite técnico: o payload fica abaixo de 300 valores, longe dos 4096 do envelope. Ordem: `queue` (não objeto), `queue.teams` (lista, cada time, ninguém em dois times), `queue.players` (lista, repetido, alguém de um time da fila), `queue` (total acima de 96 e, no `MatchStarted`, alguém em quadra). O esquema fechado passa a descrever listas de objetos, e a chave desconhecida dentro de um time da fila é conferida primeiro, como nos outros níveis.

**Partidas seguidas são cálculo, nunca gravadas.** `getConsecutiveMatches(state, memberId)` conta quantas partidas terminadas seguidas, terminando na última, tiveram o membro em `teams.a.memberIds` ou `teams.b.memberIds`: inclui banco e líbero (P1), o fim `manual` e o `winner: null`. A partida aberta não conta, e o `RevertedTo` desfaz a contagem junto com o estado. `getMatchesPlayed` conta o total da rodada, para o desempate (P2). A varredura vai até 200 partidas (`MAX_FINISHED_MATCHES`).

**Saída automática no `planNextMatch(state, { criterion, criterionInput, playersPerTeam })`.** Recusa com partida aberta (`match-already-open`), sem partida terminada (`no-finished-match`) e com `playersPerTeam` fora de 1 a 24 (`invalid-players-per-team`). A partir da última partida terminada:

- `winner: null` ou fila vazia: ninguém sai.
- Há time na fila: sai o perdedor inteiro, e o primeiro time da fila entra no lado dele, com a rotação desligada (a E4.7 monta a escalação). `enteringTeam` diz o lado.
- Só há avulsos: saem `n = min(avulsos, membros do perdedor)`, escolhidos pelo critério, e entram os `n` primeiros avulsos.
- Quem sai vai para o fim de `players`, na ordem do time. Com `players.length >= playersPerTeam`, os primeiros formam um time, por ordem de chegada, quantas vezes couber.
- Fila que passaria de 96 dá `invalid-payload` com `field` `queue`, o que o `startMatch` recusaria.

**Quem entra herda o lugar:** o mesmo índice em `lineup`, em `bench` ou, com a rotação desligada, em `teams.<lado>.memberIds`. No lugar do líbero, quem entra vai para o fim do banco, e `libero` fica `null` (P1). A dupla de quem entra com quem sai segue a ordem do time, nunca a do critério: o i-ésimo avulso entra no lugar do i-ésimo que sai, na ordem de `memberIds`. O vencedor fica igual.

**A rotação da próxima partida continua de onde parou:** o `setterZone` é o do fim da partida (`FinishedMatch.rotations`), para os dois times, como na virada de set. É o que deixa "Davi, posição 1" da tela 11 literalmente certo. É decisão pequena, fácil de mudar.

**Critérios são a Strategy `QueueExitCriterion`** (`decisoes.md:28`; `IQueueExitCriterion` no C#), num mapa por chave: `consecutive-matches` (padrão; desempate pela P2, por isso recebe `arrivalOrder`), `arrival-order` (recebe `arrivalOrder` da E3), `draw` (recebe `drawOrder` já embaralhado: o motor não tem aleatoriedade, ADR 0024) e `manual` (recebe `chosen`, com exatamente `n` membros do perdedor). `arrivalOrder` precisa ter todos os candidatos; `drawOrder` é uma permutação do time. Critério desconhecido ou entrada inválida dá `invalid-exit-choice`.

**`playersPerTeam` e o critério vêm da configuração resolvida** (ADR 0017), como entrada do comando. Não vão para o evento, porque o resultado já está gravado.

**Comando `changeQueue(state, queue)`** para quem chega ou sai durante a partida: recusa sem partida aberta (`no-open-match`), com alguém em quadra (`invalid-payload`, `queue`) e com a fila igual (`queue-unchanged`, código novo, como o `lineup-unchanged`).

## Contrato para a E2.10 (C#)

**A E2.10 porta** o parser de `queue` e do `QueueChanged` (com a chave desconhecida dentro dos times da fila), o aplicador, `isQueueOverlappingTeams`, `getConsecutiveMatches`, `getMatchesPlayed` e as constantes `MAX_QUEUE_MEMBERS` e `QUEUE_CHANGED_EVENT_TYPE`.

| Arquivo em `packages/match-engine/golden/` | O que tem |
|---|---|
| `queue-events.json` | 24 casos no formato de `event-log.json`, com o campo opcional `consecutiveMatches` (`{ memberId: n }`): fila gravada no `MatchStarted`, `QueueChanged` que troca e esvazia, sobreposição, repetido, 96 e 97, time de 0 e de 25, sem partida aberta, outro `matchId`, escritores intercalados, `RevertedTo` antes do `QueueChanged` e antes do segundo `MatchStarted`, `queue` ausente e `null`, `MatchEnded` mantendo a fila e 200 partidas terminadas |
| `queue-plans.json` | 32 casos `{ id, input: { state, criterion, criterionInput, playersPerTeam }, expected: { ok: true, enteringTeam, exits, queue, rotations, teams } \| { ok: false, code } }`. Fica só em TS, salvo decisão da E3.7. **Mudou:** o ADR 0050 (E2.12) porta o planejador para o C# e acrescenta `exitMode`, `winnerExit` e `winnerCriterionInput` na entrada, e `enteringTeams`, `side` e `winnerLeaving` na saída |
| `score-payloads.json` | Acrescenta 122 casos: `queue` no `MatchStarted` e a matriz inteira do `QueueChanged`, com `field` e ordem de validação |
| `score-events.json`, `rotation-events.json`, `bench-events.json`, `libero-events.json` | Migrados só com o acréscimo de `queue` vazio no payload e no estado |

Os esperados foram decididos à mão, em scripts descartáveis fora do repositório, que não importam o motor. O diff da migração não tem linha removida além da vírgula acrescentada. Os golden reprovam as mutações do plano: contar o total em vez das seguidas, contar só o `lineup`, dupla na ordem do critério, quem entra no fim do `lineup`, quem sai no início da fila, saída inteira com só avulsos, saída com `winner: null`, aplicador que acumula a fila, aceita sobreposição ou não grava a fila do `MatchStarted`, vencedor alterado e `setterZone` reiniciado.

Pontos de divergência, além dos ADR anteriores:

- **Ordem de chaves:** `currentMatch`, `finishedMatches`, `queue` no estado; `players`, `teams` na fila; `matchId`, `queue` no `QueueChanged` parseado; no plano, `enteringTeam`, `exits`, `queue`, `rotations`, `teams`; na saída, `consecutiveMatches`, `incoming`, `outgoing`, `place`; no lugar, `area`, `index` (o líbero só tem `area`).
- **Lista de objetos no esquema fechado:** a chave desconhecida dentro de um time da fila é `unknown-field`, conferida antes de qualquer campo.
- **Desempate estável:** seguidas, depois total, depois a posição em `arrivalOrder`. Sem `localeCompare` nem comparação de UUID.

## Consequências

- **Identidade do time:** o evento não leva rótulo nem cor. A E4 associa a cor pelo lado, e quem entra inteiro assume o lado do perdedor. Se a E4 precisar de `teamId`, acrescenta antes da produção.
- **Rascunho entre o `MatchEnded` e o `MatchStarted`** só existe na tela: se o app fechar, recalcula, e o critério `draw` ou o `manual` se perdem. Fica para a E4.9.
- **O evento prova formato, não verdade:** um `QueueChanged` ou um `queue` forjado decide quem joga a próxima, com efeito em saldo e rating. A E3.7 confere a fila contra a presença da rodada e autoriza por papel, como nos ADR 0027 e 0028.
- **Quem chega entre partidas** entra na fila do plano antes do "Confirmar" (a E4 decide como); `QueueChanged` só existe com partida aberta.
- **Custo:** o estado não cresce por evento, porque a fila é trocada. Cada `QueueChanged` tem no máximo cerca de 3,5 KB de IDs; a E3.7 conta eventos por partida, como no `LineupChanged`.
