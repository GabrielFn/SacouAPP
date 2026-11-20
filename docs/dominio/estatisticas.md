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

`getRoundSummary(timeline, options)` junta tudo o que o pós-jogo mostra, com as opções da rodada resolvida (`format.modality`, `mvp.enabled`, `mvp.byStats`, `mvp.individualPoints`). Código em `packages/match-engine/src/stats/round-summary.ts` e, no servidor, `RoundSummaryRules` (`Matches/Domain/CourtSessions/PlayerStatistics/`); casos em `packages/match-engine/golden/round-summary.json`, lidos pelos dois. A **votação do MVP** (E3.18, opção `mvp.voting`) tem regras próprias em [mvp.md](mvp.md) e não mexe nesta fórmula nem na projeção.

10. **Resultado das partidas** (`getMatchResults`): por partida terminada, na ordem dos `MatchEnded`, o vencedor, `teams` como no `MatchStarted`, `onCourt` (quem de `teams` esteve em quadra em pelo menos um rali ativo, pelas regras 2 e 3, na ordem de `teams`; o banco que não entrou fica só em `teams`) e `points` (ralis ganhos por lado). Partida aberta não entra. Partida terminada à mão sem nenhum rali tem `onCourt` vazio.
11. **MVP do dia pelos dados, fórmula 1** (pergunta 97): entre quem jogou uma partida terminada, o maior `plusMinus`; empate, o maior aproveitamento `wins / matchesPlayed`, comparado em inteiros (`w1 × m2` contra `w2 × m1`: 2 de 3 empata com 4 de 6); depois a maior `longestWinStreak`; depois mais `matchesPlayed`; por fim a primeira aparição (regra 9), nunca o UUID. `winner: null` não é vitória. Sem partida terminada, ou com `mvp.enabled` ou `mvp.byStats` desligado, `mvp: null`. A versão da fórmula (`mvpFormulaVersion`, hoje 1) vai em todo resumo.
12. **Lado do MVP** (o "Laranja" da tela 12): o lado em que ele jogou mais partidas; empate, o da última partida dele.
13. **Forma do MVP:** `{ kind, memberIds, side, matchesPlayed, wins, plusMinus, longestWinStreak }`. Na quadra, `kind: "player"`, um membro e o `side`. Na areia, `kind: "team"`, a dupla ou o quarteto em 1º do ranking, `side: null` e `plusMinus` = saldo de pontos do time.
14. **Destaques por lado:** "Time que mais venceu" é o lado com mais `wins` (`sides.mostWins: { side, wins }`) e "Maior sequência" o lado com a maior `longestWinStreak` (`sides.longestStreak: { side, longestWinStreak }`), de `getSideStats`. Empate → `null`, e a tela esconde o cartão.
15. **Ranking do dia da areia** (`beach-2x2` e `beach-4x4`, ADR 0048): um time é o conjunto de `teams.<lado>` da partida, sem ordem; composição diferente é outro time (dupla remontada pela fila conta à parte). Por time: `wins`, `losses`, `undecided`, `longestWinStreak` (vitórias seguidas do time nas partidas que ele jogou; derrota e sem vencedor quebram), `pointsFor` e `pointsAgainst` (ralis). Ordem: mais `wins`; menos `losses`; maior `longestWinStreak`; maior saldo de pontos; primeira partida do time. Os membros saem na ordem da primeira partida do time. Na quadra, `ranking: null`.
16. **Ponto individual desligado** (`mvp.individualPoints`): o servidor não recusa o `PointAttributed` (a opção muda durante a rodada), mas o resumo zera `pointsByKind`; o saldo não muda.
17. **Somas da cartinha e do perfil** (Parte 4 da E3.9): por membro e por usuário, só de rodadas não canceladas, no ano civil de `America/Sao_Paulo`: `matchesPlayed`, `wins`, `losses`, `plusMinus`, `longestWinStreak` (a maior entre rodadas, concatenando `results` na ordem das rodadas: a sequência atravessa rodadas), `mvpCount`, `rounds` e `presence` (pergunta 99: rodadas em que jogou ÷ rodadas jogadas do grupo desde que entrou). Só inteiros; a tela calcula o percentual.

## Rating OpenSkill escondido (E3.9 Parte 2, ADR 0047 e 0071)

Código em `packages/rating/` (`ratePool`, `seedOf`, `levelOf`) e, no servidor, `Stats/Domain/Ratings/` (`RatingPool`, `SeedRules`, `PlackettLuce`); casos em `packages/rating/golden/`, lidos pelos dois. O C# recusa o mesmo membro duas vezes no `onCourt` de uma partida (`stats.rating-duplicate-member`) e recebe `startsAt` como instante tipado (ADR 0071, Parte 3). **Ninguém vê o rating no piloto:** nem rota, nem evento, nem log, nem exportação (Parte 4). O sorteio continua usando a nota do admin.

