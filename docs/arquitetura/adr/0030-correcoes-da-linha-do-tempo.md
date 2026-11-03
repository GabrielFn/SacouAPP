# ADR 0030 · Correções: desfazer, voltar a um ponto, trocar sacador, girar e desgirar

**Status:** aceito (03/11/2026). **Tarefa:** E2.7. Plano e respostas do Gabriel em [`docs/estado/tarefas/E2.7.md`](../../estado/tarefas/E2.7.md). Regras em [`rotacoes.md`](../../dominio/rotacoes.md) e [`eventos.md`](../../dominio/eventos.md). Estende o [ADR 0022](0022-event-envelope-replay.md), o [ADR 0024](0024-saque-e-rotacao-derivados.md) e o [ADR 0027](0027-banco-manual.md).

## Decisões do Gabriel (03/11/2026)

- **P1:** "Trocar sacador" troca só o time que saca, sem girar ninguém; no 0–0 também corrige quem começou o set.
- **P2:** DESFAZER desfaz a última ação, seja ela qual for: ponto, troca de escalação ou de fila, girar, trocar sacador ou fim de set.

## Decisões

**Correção grava o resultado, sem exceção.** Ao contrário do side-out, que é derivado (ADR 0024), a correção é escolha de alguém. Girar grava a zona absoluta, nunca um "+1" que o aplicador calcularia (`decisoes.md:26`).

**O `RevertedTo` não muda.** Ele já volta ao estado logo depois do alvo, e esse estado inclui placar, saque, `setterZone`, banco, líbero e fila. O aceite ("a linha do tempo reverte placar, rotação e fila juntos") é provado por teste de aceite, por um invariante exaustivo (para cada evento ativo, o replay com `RevertedTo` para ele é igual ao replay do prefixo até ele) e pelos golden.

**`replayTimeline(config, events)`** em `event-log` devolve `{ entries: [{ event, state }] }`: só os eventos ativos, na ordem canônica, cada um com o estado logo depois dele. O nó da lista ligada passou a guardar a referência do evento em vez do `eventId`, e os estados já estavam nela, então nada é copiado: são O(n) referências. `replayEvents` agora deriva dele, com a mesma saída (conferido em todos os golden existentes). A E2.9 usa a timeline para parear cada `PointScored` com o estado anterior.

**Girar e desgirar reutilizam `LineupChanged`**, sem evento novo. `shiftRotation(state, team, direction)`, com `direction` em `ROTATION_DIRECTIONS = ["forward", "backward"]`, grava `lineup`, `bench` e `libero` atuais e o `setterZone` vizinho, pelo mesmo `recordAllocation` do `changeLineup`. Girar usa `nextSetterZone` (1 → 6 → 5 → 4 → 3 → 2 → 1); desgirar usa `previousSetterZone`, que lê `SETTER_ZONE_SEQUENCE` ao contrário (1 → 2 → 3 → 4 → 5 → 6 → 1), por tabela e sem `%`. Recusas: `no-open-match`, `invalid-payload` com `field` `team`, `rotation-off` e `invalid-rotation-direction` (código novo, para direção fora da lista vinda de fora do TS).

**Trocar sacador é o evento novo `ServingTeamChanged { matchId, setNumber, servingTeam, firstServer }`** (P1). O comando `switchServingTeam(state)` decide os dois campos: alterna `servingTeam`, e `firstServer` passa a ser o novo time só no 0–0; fora dele, repete o atual. O aplicador só grava os dois: `event-rejected` sem partida aberta com o `matchId` ou sem set aberto com o `setNumber`, como o `PointScored`. Não confere placar nem valor atual (valor igual é aplicado sem efeito), não gira ninguém, vale com a rotação desligada, e vale o último na ordem canônica. Recusas do comando: `no-open-match`, `no-open-set`, `set-decided`. Como o `firstServer` corrigido fica no set, o `confirmSetEnd` alterna a partir dele, e o líbero segue o `servingTeam` corrigido, porque a fase sai do estado (ADR 0028).

**Comandos de desfazer na fatia nova `src/corrections/`**, sobre a timeline, só dentro da partida aberta:

- `undoLastAction(timeline)` (P2) aponta o `RevertedTo` para o evento ativo anterior ao último. Logo depois do `MatchStarted` da partida aberta, `nothing-to-undo`.
- `revertToEvent(timeline, eventId)` aceita qualquer evento ativo da partida aberta, inclusive o `MatchStarted` dela (volta ao 0–0), que não seja o último (`nothing-to-undo`). Evento inativo, ausente ou de partida anterior é `invalid-revert-target`. O erro leva só o código, nunca o `eventId` recebido.
- Sem partida aberta, `no-open-match`. A tela 11 não tem desfazer, e a confirmação final grava `SetEnded` e `MatchEnded` juntos, então depois dela não há correção (`FimPartida.dc.html`).

**Lista e prévia da tela 24, só em TS:**

