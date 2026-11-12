# Fila da quadra: "quem perde sai" com saída parcial

Regras da fila de uma `CourtSession` (E2.6, [ADR 0029](../arquitetura/adr/0029-fila-da-quadra.md); modos da E2.12, [ADR 0048](../arquitetura/adr/0048-modos-de-fila-votacao-e-areia.md) e [ADR 0050](../arquitetura/adr/0050-modos-de-fila.md)). Código em `packages/match-engine/src/queue/`; casos em `packages/match-engine/golden/queue-events.json`, `queue-plans.json` e `queue-modes.json`. Eventos em [`eventos.md`](eventos.md).

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

## Quem sai, quem entra (modo automático, o padrão)

Ao fim de uma partida, o plano da próxima parte da última partida terminada:

1. **Sem vencedor** (`winner: null`) ou **ninguém esperando:** ninguém sai.
2. **Há time inteiro esperando:** sai o perdedor inteiro, e o primeiro time da fila entra no lado dele, com a rotação a montar (E4.7).
3. **Só avulsos esperando:** saem do perdedor tantos quanto esperam, até o time inteiro, escolhidos pelo critério. Entram os primeiros avulsos da fila.
4. Quem sai vai para o **fim** da fila de avulsos, na ordem do time.
5. Quando os avulsos somam um time (`playersPerTeam`, da configuração), os primeiros formam um time, por ordem de chegada.
6. O vencedor não muda (salvo o "vencedor também sai", abaixo). A rotação dos dois times continua de onde parou, como na virada de set.

**Quem entra herda o lugar de quem sai:** a mesma posição na escalação, o mesmo lugar no banco ou, com a rotação desligada, o mesmo lugar na lista do time. Quem entra no lugar do líbero vai para o fim do banco, e o time fica sem líbero (decisão do Gabriel). As duplas seguem a ordem do time, nunca a ordem do critério: o primeiro avulso entra no lugar do primeiro que sai, na ordem do time.

## Critérios de quem sai

| Chave | Quem sai primeiro | Entrada |
|---|---|---|
| `consecutive-matches` (padrão) | Mais partidas seguidas; empate: mais partidas na rodada; depois, quem chegou primeiro | `arrivalOrder` |
| `arrival-order` | Quem chegou primeiro | `arrivalOrder` |
| `draw` | Os primeiros do sorteio | `drawOrder`, já embaralhado fora do motor |
| `manual` | Quem o admin escolheu | `chosen`, exatamente quantos saem |

`arrivalOrder` precisa ter todos do time que sai; `drawOrder` é esse time inteiro, em outra ordem. Entrada inválida dá `invalid-exit-choice`. O critério só é conferido quando alguém sai pela saída parcial: com ninguém esperando, um critério inválido não reprova o plano. O critério por nível ficou fora do MVP, e o nível nunca entra na decisão (`docs/ideias.md`).

## Modos de quem sai (E2.12, ADR 0048 e ADR 0050)

O grupo escolhe um modo (`queue.exitMode`) e, à parte, o "vencedor também sai" (`queue.winnerExitEnabled`, `queue.winnerExitWins`). Os três vêm da configuração resolvida como entrada do `planNextMatch`, como o critério: **não vão para evento nenhum**, porque o `MatchStarted` seguinte grava o resultado (fila, times e rotação inteiros). Logs antigos continuam válidos, sem mudar `schemaVersion` nem `rulesVersion`.

Em todos os modos valem a regra 1 (sem vencedor ou ninguém esperando: ninguém sai), a herança de lugar, o líbero, os critérios, a formação de times pelos avulsos e o limite de 96.

| Modo (`queue.exitMode`) | Há time esperando | Só avulsos esperando |
|---|---|---|
| `automatic` (padrão) | O perdedor sai inteiro; o primeiro time entra no lado dele. Quem sai vai para os avulsos | Saem `min(avulsos, time)` pelo critério e herdam o lugar |
| `whole-team` | O perdedor sai inteiro e volta para o **fim dos times da fila, como time**, sem se misturar aos avulsos; o primeiro time entra no lado dele | O time é remontado: entram `k = min(avulsos, time)` avulsos, o critério escolhe os `k` do perdedor que descansam, e a rotação fica a montar (pergunta P2 da E2.12) |
| `fixed-count` (N de 1 a 24, `queue.fixedExitCount`) | A fila vira uma só: times da fila em ordem, membro a membro, depois os avulsos. Saem `k = min(N, time, quem espera)` pelo critério, e os `k` primeiros dessa fila entram no lugar deles. O que sobra da fila, mais quem saiu, vira avulsos, e os avulsos formam times de novo | Igual |

