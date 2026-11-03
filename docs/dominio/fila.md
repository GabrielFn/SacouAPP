# Fila da quadra: "quem perde sai" com saída parcial

Regras da fila de uma `CourtSession` (E2.6, [ADR 0029](../arquitetura/adr/0029-fila-da-quadra.md)). Código em `packages/match-engine/src/queue/`; casos em `packages/match-engine/golden/queue-events.json` e `queue-plans.json`. Eventos em [`eventos.md`](eventos.md).

## A fila

- `TeamQueue { teams, players }`: primeiro os times inteiros que esperam, na ordem; depois os avulsos, por ordem de chegada. Cada membro aparece uma vez e nunca está num time em quadra.
- Cada time da fila tem de 1 a 24 membros; a fila inteira, até 96 (`MAX_QUEUE_MEMBERS`, limite técnico).
- O `MatchStarted` grava a fila de quando a partida começa, e o `QueueChanged` troca a fila inteira durante a partida (quem chegou, quem foi embora). Vale o último na ordem canônica. Entre o `MatchEnded` e o `MatchStarted` seguinte não há evento de fila: a próxima partida grava a fila que o plano propôs.
- Desfazer volta placar, rotação e fila juntos, porque estão no mesmo estado.

## Partidas seguidas

- Conta as partidas **terminadas** seguidas, terminando na última, em que o membro estava no time: na escalação, no banco ou como líbero (decisão do Gabriel).
- Fim manual e partida sem vencedor contam. A partida aberta não conta.
- "Partidas na rodada" é o total, seguidas ou não: só desempata.
- Exemplo do cenário da revisão: Gil jogou a 1ª e a 3ª partidas, então tem 2 na rodada e 1 seguida.

## Quem sai, quem entra (modo automático, o único do MVP)

Ao fim de uma partida, o plano da próxima parte da última partida terminada:

1. **Sem vencedor** (`winner: null`) ou **ninguém esperando:** ninguém sai.
2. **Há time inteiro esperando:** sai o perdedor inteiro, e o primeiro time da fila entra no lado dele, com a rotação a montar (E4.7).
3. **Só avulsos esperando:** saem do perdedor tantos quanto esperam, até o time inteiro, escolhidos pelo critério. Entram os primeiros avulsos da fila.
4. Quem sai vai para o **fim** da fila de avulsos, na ordem do time.
5. Quando os avulsos somam um time (`playersPerTeam`, da configuração), os primeiros formam um time, por ordem de chegada.
6. O vencedor não muda. A rotação dos dois times continua de onde parou, como na virada de set.

**Quem entra herda o lugar de quem sai:** a mesma posição na escalação, o mesmo lugar no banco ou, com a rotação desligada, o mesmo lugar na lista do time. Quem entra no lugar do líbero vai para o fim do banco, e o time fica sem líbero (decisão do Gabriel). As duplas seguem a ordem do time, nunca a ordem do critério: o primeiro avulso entra no lugar do primeiro que sai, na ordem do time.

## Critérios de quem sai

| Chave | Quem sai primeiro | Entrada |
|---|---|---|
| `consecutive-matches` (padrão) | Mais partidas seguidas; empate: mais partidas na rodada; depois, quem chegou primeiro | `arrivalOrder` |
| `arrival-order` | Quem chegou primeiro | `arrivalOrder` |
| `draw` | Os primeiros do sorteio | `drawOrder`, já embaralhado fora do motor |
| `manual` | Quem o admin escolheu | `chosen`, exatamente quantos saem |

`arrivalOrder` precisa ter todos do time perdedor; `drawOrder` é o time perdedor inteiro, em outra ordem. Entrada inválida dá `invalid-exit-choice`. O critério por nível ficou fora do MVP, e o nível nunca entra na decisão (`docs/ideias.md`).

## Cenário da revisão (`revisao-mvp.md:28`; tela 11)

Laranja vence três vezes; o Azul perde e tem 2 reservas esperando. Na 1ª partida saem Gil e Hugo para Bia e Caio; na 2ª, Davi e Sofia para Gil e Hugo. Depois da 3ª, as seguidas são Rafa 3, Duda 3, Bia 2, Caio 2, Gil 1 e Hugo 1. Saem Rafa e Duda (3 seguidas); Davi entra no lugar de Rafa (posição 1) e Sofia no de Duda (posição 5); Rafa e Duda vão para o fim da fila.

## Fora do MVP

"Vencedor sai após X vitórias", "sempre parcial com N fixo", "sempre time inteiro" e o critério por nível (`docs/ideias.md`, decisões do Gabriel em 03/11/2026).

**Índice e posição:** `PartialExitPlace.index` é índice de `lineup`, não a posição da quadra. Para mostrar "posição N" (tela 11), a E4 converte com `getLineupBySlot`; no cenário da revisão os dois coincidem só porque `setterZone` é 6.