- `getRecentPoints(timeline, limit = CORRECTION_TIMELINE_POINTS)`, com `CORRECTION_TIMELINE_POINTS = 10`: os pontos ativos do set atual da partida aberta (ou do último set, se a partida estiver pendente do `MatchEnded`), do mais recente, cada um com `eventId`, `team`, placar depois, `servingTeam` e `servingPlayer` **antes** do ponto (`null` com a rotação do time que sacava desligada), `sideOut` e o `setterZone` do vencedor depois do side-out (`null` sem side-out). Reproduz as 10 linhas de `Corrigir.dc.html`. `limit` que não é inteiro ≥ 0 dá lista vazia.
- `previewRevert(timeline, eventId)` devolve `RevertPreview`: o set atual e o set depois (`{ setNumber, score }` ou `null`), quem saca depois e o sacador, `rotationChanges` só dos times cuja zona muda (`{ team, from, to }`) e `removed`, a contagem de pontos, trocas de escalação, trocas de fila, trocas de saque e fins de set que saem da linha do tempo. Tem as recusas de `revertToEvent`. A E4.10 escreve "3 pontos serão apagados"; no log nada se apaga. A contagem usa um `Map` por tipo, porque o tipo vem do log.

**Quem pode corrigir:** o motor não autoriza. Os docs não separam quem marca de quem corrige: o Placar opera a quadra (`produto.md:62`), e o Menu leva a Corrigir. A E3.7 aplica por papel e sessão.

## Contrato para a E2.10 (C#)

**A E2.10 porta** o parser e o aplicador de `ServingTeamChanged`, `previousSetterZone` e a constante `SERVING_TEAM_CHANGED_EVENT_TYPE`; `replayTimeline`, se a E3.9 precisar. Comandos, prévia e lista de pontos ficam só em TS.

| Arquivo em `packages/match-engine/golden/` | O que tem |
|---|---|
| `corrections-events.json` | 29 casos no formato de `event-log.json`, com `servingPlayer` e `onCourt` opcionais: o aceite (placar, saque, zonas, banco, líbero e fila voltam juntos), desfazer side-out, desfazer o fim do set em 25–20 e o mesmo `SetEnded` de novo, girar e desgirar com banco e líbero, side-out depois de girar, trocar sacador no 0–0 do 2º set e no 10–8, desfazer a troca, rotação desligada, set fechado, outro set e outra partida, valor igual, `firstServer` gravado como veio, dois escritores, líbero seguindo o saque corrigido e girar desatualizado |
| `score-payloads.json` | Acrescenta 51 casos: a matriz do `ServingTeamChanged`, com `field` e ordem de validação |
| `rotation-rules.json` | Acrescenta 6 casos `previous-zone`: `{ input: { setterZone }, expected: { previousSetterZone } }` |

Os esperados foram decididos à mão, num script descartável fora do repositório, que não importa o motor; os diffs dos golden existentes só acrescentam. Os golden e os testes reprovam as mutações do plano: aplicador que gira o novo sacador, que não grava `firstServer`, que deriva `firstServer` do placar ou que ignora `setNumber`; desgirar com a tabela de girar; zona que sai de 1 a 6; `RevertedTo` que volta o placar sem a fila ou sem o banco; líbero que não segue o `servingTeam` corrigido.

Pontos de divergência, além dos ADR anteriores:

- **Ordem do parser do `ServingTeamChanged`:** desconhecido primeiro; depois `matchId`, `setNumber`, `servingTeam`, `firstServer`. O payload parseado tem as chaves em ordem alfabética: `firstServer`, `matchId`, `servingTeam`, `setNumber`.
- **O aplicador troca dois campos de `currentSet`** sem mudar a ordem de chaves: `firstServer`, `score`, `servingTeam`, `setNumber`, `targetPoints`.

## Consequências

- **Desfazer silencioso:** com a P2, DESFAZER pode desfazer uma troca de escalação ou de saque sem diálogo. A E4.10 mostra o que desfez.
- **Dois escritores:** `RevertedTo`, girar e trocar sacador gravados offline podem desfazer o efeito um do outro. Um `LineupChanged` de girar gravado sobre uma zona desatualizada vale como veio, como qualquer `LineupChanged` (ADR 0027; caso `c14` do golden). O aviso fica na E3.7 e na E4.11, e dois `RevertedTo` offline continuam na E3.7 e na E4.9 (`eventos.md`).
- **Ponto atrasado antes de `SetEnded`** não muda aqui: fica na E3.7 (ADR 0023).
- **Custo:** `ServingTeamChanged` troca dois campos fixos, então o estado não cresce por evento, e o payload tem 4 valores. A timeline são O(n) referências, sem cópia; vale `MAX_FINISHED_MATCHES`, sem limite novo. A tela 24 recalcula o replay a cada abertura: a E4.9 mede no celular.
- **O evento prova formato, não verdade:** um `ServingTeamChanged` forjado decide quem saca e a fase do líbero, com efeito em saldo e rating; um `RevertedTo` de quem recebeu o QR pode tirar da linha do tempo pontos do admin de antes da entrega. A E3.7 autoriza por papel e sessão, decide se o Placar pode voltar antes do próprio lote e conta eventos por partida.
