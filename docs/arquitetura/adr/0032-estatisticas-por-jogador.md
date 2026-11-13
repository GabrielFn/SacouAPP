# ADR 0032 · Estatísticas por jogador: calculadas da linha do tempo, só das partidas terminadas

**Status:** aceito (03/11/2026). **Tarefa:** E2.9. Plano e respostas do Gabriel em [`docs/estado/tarefas/E2.9.md`](../../estado/tarefas/E2.9.md). Regras em [`estatisticas.md`](../../dominio/estatisticas.md). Estende o [ADR 0018](0018-rating-and-mvp.md) (saldo e sequência alimentam o MVP do dia), o [ADR 0029](0029-fila-da-quadra.md), o [ADR 0030](0030-correcoes-da-linha-do-tempo.md) e o [ADR 0031](0031-ponto-individual.md).

## Decisões do Gabriel (03/11/2026)

- **P1:** sequência é vitórias seguidas, não partidas seguidas em quadra.
- **P2:** partida encerrada à mão sem vencedor quebra a sequência.
- **P3:** "time" no Resumo é a cor (lado `a` ou `b`).

## Decisões

**Só cálculo, sem evento nem campo novo.** `getPlayerStats(timeline)` e `getSideStats(timeline)`, na fatia nova `packages/match-engine/src/stats/`, leem a timeline de `replayTimeline` e `resolvePointAttributions`. `rulesVersion` e `schemaVersion` seguem em 1.

**Quem estava em quadra é o do estado logo antes do ponto**, com a fase pelo time que sacava antes dele. A função `onCourtInTheRally(match, servingTeam, team)` saiu de `attributions/commands.ts` para `score/on-court.ts`, sem mudar comportamento, e serve aos dois: o autor do ponto (ADR 0031) e o saldo. Ficou em `score/` e não em `stats/` porque `stats/` depende de `attributions/`, e o contrário criaria um ciclo.

**Só partidas terminadas**, casadas pelo `matchId`. A partida aberta não entra em nada até o `MatchEnded`. Jogou a partida quem estava em `teams` dela, banco e líbero inclusive; `winner: null` é `undecided`.

**Sem acumulador mutável.** O lint proíbe mudar um `Map` (`functional/immutable-data`). Os itens de cada partida são contíguos na timeline, porque só uma partida fica aberta por vez e o `matchId` é único; então `groupByMatch` corta a lista em trechos por partida numa passada, e `tally` soma cada trecho copiando um `Map` de no máximo dois times (2 × `MAX_TEAM_MEMBERS`) a cada passo. Depois, cada membro soma as partidas terminadas. Custo O(E + P·k + M·N): E eventos, P pontos, k ≤ 48 por partida, M membros, N ≤ `MAX_FINISHED_MATCHES` (200).

**Formato da saída.** `PlayerStats`, nesta ordem de chaves: `memberId`, `matchesPlayed`, `wins`, `losses`, `undecided`, `pointsFor`, `pointsAgainst`, `plusMinus`, `longestWinStreak`, `currentWinStreak`, `results` (`"win" | "loss" | "undecided"`, em ordem), `pointsByKind` (`attack`, `block`, `ace`, `other`). Só inteiros. `getSideStats` devolve `{ a, b }`, cada um com `wins`, `longestWinStreak`, `currentWinStreak`. Constantes novas: `MATCH_RESULTS` e `CREDITED_POINT_KINDS` (literal, com teste que confere que é `POINT_KINDS` sem `AUTHORLESS_POINT_KINDS`).

## Contrato para a E2.10 (C#)

**A E2.10 porta** `getPlayerStats` e `getSideStats` (a E3.9 calcula no servidor) e as duas constantes.

| Arquivo em `packages/match-engine/golden/` | O que tem |
|---|---|
| `stats-events.json` (novo) | 9 casos no formato de `event-log.json`, com `expected.playerStats` e `expected.sideStats`: a rodada simulada do plano, o líbero (quadras tiradas de `libero-alignment.json`), rotação desligada com ordem diferente da dos UUID, banco que não entrou, `winner: null` que quebra a sequência, fim `manual` com vencedor e ponto depois do último `SetEnded`, partida aberta, `RevertedTo` de `LineupChanged` e de ponto preenchido, rodada vazia |

Os esperados foram decididos à mão, num script descartável fora do repositório que não importa o motor. O golden reprova as mutações do plano, aplicadas por script e conferidas uma a uma: quadra do estado depois do ponto; fase do estado depois; banco contado; líbero sempre; líbero nunca; só o lado que pontuou; partida aberta contada; `winner: null` como derrota; `winner: null` sem quebrar a sequência; banco sem vitória; `teams` da última partida em vez da do rali; ordem por UUID. Duas mutações do plano não cabem no código desta fatia: o ponto revertido já não está na timeline (é o replay que o tira), e `opponent-error` tem `author: null` pelo parser, então não há a quem creditar.

Pontos de divergência, além dos ADR anteriores:

- **Ordem de chaves** de `PlayerStats` e de `SideStats`, como acima.
- **Ordem dos membros:** primeira aparição, `teams.a` e depois `teams.b`, partida a partida; nunca ordenar por UUID.
- **`results` como strings** (`win`, `loss`, `undecided`), não enum numérico.

## Consequências

- **O número muda só no fim da partida**, não a cada rali: o Resumo e o Story são pós-jogo.
- **O evento prova formato, não verdade:** um `LineupChanged` ou `PointAttributed` forjado muda saldo e pontos (ADR 0031). A autorização é da E3.7.
- **Duas quadras na rodada são dois streams:** somar e ordenar entre elas é da E3.9.
- **Dado pessoal:** saldo, vitórias e pontos por `MemberId` são dado de desempenho derivado ([inventário](../../seguranca/dados-pessoais.md)).
- **Custo:** sem medição aqui; a E4.9 mede se alguma tela calcular no celular.
