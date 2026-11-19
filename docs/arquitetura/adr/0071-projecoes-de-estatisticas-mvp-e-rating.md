# ADR 0071 · Projeções de estatísticas, MVP e rating OpenSkill

**Status:** aceito em parte (19/11/2026): as Partes 1 (motor TS do resumo da rodada), 2 (rating TS, `packages/rating`) e 3 (porte C# dos dois) da E3.9. A Parte 4 (projeções e rotas) completa este ADR. **Tarefa:** E3.9. Plano em [`docs/estado/tarefas/E3.9.md`](../../estado/tarefas/E3.9.md). Regras em [`estatisticas.md`](../../dominio/estatisticas.md). Estende o [ADR 0032](0032-estatisticas-por-jogador.md), o [ADR 0047](0047-nota-do-admin-e-rating-openskill.md) e o [ADR 0048](0048-modos-de-fila-votacao-e-areia.md).

## Padrões adotados (perguntas 97 a 99, respostas antes do merge da Parte 4)

- **97, fórmula do MVP pelos dados:** opção 1 (saldo; aproveitamento; sequência; partidas; primeira aparição). Na areia, a dupla ou o quarteto em 1º do ranking do dia.
- **98, semente do rating:** opção 1, confirmada pelo Gabriel (o rating é refeito com a nota atual e guarda a semente usada). Feita na Parte 2.
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

## Decisões da Parte 2 (rating TS)

**Um pacote à parte, `@sacou/rating`.** TS puro e determinístico (as mesmas regras de lint do motor: sem módulos do Node, sem `Date`, `Math.random` nem `crypto`). Fica fora do app e do motor, para não pesar no bundle e porque nada no celular pode ver o rating: o teste `architecture.test.ts` reprova se `apps/mobile`, `match-engine` ou `volley-rules` citarem o pacote. Depende de `@sacou/volley-rules` só pelo `Result`. Os tipos de entrada são estruturais: o `FinishedMatchResult` do motor cabe no `RatedMatch` sem o pacote depender do motor (teste de tipo).

**Dependência `openskill` 5.0.1**, fixada sem faixa (um teste confere o `package.json`), licença MIT. Ela traz `ramda`, `sort-unwind` e cerca de 150 pacotes pequenos do `@stdlib` (Apache-2.0; um Apache-2.0 e BSL-1.0); nenhum aviso novo no `pnpm audit` (o High listado é a exceção já registrada). Só o servidor usará o rating, pelo porte C# da Parte 3; o pacote TS serve de referência e de fonte do golden.

**Parâmetros todos explícitos.** `rateTwoTeams` passa ao `rate()` o modelo (`plackettLuce`), `beta`, `tau`, `kappa`, `limitSigma`, `balance: false`, `mu`/`sigma` (só preencheriam um rating ausente, o que não acontece) e o γ escrito no pacote, `√σ²ᵢ / c`, igual ao padrão da biblioteca. Com `balance` desligado, `z`, `alpha` e `target` não são lidos. O C# implementa exatamente essas fórmulas. `rating-params.json` é lido com conferência de tipos (positivo, versão inteira) e falha na carga se estiver corrompido, como o catálogo de formações.

**`ratePool(params, seeds, rounds)`** devolve `Result` com a lista `{ memberId, pool, seedTenths, seedSource, mu, sigma, matchesRated }` (regras 18 a 25 de [`estatisticas.md`](../../dominio/estatisticas.md)). Recebe as rodadas inteiras (`roundId`, `startsAt`, `canceled`, `modality`, `matches`) e faz ele mesmo o filtro das canceladas, a ordem e a separação dos pools, para o "do zero = incremental" ser uma função só. Fold imutável por partida (cópia do `Map`, pool de dezenas de membros); refeito do zero a cada chamada, nunca incrementado.

**Semente guardada** (resposta 98 do Gabriel, opção 1): a saída leva `seedTenths` e `seedSource`, que a Parte 4 grava em `stats.member_ratings` para medir depois do piloto o quanto o rating corrigiu a nota.

**Golden de fonte independente.** `scripts/generate-golden.ts` usa só a `openskill` e as entradas à mão: no `rating-pools.json`, cada caso diz à mão quais partidas avaliam, com quem de cada lado e em que ordem, e quem sai em cada pool; o gerador nunca chama o `ratePool`. Os testes TS exigem igualdade exata; o C# usa tolerância relativa de 1e-9 (risco 3 do plano). O caso do piso do σ usa `kappa` 0,999999, porque com o `kappa` do piloto o piso só age com σ muito maior que o resto do time.

## Decisões da Parte 3 (porte C#)

**Resumo da rodada no Matches.** `RoundSummaryRules.GetRoundSummary(timeline, options)` em `Matches/Domain/CourtSessions/PlayerStatistics/`, com `MatchResults`, `MvpByStats`, `BeachRanking` e `Comparisons`, os mesmos campos e a mesma ordem do TS; o golden `round-summary.json` é igual exato no C#, inclusive na ordem das chaves. Tudo `internal`; a Parte 4 expõe o resultado pelo contrato `ICourtSessionResults`.

**Custo** (condição 1 da Parte 1). Os ralis saem uma vez (`MatchTallies.PlayedRallies`) e são divididos entre as estatísticas e o resultado das partidas; o saldo por partida soma em listas locais, indexadas por um `ImmutableDictionary.Builder` (o domínio da quadra não usa `Dictionary` nem `HashSet`, ADR 0033, D10). Pior caso legal medido por `RoundSummaryWorstCaseTests` (200 partidas de 24 contra 24, rotação ligada, troca de saque em todo rali, 19.600 eventos), em Debug na máquina local, sozinho: replay 0,83 s e resumo 1,17 s (contra 1,8 s do TS). Um teto em segundos reprovou na bateria com os outros assemblies em paralelo (5,6 s), então o teto é relativo: o resumo pode custar até 4 replays do mesmo log, no mesmo processo e sob a mesma carga, o que pega uma volta quadrática e não o ruído. A chave do time da areia ordena os IDs com `StringComparer.Ordinal`, a mesma ordem UTF-16 do `sort()` do TS (condição 2).

**Rating no Stats.** `Stats/Domain/Ratings/`: `RatingParams` (com `SupportedVersion = 1`, conferida contra o JSON por teste), `Skill` (`readonly record struct`), `SeedRules`, `PlackettLuce` e `RatingPool`. Os parâmetros vêm do mesmo `packages/rating/src/rating-params.json`, embutido no assembly (`Stats/RatingParameters/EmbeddedRatingParams`, leitura estrita fora do domínio, como o catálogo de formações). O `PlackettLuce` porta só o caso de dois times com vencedor (sem empate, regra 18), com as operações na ordem da biblioteca; inclui o `limitSigma`, que o golden `o9` cobre. Nada tem rota, banco nem log nesta parte.

**Três diferenças do TS, de propósito.**

1. **Membro repetido no `onCourt`** (condição 1 da Parte 2): o motor nunca põe o mesmo membro duas vezes numa partida (um membro está num time só), mas o fold do TS deixaria a última atualização ganhar. O C# recusa com `stats.rating-duplicate-member`, num lado ou nos dois, mesmo em partida sem vencedor.
2. **Tipos no lugar de texto.** `MemberId` (Guid) para os membros, `Guid` para a rodada e `DateTimeOffset` para `startsAt`, ordenado pelo instante em UTC; o desempate é o `roundId` em texto (`"D"`, minúsculo) com ordem ordinal, a mesma do TS. Por isso o `invalid-starts-at` não existe no C#: um instante tipado não tem forma errada. A condição 2 da Parte 2 (forma fixa do `startsAt`) deixa de valer para o servidor, que usa o C# e passa o instante tipado.
3. **Leitura dos parâmetros mais estrita:** chave repetida ou desconhecida reprova a carga (o TS não vê chave repetida).

Os códigos de erro do C# são `stats.rating-invalid-level`, `stats.rating-duplicate-seed` e `stats.rating-duplicate-member`, sem o `memberId` (nada de dado no erro de um dado escondido).

## Consequências

- Rodada sem partida terminada: `finishedMatches` e `players` vazios, destaques e MVP nulos; na areia, `ranking: []`.
- Partida terminada à mão sem nenhum rali tem `onCourt` vazio nos dois lados: ninguém esteve num rali ativo. O rating (Parte 2) não a avalia.
- O plano pedia "4 duplas, 9 partidas" para a tela 12b, mas 7-2, 5-4, 4-5 e 2-7 somam 18 vitórias: o caso do golden tem 18 partidas.
- O rating da Parte 2 não tem rota, banco nem log: nada o expõe até a Parte 4, que o grava e prova que nenhuma rota o devolve.
