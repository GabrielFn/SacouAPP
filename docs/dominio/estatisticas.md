# Estatísticas por jogador: saldo +/− em quadra, vitórias e sequência

Regras da E2.9 ([ADR 0032](../arquitetura/adr/0032-estatisticas-por-jogador.md)). Código em `packages/match-engine/src/stats/`; casos em `packages/match-engine/golden/stats-events.json`. Plano e respostas do Gabriel em [`E2.9.md`](../estado/tarefas/E2.9.md).

Tudo é **calculado** da linha do tempo de uma `CourtSession` (`replayTimeline`) e de `resolvePointAttributions`. Nada é gravado: não há evento, campo nem versão nova.

## Respostas do Gabriel (03/11/2026)

- **P1, sequência:** é o maior número de **vitórias seguidas** nas partidas que o membro jogou. "Partidas seguidas em quadra" é outra coisa, que já existe na fila ([`fila.md`](fila.md), ADR 0029).
- **P2, partida sem vencedor:** quebra a sequência. Bia vence 2, a 3ª termina à mão em 12–12 sem vencedor, Bia vence a 4ª: maior sequência 2, atual 1.
- **P3, "time" no Resumo:** é a **cor**, o lado `a` ou `b` da quadra, qualquer que seja a formação depois de uma saída parcial.

## Regras

1. **Só partidas terminadas** (`finishedMatches` do último estado). A partida aberta não conta nada, nem saldo, nem pontos individuais, nem quem só jogou nela, até o `MatchEnded`. O Resumo e o Story são pós-jogo.
2. **Quem estava em quadra no rali:** para cada `PointScored` ativo, o estado **logo antes** do ponto. Por lado, `getOnCourtBySlot(rotação, fase)`, com a fase pelo time que sacava antes do ponto, a mesma função do autor do ponto (`onCourtInTheRally`, ADR 0031). O líbero conta só quando a projeção o põe em quadra; o banco nunca. Girar ou trocar depois não muda o passado.
3. **Rotação desligada:** contam todos de `teams.<lado>.memberIds` da partida do rali (não há banco nesse modo).
4. **Saldo:** cada ponto dá +1 em `pointsFor` a cada um em quadra do lado que pontuou e +1 em `pointsAgainst` a cada um em quadra do outro lado. `plusMinus = pointsFor − pointsAgainst`. Pontos depois do último `SetEnded` e antes de um `MatchEnded` à mão contam: são da partida.
5. **Ponto revertido** não está na timeline, então não conta, nem o preenchimento dele. Um `LineupChanged` revertido também não muda quem estava em quadra.
6. **Partidas, vitórias, derrotas:** jogou quem estava em `teams.a` ou `teams.b`, inclusive banco e líbero, como `getMatchesPlayed`. O banco que não entrou leva a vitória ou a derrota, com saldo 0. `winner: null` conta como jogada e `undecided`, nunca vitória nem derrota. Fim `manual` com vencedor conta normal.
7. **Sequência:** vitórias seguidas nas partidas que o membro jogou, na ordem das partidas terminadas. Derrota e sem vencedor quebram; ficar na fila não quebra. `longestWinStreak` é a maior; `currentWinStreak` é a que termina na última partida dele.
8. **Pontos individuais:** contagem por tipo (`attack`, `block`, `ace`, `other`) das atribuições resolvidas, só de partidas terminadas. `opponent-error` não tem autor e não credita ninguém.
9. **Ordem:** membros na ordem da primeira aparição (`teams.a`, depois `teams.b`, partida a partida), nunca por UUID. Só inteiros; a tela calcula percentuais.

## Por lado (P3)

`getSideStats` devolve, para `a` e `b`, `wins`, `longestWinStreak` e `currentWinStreak` das partidas terminadas, com as mesmas regras de sequência. Com "quem perde sai", o vencedor nunca muda de formação, então a sequência de um lado é sempre a mesma formação; só o total de vitórias mistura formações.

## O que as telas usam

| Tela | Texto | Campo |
|---|---|---|
| 11 (Fim da partida) | "3ª seguida" | `getSideStats(...)[lado].currentWinStreak` |
| 12 (Resumo), MVP do dia | "Laranja · +34 de saldo · 4 vitórias em 5" | `getRoundSummary(...).mvp`: `side`, `plusMinus`, `wins` / `matchesPlayed` |
| 12 e 13 | "3 seguidas" | `longestWinStreak` |
| 12, cartões | "Time que mais venceu", "Maior sequência" | `sides.mostWins`, `sides.longestStreak` (`null` esconde o cartão) |
| 12b (Resumo da areia) | "Ranking do dia", "Bia e Gabi · 7 vitórias · ficaram 4 seguidas na quadra" | `ranking`, `mvp` com `kind: "team"` |
| 14 e 15 (Perfil e cartinha) | "48 partidas", "maior seq. 7" | a E3.9 (Parte 4) soma rodadas a partir de `players[].results` |

