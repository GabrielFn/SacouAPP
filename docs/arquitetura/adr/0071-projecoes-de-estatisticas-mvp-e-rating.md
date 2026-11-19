# ADR 0071 · Projeções de estatísticas, MVP e rating OpenSkill

**Status:** aceito em parte (19/11/2026): a Parte 1 da E3.9 (motor TS do resumo da rodada). As Partes 2 a 4 (rating, porte C#, projeções e rotas) completam este ADR. **Tarefa:** E3.9. Plano em [`docs/estado/tarefas/E3.9.md`](../../estado/tarefas/E3.9.md). Regras em [`estatisticas.md`](../../dominio/estatisticas.md). Estende o [ADR 0032](0032-estatisticas-por-jogador.md), o [ADR 0047](0047-nota-do-admin-e-rating-openskill.md) e o [ADR 0048](0048-modos-de-fila-votacao-e-areia.md).

## Padrões adotados (perguntas 97 a 99, respostas antes do merge da Parte 4)

- **97, fórmula do MVP pelos dados:** opção 1 (saldo; aproveitamento; sequência; partidas; primeira aparição). Na areia, a dupla ou o quarteto em 1º do ranking do dia.
- **98, semente do rating:** opção 1 (o rating é refeito com a nota atual). Entra na Parte 2.
- **99, presença:** opção 1 (rodadas em que jogou ÷ rodadas jogadas do grupo desde que entrou). Entra na Parte 4.

## Decisões da Parte 1

**Uma função pura do resumo.** `getRoundSummary(timeline, options)` em `packages/match-engine/src/stats/round-summary.ts`, com `options = { modality, mvpEnabled, mvpByStats, individualPoints }` vindos da configuração resolvida da rodada. Devolve `{ mvpFormulaVersion, finishedMatches, players, sides, mvp, ranking }`, nessa ordem de chaves, que é contrato com o porte C# (golden `packages/match-engine/golden/round-summary.json`). Nada é gravado: o servidor guarda o resultado como cache (Parte 4) e o refaz do zero quando qualquer entrada muda.

**Resultado das partidas.** `getMatchResults(timeline)` devolve, por partida terminada e na ordem dos `MatchEnded`, `matchId`, `winner`, `teams` (como no `MatchStarted`), `onCourt` (quem esteve em quadra em pelo menos um rali ativo, na ordem de `teams`) e `points` (ralis ganhos por lado). `points` não estava no plano: o ranking da areia precisa do saldo de pontos do time, e tirá-lo dos ralis evita outra passada (desvio pequeno). Os ralis saem de `getPlayedRallies`, extraída de `rally-balance.ts` sem mudar o saldo da E2.9.

**Forma do MVP** (lacuna L1 do adendo do plano, pedida pela E3.18 e pela E4.12): `{ kind, memberIds, side, matchesPlayed, wins, plusMinus, longestWinStreak }`. `kind` é `player` (um membro, com `side`) ou `team` (a dupla ou o quarteto, `side: null`); `memberIds` é sempre lista, para caber o MVP dividido da votação. No time, `plusMinus` é o saldo de pontos do time. A E3.18 acrescenta `source`.

**Destaques por lado** (lacuna L3): `sides.mostWins: { side, wins }` e `sides.longestStreak: { side, longestWinStreak }`, cada um `null` no empate, a partir de `getSideStats`.

**Ranking só na areia.** Na quadra, `ranking: null` (chave presente, para o contrato ter forma fixa). Cada linha tem `memberIds`, `wins`, `losses`, `undecided` (lacuna L7), `longestWinStreak`, `pointsFor`, `pointsAgainst`.

**Comparações em inteiros.** O aproveitamento compara `w1 × m2` com `w2 × m1`; nenhuma ordem usa ponto flutuante, para o TS e o C# empatarem nos mesmos casos. O empate total fica com a ordem da primeira aparição (ordenação estável), nunca com o UUID; a chave do time ordena os IDs só para comparar.

**Ponto individual desligado** (pendências 95 e 104): o servidor não recusa o `PointAttributed` na escrita (a opção pode mudar durante a rodada; recusar travaria um celular honesto, pergunta 69). O resumo zera `pointsByKind` quando `individualPoints` é falso; o saldo não muda. Fecha a linha da pendência 104 por esta decisão.

**Versão da fórmula.** `MVP_FORMULA_VERSION = 1` vai em todo resumo; trocar a fórmula sobe a versão e invalida as projeções.

## Consequências

- Rodada sem partida terminada: `finishedMatches` e `players` vazios, destaques e MVP nulos; na areia, `ranking: []`.
- Partida terminada à mão sem nenhum rali tem `onCourt` vazio nos dois lados: ninguém esteve num rali ativo. O rating (Parte 2) não a avalia.
- O plano pedia "4 duplas, 9 partidas" para a tela 12b, mas 7-2, 5-4, 4-5 e 2-7 somam 18 vitórias: o caso do golden tem 18 partidas.
