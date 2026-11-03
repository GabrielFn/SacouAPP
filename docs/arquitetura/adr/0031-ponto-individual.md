# ADR 0031 · Ponto individual: autor e tipo num evento à parte, lidos da linha do tempo

**Status:** aceito (03/11/2026). **Tarefa:** E2.8. Plano e respostas do Gabriel em [`docs/estado/tarefas/E2.8.md`](../../estado/tarefas/E2.8.md). Regras em [`placar.md`](../../dominio/placar.md) e [`eventos.md`](../../dominio/eventos.md). Estende o [ADR 0018](0018-rating-and-mvp.md) (o que o ponto individual é no produto), o [ADR 0024](0024-saque-e-rotacao-derivados.md) e o [ADR 0030](0030-correcoes-da-linha-do-tempo.md).

## Decisões do Gabriel (03/11/2026)

- **P1:** o comando barra combinações impossíveis: Ace só do sacador do rali; o líbero nunca leva Ace nem Bloqueio. Só no comando em TS, numa função isolada, fora do aplicador e do golden.
- **P2:** preencher só com a partida aberta.
- **P3:** sem apagar autor: só trocar por outro, ou DESFAZER se for a última ação.

## Decisões

**`PointScored` não muda.** Autor e tipo vêm sempre num evento novo, `PointAttributed { matchId, pointEventId, kind, author }`, na hora ou depois, pelo mesmo caminho. A tela 31 mostra o ponto já gravado antes da resposta, e mudar o `PointScored` mexeria na transição do schema 1 (ADR 0024). O evento grava a escolha como veio, sem nada derivado (`decisoes.md:26`).

**Formato.** `kind` em `POINT_KINDS = ["attack", "block", "ace", "other", "opponent-error"]`, por lista permitida. Os quatro primeiros exigem `author` em UUID minúsculo; `opponent-error` exige `author: null`. `author` ausente é `invalid-payload`, e a combinação errada com `kind` reporta `author`. "Pular" e o próximo ponto não gravam nada: o ponto fica sem autor. Ordem do parser: desconhecido; `matchId`, `pointEventId`, `kind`, `author`. Chaves parseadas em ordem alfabética: `author`, `kind`, `matchId`, `pointEventId`.

**O aplicador não muda o estado:** devolve o mesmo objeto, então o estado não cresce por evento. `event-rejected` só sem partida aberta com o `matchId` ou com `author` fora de `teams.a` e `teams.b` da cópia congelada, como no `LineupChanged`. Aceita qualquer set da partida aberta, decidido ou fechado. Não confere o alvo, porque ponto e preenchimento podem vir de dois escritores em qualquer ordem.

**Resolvedor puro sobre a timeline**, `resolvePointAttributions(timeline)` na fatia nova `src/attributions/`. Para cada `PointScored` ativo, vale o último `PointAttributed` **válido** e ativo que aponta para ele, na ordem canônica, antes ou depois do ponto. É inválido, e ignorado como se não existisse, o preenchimento cujo alvo não é `PointScored` ativo da mesma partida ou cujo `author` não está em `teams.<time do ponto>`. Um preenchimento inválido posterior, portanto, não apaga um válido anterior (caso `a11` do golden): ignorar é não contar. Não reconfere a quadra do rali: a escolha gravada vale. Linear: um `Map` de pontos e um `Map` de preenchimentos, em que a última entrada de cada chave vence. Devolve `[{ pointEventId, matchId, setNumber, team, kind, author }]`, só dos pontos com preenchimento válido, na ordem dos pontos.

**Comando `attributePoint(timeline, pointEventId, { kind, author })`**, sobre a timeline. Recusas, só com o código: `no-open-match`; `invalid-attribution-target` (não é `PointScored` ativo da partida aberta: `SetEnded`, revertido, ausente ou de partida anterior); `invalid-point-kind`; `invalid-point-author`. O autor é um dos que estavam em quadra **no rali** pelo time que pontuou: `getOnCourtBySlot` no estado logo antes do ponto, em fase de saque se o time sacava. Inclui o líbero em quadra e nunca o banco; girar ou trocar depois não muda. Com a rotação do time desligada, qualquer um de `teams.<time>.memberIds`. A P1 fica em `isPlausibleAuthor`: Ace exige que o time sacava e, com rotação ligada, que o autor estava na posição 1; o líbero nunca tem Ace nem Bloqueio. Com a rotação desligada, ninguém é sabidamente sacador nem líbero, então qualquer um do time que sacou pode ter Ace.

