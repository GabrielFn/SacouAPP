# Resumo da rodada (tela 12)

Regras de texto e de quem aparece na tela 12 do app (E4.12 Parte 1). Os números vêm do servidor (`GET /v1/groups/{groupId}/rounds/{roundId}/summary`, E3.9; ver `estatisticas.md`): o app **não recalcula nada**, só formata.

## De onde vem cada número

| Na tela | Campo |
|---|---|
| "Racha de terça · 4 partidas" | nome do grupo (cache) e `finishedMatches` (a partida aberta não conta) |
| MVP do dia, nome | `mvp.memberIds[0]` pelo apelido do cache de membros; sem apelido, "Jogador" (nunca o ID) |
| "Laranja · +2 de saldo · 2 vitórias em 3" | `mvp.side`, `plusMinus`, `wins`, `matchesPlayed` |
| "Time que mais venceu" | `sides.mostWins` (lado e `wins`) |
| "Maior sequência" | `sides.longestStreak` (lado e `longestWinStreak`) |

## Regras

- **MVP pelo maior saldo**; o desempate é do servidor (E3.9, 3.2). Sem MVP (`mvp: null`: grupo desligou "MVP do dia" ou "Pelos dados do placar", ou sem partida): não há cartão escuro e os cartões de time continuam.
- **Lado = cor do time:** `a` é "A Laranja" e `b` é "B Azul" (mesma identidade do sorteio, `teamIdentity`). O cartão do MVP diz a cor do lado dele.
- **Destaque empatado some:** o servidor devolve `null` e o cartão não é desenhado; se só um some, o outro ocupa a linha inteira.
- **Sinal do saldo:** `+2`, `0`, `−2` (U+2212). Plurais: "1 partida", "1 vitória em 1", "0 vitórias em 2", "1 seguida".
- **Calculado pelo placar** só aparece quando o MVP não veio de votação (`source` diferente de `votes`; ausente conta como placar).
- **Areia:** até a E4.18 mostra os cartões de time e nenhum cartão de MVP (o MVP de dupla ou quarteto, `kind: "team"`, e o "Ranking do dia" são da tela 12b).
- **Rating e nota nunca aparecem** (ADR 0047): nenhuma chave de rating na resposta; teste de contrato e varredura dos textos.
- **Pontos ainda neste celular:** se o log da quadra tem pontos desta rodada sem envio, a tela avisa "Ainda faltam N pontos para enviar. O resumo pode mudar." (derivado do log, nunca guardado). Quando o envio confirma, o resumo é lido de novo.
- **Sem internet:** abre o último resumo visto (aviso discreto); sem cache, "Sem internet" com "Tentar de novo".

## Entradas

Parte 1: linha "Resumo da rodada" nas telas da rodada (06 e 26), depois do horário de início e para rodada não cancelada (pergunta 152). "Encerrar rodada", o card do Início e "Mandar pro grupo" são da Parte 2.