## Rodada simulada (critério de aceite)

A rodada do plano, com os números conferidos à mão, está no teste `stats.acceptance.test.ts` e no caso `s1` do golden. Conta de soma zero: 5×2 + 2 + 0 + 6×0 + 6×(−2) = 0. A soma zero é propriedade desta rodada, com 6 contra 6 em quadra em todo ponto, e não regra geral: com rotação desligada e times de tamanhos diferentes, a soma dos saldos não fecha em zero, e o motor está certo. Não usar como checagem na E2.10 nem na E3.9.

## Resumo da rodada (E3.9, ADR 0071)

`getRoundSummary(timeline, options)` junta tudo o que o pós-jogo mostra, com as opções da rodada resolvida (`format.modality`, `mvp.enabled`, `mvp.byStats`, `mvp.individualPoints`). Código em `packages/match-engine/src/stats/round-summary.ts`; casos em `packages/match-engine/golden/round-summary.json`.

10. **Resultado das partidas** (`getMatchResults`): por partida terminada, na ordem dos `MatchEnded`, o vencedor, `teams` como no `MatchStarted`, `onCourt` (quem de `teams` esteve em quadra em pelo menos um rali ativo, pelas regras 2 e 3, na ordem de `teams`; o banco que não entrou fica só em `teams`) e `points` (ralis ganhos por lado). Partida aberta não entra. Partida terminada à mão sem nenhum rali tem `onCourt` vazio.
11. **MVP do dia pelos dados, fórmula 1** (pergunta 97): entre quem jogou uma partida terminada, o maior `plusMinus`; empate, o maior aproveitamento `wins / matchesPlayed`, comparado em inteiros (`w1 × m2` contra `w2 × m1`: 2 de 3 empata com 4 de 6); depois a maior `longestWinStreak`; depois mais `matchesPlayed`; por fim a primeira aparição (regra 9), nunca o UUID. `winner: null` não é vitória. Sem partida terminada, ou com `mvp.enabled` ou `mvp.byStats` desligado, `mvp: null`. A versão da fórmula (`mvpFormulaVersion`, hoje 1) vai em todo resumo.
12. **Lado do MVP** (o "Laranja" da tela 12): o lado em que ele jogou mais partidas; empate, o da última partida dele.
13. **Forma do MVP:** `{ kind, memberIds, side, matchesPlayed, wins, plusMinus, longestWinStreak }`. Na quadra, `kind: "player"`, um membro e o `side`. Na areia, `kind: "team"`, a dupla ou o quarteto em 1º do ranking, `side: null` e `plusMinus` = saldo de pontos do time.
14. **Destaques por lado:** "Time que mais venceu" é o lado com mais `wins` (`sides.mostWins: { side, wins }`) e "Maior sequência" o lado com a maior `longestWinStreak` (`sides.longestStreak: { side, longestWinStreak }`), de `getSideStats`. Empate → `null`, e a tela esconde o cartão.
15. **Ranking do dia da areia** (`beach-2x2` e `beach-4x4`, ADR 0048): um time é o conjunto de `teams.<lado>` da partida, sem ordem; composição diferente é outro time (dupla remontada pela fila conta à parte). Por time: `wins`, `losses`, `undecided`, `longestWinStreak` (vitórias seguidas do time nas partidas que ele jogou; derrota e sem vencedor quebram), `pointsFor` e `pointsAgainst` (ralis). Ordem: mais `wins`; menos `losses`; maior `longestWinStreak`; maior saldo de pontos; primeira partida do time. Os membros saem na ordem da primeira partida do time. Na quadra, `ranking: null`.
16. **Ponto individual desligado** (`mvp.individualPoints`): o servidor não recusa o `PointAttributed` (a opção muda durante a rodada), mas o resumo zera `pointsByKind`; o saldo não muda.
17. **Somas da cartinha e do perfil** (Parte 4 da E3.9): por membro e por usuário, só de rodadas não canceladas, no ano civil de `America/Sao_Paulo`: `matchesPlayed`, `wins`, `losses`, `plusMinus`, `longestWinStreak` (a maior entre rodadas, concatenando `results` na ordem das rodadas: a sequência atravessa rodadas), `mvpCount`, `rounds` e `presence` (pergunta 99: rodadas em que jogou ÷ rodadas jogadas do grupo desde que entrou). Só inteiros; a tela calcula o percentual.

## Fora daqui

Votação do MVP (E3.18); rating OpenSkill (E3.9, Partes 2 e 3, ADR 0047); projeções no servidor, somas e rotas (E3.9, Parte 4); texto da IA (E3.13, pós-piloto); esconder estatísticas (E4.13).