**"Fila menor que N":** saem só tantos quantos esperam. **N maior que o time:** sai o time todo, cada um com herdeiro no lugar (é saída parcial, a rotação continua).

## Vencedor também sai (E2.12)

- **Vitórias seguidas** (`getWinStreak(state, side)`): partidas terminadas seguidas, terminando na última, que o lado venceu **com o mesmo conjunto de membros** da última (a ordem não importa). Partida sem vencedor, derrota ou qualquer troca de membro no lado (saída pela fila, troca do admin, time novo) zera a contagem. Fim manual com vencedor conta como vitória.
- **Dispara** quando a última partida tem vencedor e as vitórias seguidas dele são **pelo menos X** (`queue.winnerExitWins`, de 1 a 10). Com X = 1, o vencedor sai sempre que alguém espera.
- **Ordem (pergunta 36, P1 da E2.12):** o vencedor sai primeiro, pelo modo do grupo, com a fila inteira; depois o perdedor, pelo mesmo modo, com o que sobrou da fila. Com um time só esperando, ele entra no lugar do vencedor, e o perdedor fica. Com dois times esperando, o primeiro entra no lado do vencedor e o segundo no do perdedor.
- **Quem acabou de sair não volta no mesmo plano:** quem sai dos dois times só vai para a fila depois das duas saídas, primeiro os do vencedor, depois os do perdedor, cada grupo na ordem do time.
- **Ninguém esperando:** o vencedor fica e a contagem continua (4, 5...): ele sai no primeiro plano em que houver alguém esperando.
- **Critério do vencedor:** usa o mesmo critério do grupo, com a entrada própria `winnerCriterionInput` (para `draw`, um sorteio só do vencedor; para `manual`, a escolha só dele). Ausente quando o vencedor sai pela saída parcial: `invalid-exit-choice`. Presente sem uso: ignorada.
- O plano diz `winnerLeaving: { side, streak }` quando dispara, para a tela 11 mostrar "saiu após 3 vitórias".
- **Plano:** `enteringTeams` lista os lados em que entra time novo (`a` antes de `b`), com a rotação a montar; cada saída parcial diz o `side`; `exits` vem com o lado `a` primeiro e, no lado, na ordem do time.
- **Recusas:** modo desconhecido ou `count` fora de 1 a 24 dá `invalid-exit-mode`; `wins` fora de 1 a 10 dá `invalid-winner-exit`. Ordem: partida aberta, sem partida terminada, `playersPerTeam`, modo, vencedor, critério (só quando alguém sai pela saída parcial) e, por fim, a fila acima de 96.

## Cenário da revisão (`revisao-mvp.md:28`; tela 11)

Laranja vence três vezes; o Azul perde e tem 2 reservas esperando. Na 1ª partida saem Gil e Hugo para Bia e Caio; na 2ª, Davi e Sofia para Gil e Hugo. Depois da 3ª, as seguidas são Rafa 3, Duda 3, Bia 2, Caio 2, Gil 1 e Hugo 1. Saem Rafa e Duda (3 seguidas); Davi entra no lugar de Rafa (posição 1) e Sofia no de Duda (posição 5); Rafa e Duda vão para o fim da fila. Com o "vencedor também sai" ligado e X = 3, o Laranja (3 vitórias seguidas) sairia primeiro: Davi e Sofia entrariam no Laranja, e o Azul ficaria inteiro.

## Fora do MVP

O critério por nível e o "rei da quadra" tradicional, com partidas curtas e coroas (`docs/ideias.md`).

**Índice e posição:** `PartialExitPlace.index` é índice de `lineup`, não a posição da quadra. Para mostrar "posição N" (tela 11), a E4 converte com `getLineupBySlot`; no cenário da revisão os dois coincidem só porque `setterZone` é 6.
