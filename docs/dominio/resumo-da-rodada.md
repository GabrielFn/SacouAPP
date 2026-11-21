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

- Linha "Resumo da rodada" nas telas da rodada (06 e 26), depois do horário de início e para rodada não cancelada (pergunta 152).
- **Início (pergunta 153):** o card "Rodada de ter, 3/11 · Ver resumo" aparece do início da rodada até 24 h depois do fim. A lista de rodadas ainda não traz o `endsAt`, então o app usa o fim automático (início + 6 h, `ROUND_DURATION_MS`); um `close` adiantado não encurta a janela do card (pendência: `endsAt` na lista e janela de 30 h no servidor).
- **Encerrar rodada (pergunta 150)**, na tela 11 (link sob "Confirmar") e no menu 23 ("Encerrar rodada · fecha a noite toda", em vermelho): chama `POST .../close` (melhor esforço: offline, 5xx e rodada cancelada não impedem), fecha a sessão no celular (os pontos continuam sendo enviados), dispara um envio e abre o resumo com `replace`. A rodada que ainda não começou (`409 sessions.round-not-started`) para antes de fechar a quadra e mostra a mensagem. Por isso o servidor é chamado antes de fechar a sessão local. Com partida em andamento (pergunta 151) o menu pede confirmação: "A partida em andamento (12 × 10) não entra no resumo. Encerrar a rodada?".
- **Mandar pro grupo · WhatsApp:** texto puro pelo `ShareSheet`, sem link, rating nem nota: "Resumo do Racha de terça · 4 partidas. MVP do dia: Bia (+2 de saldo, 2 vitórias em 3). Time que mais venceu: A Laranja, 2 vitórias. Maior sequência: A Laranja, 2 seguidas." Destaque `null` e MVP `null` não entram no texto.

## Votação no app (tela 12a, E4.18)

A apuração, a janela e quem pode votar são do servidor ([`mvp.md`](mvp.md), ADR 0072). O app só mostra a cédula de `GET .../mvp-voting` e manda o voto por `POST .../mvp-voting/vote`; a rota `result` não é lida.

- **Estados:** carregando; sem internet e sem cache; erro; votação desligada (`404 stats.mvp-voting-off`, "Ver resumo"); ainda fechada ("Abre às 02h30", no fuso do aparelho); escolhendo (cédula, nota e botão); não elegível ("Só vota quem jogou nesta rodada.", sem cédula); já votou ("Você votou em Bia. Seu voto é secreto."); fechada ("A votação fechou.", o resultado fica na 12). O voto da própria pessoa vindo do servidor vence qualquer escolha feita na tela.
- **Prazo (pergunta 176):** "fecha em 23 h" em horas inteiras para baixo; abaixo de 1 h, minutos para baixo, mínimo "1 min". O relógio do aparelho só indica: quando chega `opensAt` ou `closesAt` com a tela aberta, a cédula é lida de novo, e o servidor diz o estado.
- **Ordem da cédula (pergunta 177):** mais partidas, depois mais saldo, depois a ordem do servidor. Nada pré-selecionado (pergunta 171); o botão diz "Escolha quem foi o MVP" até a escolha e "Votar em Bia" depois ("em", porque o app não sabe o gênero do apelido; o desenho diz "na").
- **Linha do candidato:** "Laranja · 5 partidas · +34"; sem lado (`mainSide: null`, como na areia, pergunta 173) só "5 partidas · +34".
- **Sem internet (pergunta 172):** a última cédula vista nesta abertura do app aparece com a faixa "Sem conexão" e o botão "Conecte-se para votar", desabilitado. O voto nunca fica guardado para enviar depois.
- **Toque duplo:** só um voto sai por vez; o segundo toque não chama a API.
- **Nunca aparece:** contagem de votos, número de votantes, "faltam N", quem votou em quem. O próprio voto só na 12a e para a própria pessoa. Os textos de recusa não citam o candidato.

## Areia e MVP da votação (tela 12b e entrada na 12, E4.18 Parte 2)

- **Areia (`beach-2x2`, `beach-4x4`):** a tela 12 troca os cartões de time pelo "Ranking do dia", uma linha por time na ordem do servidor (posição 1 a n, sem repetir; o desempate é da E3.9): "Bia e Gabi · 7 vitórias · 2 derrotas", com "· 1 sem vencedor" quando alguma partida acabou sem vencedor. O cabeçalho ganha "· duplas" ou "· quartetos". Time remontado com outro parceiro é outra linha. Sem `ranking` do servidor a lista fica vazia (nada é inventado).
- **MVP de time (`mvp.kind: "team"`):** "Bia e Gabi" e "7 vitórias · ficaram 4 seguidas na quadra" (a sequência só com 2 ou mais).
- **MVP da votação (`mvp.source: "votes"`):** o nome do vencedor, ou os nomes juntos num empate, e "Escolhido pela galera" no lugar de "Calculado pelo placar". Com um vencedor só, a linha de números continua; num empate só os nomes. Nunca número de votos. Votação fechada sem votos volta a `source: "stats"`.
- **Entrada da votação (pergunta 170):** só com `mvpVoting`. `notOpen`: "A votação do MVP abre quando a rodada terminar"; `open` e pode votar: botão "Votar no MVP · fecha em 23 h" para a 12a; `open` e já votou: "Você já votou · resultado em 23 h", sem o nome; `open` sem poder votar, `closed` ou votação desligada: nada. Com a votação aberta e MVP pelos dados, o cartão ganha "Votação da galera aberta". A cédula só é lida com `state: "open"` (consulta dependente, fora do cache persistido).
- **Relógio:** o prazo se redesenha a cada minuto (porta `Scheduler`, nada guardado) na 12 e na 12a; ao chegar `opensAt` ou `closesAt` com a tela aberta, o resumo e a cédula são marcados como velhos e lidos de novo, e o servidor diz o estado.
- **Mandar pro grupo (areia):** "Resumo do Areia de sábado · 9 partidas · duplas. MVP do dia: Bia e Gabi (7 vitórias). Ranking do dia: 1. Bia e Gabi, 7-2; 2. Caio e Léo, 5-4; ..." (até 5 linhas). MVP da votação: "MVP do dia (escolhido pela galera): Bia." O texto nunca traz o voto da pessoa, contagem nem prazo.