**`RevertedTo` não muda.** DESFAZER logo depois de preencher tira só o preenchimento; o segundo tira o ponto (P3). Voltar a um ponto anterior tira também os preenchimentos feitos depois dele, mesmo de pontos que ficam: `previewRevert` conta isso em `removed.attributions`, chave nova de `RemovedActionKey`.

**Consumidores:** `RecentPoint` ganha `author` e `kind` (os dois `null` sem resposta; só `author` `null` no erro do adversário), pelo resolvedor, uma passada por chamada. `getUnattributedPoints(timeline)` lista os pontos ativos do set da tela 24 sem resposta, do mais antigo, para o fim de set; o erro do adversário é resposta. As estatísticas (E2.9, E3.9) leem `resolvePointAttributions`.

## Contrato para a E2.10 (C#)

**A E2.10 porta** o parser e o aplicador de `PointAttributed`, as constantes `POINT_ATTRIBUTED_EVENT_TYPE` e `POINT_KINDS`, e `resolvePointAttributions` (a E3.9 precisa dele para as estatísticas). O comando, a P1, `getUnattributedPoints` e o `RecentPoint` ficam só em TS.

| Arquivo em `packages/match-engine/golden/` | O que tem |
|---|---|
| `score-payloads.json` | Acrescenta 64 casos: a matriz do `PointAttributed`, com `field` e ordem de validação |
| `attributions-events.json` (novo) | 16 casos no formato de `event-log.json`, com `expected.attributions`, a saída de `resolvePointAttributions`: na hora, depois, sobrescrita, erro do adversário, desfeito, alvo revertido, alvo que não é ponto, outra partida (rejeitado no aplicador e ignorado no resolvedor), autor do outro time ignorado, inválido que não apaga o válido, autor de fora rejeitado, preenchimento antes do ponto (dois escritores), set decidido, set fechado e partida terminada |

O teste do golden confere também que, nos casos aceitos sem `RevertedTo`, o estado é igual ao do mesmo log sem os `PointAttributed`. Os esperados foram decididos à mão, num script descartável fora do repositório, que não importa o motor; o diff de `score-payloads.json` só acrescenta. Os golden e os testes reprovam as mutações do plano: aplicador que muda o estado, que rejeita set fechado ou que aceita qualquer autor; parser que aceita `attack` sem autor, `opponent-error` com autor ou UUID maiúsculo; resolvedor que usa o primeiro preenchimento, que aceita autor do outro time ou alvo de outra partida, ou que valida só o último preenchimento; `previewRevert` sem `attributions`; comando que confere a quadra atual em vez da do rali, que aceita o banco, Ace de qualquer um ou Bloqueio do líbero.

Pontos de divergência, além dos ADR anteriores:

- **Ordem do parser:** desconhecido; `matchId`, `pointEventId`, `kind`, `author`. O tipo de `author` (UUID ou `null`) é conferido antes da combinação com `kind`, e as duas falhas reportam `author`.
- **Ordem de chaves da saída do resolvedor:** `pointEventId`, `matchId`, `setNumber`, `team`, `kind`, `author`.
- **Último válido, não último:** o resolvedor filtra os inválidos antes de escolher o último.

## Consequências

- **O evento prova formato, não verdade:** um `PointAttributed` forjado dá aces a quem não fez, com efeito no resumo e na cartinha. A E3.7 autoriza por papel e sessão, confere o Pro e a opção do grupo pelas configurações congeladas e roda o comando no servidor antes de gravar ([modelo de ameaças](../../seguranca/modelo-de-ameacas.md)).
- **Ignorar em silêncio** em vez de rejeitar: um preenchimento órfão ocupa o log sem efeito, e preencher o mesmo ponto várias vezes não tem limite no motor. A E3.7 conta eventos por partida.
- **Voltar a um ponto apaga preenchimentos tardios** de pontos que ficam: a E4.10 mostra a contagem de `previewRevert`.
- **O último set** só pode ser preenchido antes da confirmação da tela 11 (P2). O fim de set (tela 25) e a tela 24 não mostram onde preencher: a E4.10 decide.
- **Dado pessoal:** autor por ponto é dado de desempenho de pessoa, ligado ao `MemberId` ([inventário](../../seguranca/dados-pessoais.md)).
- **Custo:** o aplicador não muda o estado; o payload tem 4 valores; o resolvedor é linear e roda uma vez por chamada de `getRecentPoints`.