18. **Modelo:** Plackett-Luce da `openskill` (Weng-Lin), dois times por partida, `rank` 1 para o vencedor e 2 para o perdedor. Partida com `winner: null` **não avalia ninguém**.
19. **Quem é avaliado:** quem esteve em quadra num rali ativo (`onCourt` de `getMatchResults`, regra 10), peso 1. O banco que não entrou não muda. Partida terminada à mão sem nenhum rali tem `onCourt` vazio e não avalia ninguém. Quem só aparece em `teams` sai na lista com a semente e `matchesRated: 0`.
20. **Pools:** `indoor` (`indoor-6x6`) e `beach` (`beach-2x2` e `beach-4x4` juntos), por `MemberId` do grupo. O mesmo membro tem um rating em cada pool em que jogou.
21. **Ordem:** só rodadas não canceladas, por `startsAt` e, no empate, por `roundId` em ordem ordinal; dentro da rodada, a ordem dos `MatchEnded`. A ordem em que os lotes chegaram não importa. `startsAt` vem sempre na forma `AAAA-MM-DDTHH:MM:SSZ` (UTC), para a ordem do texto ser a do tempo; outra forma é recusada (`invalid-starts-at`).
22. **Semente** (pergunta 98, opção 1): o nível resolvido **atual** do membro. `μ = mu0 + (nível − 3,0) × levelStep` (1500 e 200 por nível); σ `sigmaAdmin` (100) com a nota do admin, `sigmaUnconfirmed` (200) com sugestão ou o padrão 3,0. Membro sem nível resolvido entra como o padrão. Mudar a nota refaz o pool inteiro do zero; cada linha guarda a semente usada (`seedTenths`, `seedSource`) para a calibração depois do piloto. Nível fora de 1,0 a 5,0 ou fora de décimos inteiros é recusado (`invalid-level`), e semente repetida também (`duplicate-seed`).
23. **Volta para o nível** (`levelOf`, só depois do piloto): décimos arredondados meio para cima e limitados a 1,0 e 5,0; ida e volta exata nos níveis de 0,5 em 0,5.
24. **Parâmetros** em `packages/rating/src/rating-params.json` (versão 1, a calibrar com o piloto): `beta` 100, `tau` 1, `kappa` 0,0001, `limitSigma` falso. Mudar qualquer valor sobe `ratingParamsVersion`, e o servidor refaz tudo.
25. **Saída**, por pool (`indoor` primeiro) e na ordem da primeira aparição (`teams.a`, `teams.b`, `onCourt`, partida a partida): `{ memberId, pool, seedTenths, seedSource, mu, sigma, matchesRated }`, nessa ordem de chaves, que é contrato com o porte C#.

## Projeções no servidor (E3.9 Parte 4a, ADR 0071)

26. **Cache, nunca soma.** O servidor guarda o resumo de cada rodada e o rating de cada pool como cache de funções puras, no schema `stats`; nada é incrementado em cima do valor anterior. Apagar tudo e ler de novo dá o mesmo resultado.
27. **Quando reconstrói:** só na leitura (desde a Parte 4b; a escrita da quadra não refaz nada), quando a chave mudou: outro número de eventos no stream, outra versão da projeção, ou outro estado, início, modalidade ou opção `mvp.*` da rodada. O resumo de uma rodada refaz no máximo ela; o pool do grupo só é refeito quando nenhuma outra rodada contada está velha (a leitura nunca paga mais de um replay). A temporada da pessoa refaz as rodadas velhas dos grupos dela.
28. **Pool refeito do zero** quando muda qualquer entrada: as rodadas do pool e suas chaves, a nota atual de um membro (pergunta 98) ou a versão dos parâmetros. Cancelar uma rodada a tira das somas e do rating; descancelar devolve.
29. **Rodada cancelada** continua legível no resumo, mas não entra nas somas (sem linhas por membro) nem no rating.

## Leitura, somas e exportação (E3.9 Parte 4b, ADR 0071)

30. **Resumo da rodada** (`GET /v1/groups/{groupId}/rounds/{roundId}/summary`, telas 12, 12a e 12b): qualquer membro do grupo, o Jogador inclusive. Rodada de outro grupo é o mesmo 404 da inexistente; rodada sem stream responde 200 com `finishedMatches: 0`. Campos: `roundId`, `modality`, `mvpFormulaVersion`, `finishedMatches`, `mvp` (`kind`, `memberIds` sempre lista, `side`), `sides` (`mostWins: {side, wins}`, `longestStreak: {side, longestWinStreak}`, cada um nulo no empate), `players` e `ranking` (só na areia, com `undecided`).
31. **Temporada da pessoa** (`GET /v1/me/stats?year=2026`, telas 14 e 15): só da própria pessoa, resolvida pelo token. `year` opcional (sem ele, o ano corrente em `America/Sao_Paulo`), de 2000 a 2100, e devolvido na resposta; outro valor é 400. A temporada é o ano civil da data local da rodada. Conta só rodada não cancelada, com stream.
32. **Somas:** partidas, vitórias, derrotas, saldo e quantas vezes foi MVP somam as rodadas; a maior sequência atravessa as rodadas, na ordem de jogo (início da rodada, depois o ID), e uma partida sem vencedor a quebra.
33. **Presença** (pergunta 99, opção 1): `rounds` (rodadas da temporada em que jogou pelo menos uma partida terminada) sobre `roundsHeld` (rodadas da temporada com pelo menos uma partida terminada enquanto a pessoa estava no grupo, da entrada à saída, mais as que ela jogou). A tela calcula a porcentagem; sem rodada realizada mostra "—".
34. **Grupos:** `groups[]` com `groupId`, `groupName` e `modality` do grupo (nulos para grupo de que a pessoa saiu), na ordem de mais partidas e, no empate, da entrada da pessoa. Grupo que a pessoa deixou só aparece com partida na temporada. O total soma os grupos mostrados.
35. **Exportação** (`GET /v1/me/export`, seção `stats`): por rodada em que a pessoa jogou, em qualquer grupo que tem ou teve, as estatísticas do membro e se foi MVP; rodada cancelada aparece com `counts: false` (fora das somas). **Nunca o rating nem a semente**, como a nota do admin (pergunta 42). Exclusão de conta: nada a apagar no `stats` (tudo por `MemberId`); o ex-membro continua no cálculo dos outros.

## Fora daqui

Votação do MVP (E3.18); texto da IA (E3.13, pós-piloto); esconder estatísticas (E4.13).
