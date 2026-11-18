# Eventos da quadra: envelope e função de estado

Contrato do log de eventos de uma `CourtSession` (E2.1, [ADR 0022](../arquitetura/adr/0022-event-envelope-replay.md)). Código em `packages/match-engine/src/event-log/`; casos em `packages/match-engine/golden/event-log.json`.

## Envelope

Esquema fechado: só estes campos, e qualquer outro é erro.

| Campo | Formato |
|---|---|
| `eventId`, `courtSessionId`, `deviceId` | UUID em minúsculas |
| `batch`, `sequence` | Inteiro de 1 a 2^53−1 |
| `schemaVersion` | Inteiro ≥ 1, de 1 a 2^53−1 no parser; só as versões suportadas passam no replay |
| `type` | Texto de 1 a 64 unidades UTF-16 |
| `payload` | Objeto JSON com até 32 níveis e 4096 valores, contando o próprio payload. As chaves ficam ordenadas por unidade UTF-16 na cópia |

Não entram no envelope: `rulesVersion` e a cópia congelada de configurações e formações, que vão no evento de início de partida (E2.2+); relógio; autoria; nome, apelido, e-mail, telefone, Pix, foto ou `userId`.

| Tema | Definição |
|---|---|
| `batch` | Número do lote de escrita no stream: um novo a cada troca ou retomada de quem escreve. **Emitido pelo servidor; o celular carimba o lote que o servidor lhe deu** antes de gravar no SQLite. Imutável: reenvio não muda, e o servidor nunca reescreve um envelope. O primeiro escritor recebe o lote 1, que já é o valor do log local; **na troca de quem escreve, o servidor emite o lote seguinte** ao novo par (`deviceId`, `MemberId`), e o celular antigo passa a ser recusado pelo lote, nunca pelo relógio ([ADR 0060](../arquitetura/adr/0060-sincronizacao-do-stream-da-quadra.md), [ADR 0063](../arquitetura/adr/0063-placar-assume-a-quadra.md)). Teto de 40 lotes por stream. Não é a tentativa de envio |
| `sequence` | Cresce por celular no stream. Lacuna não é erro no replay. **No servidor** (ADR 0060), o primeiro evento novo de uma requisição tem `sequence` igual à maior do mesmo `deviceId` no stream mais 1: maior é `sequence-gap` com `expectedSequence` (o app reenvia dali); menor ou igual, com `eventId` desconhecido, é `sequence-conflict` (dois celulares com o mesmo `deviceId`) |
| Ordem canônica | `batch`, `sequence`, `deviceId`, `eventId`: números por valor, textos por unidade UTF-16 (`<` no TS; `string.CompareOrdinal` no C#), nunca `localeCompare` |
| Duplicata | Mesmo `eventId` e conteúdo igual, sem depender da ordem das chaves: ignora. Conteúdo diferente: `event-id-conflict` |
| Falha | Fechada: erro devolve `err`, sem estado parcial. Leva só `code` e `eventId` ou `field`, nunca o valor recebido |

Erro do parser é `invalid-envelope` com `field`: um campo do esquema; `envelope`, quando a entrada não é um objeto; ou `unknown-field`, quando há campo fora do esquema. O nome do campo desconhecido é dado recebido e não volta no erro. O campo desconhecido é conferido primeiro; depois, os campos na ordem da tabela.

## `RevertedTo`

Payload só com `{ targetEventId }`. O estado volta ao que era logo depois do alvo; nada sai do log e os eventos depois do alvo ficam inativos. Sem "refazer": nenhuma tela oferece.

O alvo tem de estar ativo, vir antes na ordem canônica e não ser `RevertedTo`. Sem isso, ou com payload malformado, o erro é `invalid-revert-target`.

- O `RevertedTo` não é listado em `activeEventIds`: a lista traz só os eventos cujo efeito está no estado.
- Não há como voltar ao estado inicial, porque o alvo é sempre um evento. Por isso **todo stream abre com `MatchStarted`**, anterior a qualquer ponto, para o desfazer do primeiro ponto funcionar (E2.2). Qualquer outro evento sem partida aberta é `event-rejected`, e `RevertedTo` como primeiro evento é `invalid-revert-target`.
- **Comandos que emitem o `RevertedTo`** (E2.7, [ADR 0030](../arquitetura/adr/0030-correcoes-da-linha-do-tempo.md)): `undoLastAction` aponta para o evento ativo anterior ao último, e `revertToEvent` para qualquer evento ativo da partida aberta que não seja o último. Código em `packages/match-engine/src/corrections/`.
- **Dois `RevertedTo` offline** podem deixar o log em `invalid-revert-target`: o que vier depois na ordem canônica pode apontar para um alvo que o outro já deixou inativo. Com falha fechada, isso impede recalcular o stream. O tratamento fica na E3.7 e na E4.11 (com um escritor só, o log local da E4.9 nunca gera dois `RevertedTo` concorrentes: cada comando é simulado sobre o log mais recente).

## `replayEvents`

Só aceita saída de `parseEventEnvelope`: é contrato, e o tipo sozinho não garante. Evento montado à mão com payload muito profundo pode lançar exceção.

1. Ordena uma cópia na ordem canônica.
2. Confere o log inteiro, inclusive eventos que ficariam inativos, nesta ordem de código e, dentro do código, na ordem canônica:
   1. `stream-mismatch`: outro `courtSessionId`.
   2. `event-id-conflict`: mesmo `eventId` com conteúdo diferente.
   3. `sequence-conflict`: mesmos `batch`, `sequence` e `deviceId` com outro `eventId`. O erro aponta o último dos dois na ordem canônica.
   4. `unsupported-schema-version`.
3. Dobra, na ordem canônica, parando na primeira falha: `unknown-event-type`, `event-rejected`, `invalid-revert-target`.

O resultado, inclusive o erro, não depende da ordem de chegada.

## `replayTimeline`

Mesmo contrato e mesmos erros do `replayEvents`, mas devolve `{ entries: [{ event, state }] }`: os eventos ativos, na ordem canônica, cada um com o estado logo depois dele. Os estados são os da lista ligada do replay, sem cópia. `replayEvents` deriva dele: o estado é o da última entrada, ou o inicial sem entradas, e `activeEventIds` são os `eventId` das entradas (E2.7).

## Catálogo: placar (schema 1)

Regras em [`placar.md`](placar.md) e [`rotacoes.md`](rotacoes.md), decisões nos [ADR 0023](../arquitetura/adr/0023-placar-e-catalogo-de-eventos.md) e [ADR 0024](../arquitetura/adr/0024-saque-e-rotacao-derivados.md) e [ADR 0026](../arquitetura/adr/0026-posicoes-no-saque.md) e [ADR 0027](../arquitetura/adr/0027-banco-manual.md) e [ADR 0028](../arquitetura/adr/0028-libero-ligado.md) e [ADR 0029](../arquitetura/adr/0029-fila-da-quadra.md) e [ADR 0030](../arquitetura/adr/0030-correcoes-da-linha-do-tempo.md) e [ADR 0031](../arquitetura/adr/0031-ponto-individual.md), código em `packages/match-engine/src/score/`. A regra da fila está em [`fila.md`](fila.md). O `ServingTeamChanged` entrou na E2.7 e o `PointAttributed`, na E2.8.

| Tipo | Payload |
|---|---|
| `MatchStarted` | `{ matchId, rulesVersion, formationsVersion, scoring: { bestOf, pointsPerSet, tieBreakPoints, winMargin }, teams: { a: { memberIds }, b: { memberIds } }, firstServer, rotations: { a: { lineup, setterZone, system, bench, libero } \| null, b: { lineup, setterZone, system, bench, libero } \| null }, queue: { teams: [{ memberIds }], players } }` |
| `PointScored` | `{ matchId, setNumber, team }` |
| `SetEnded` | `{ matchId, setNumber, winner, nextSet: { targetPoints, firstServer, setterZones: { a, b } } \| null }` |
| `MatchEnded` | `{ matchId, endReason: "sets-won" \| "manual", winner: "a" \| "b" \| null }` |
| `LineupChanged` | `{ matchId, team, lineup, setterZone, bench, libero }` |
| `QueueChanged` | `{ matchId, queue: { teams: [{ memberIds }], players } }` |
| `ServingTeamChanged` | `{ matchId, setNumber, servingTeam, firstServer }` |
| `PointAttributed` | `{ matchId, pointEventId, kind, author }` |

- **Formato:** `matchId` e `memberIds` em UUID minúsculo. `memberIds`: de 1 a 24 por time, sem repetir dentro do time nem entre times, com a ordem preservada. `setNumber` de 1 a 5. `bestOf` 1, 3 ou 5; `pointsPerSet`, `tieBreakPoints` e `targetPoints` de 1 a 99 (`tieBreakPoints` aceita `null`); `winMargin` 1 ou 2; `rulesVersion` inteiro ≥ 1. Nenhum texto livre: nome e cor do time ficam fora do evento.
- **Saque e rotação:** `firstServer` e `nextSet.firstServer` são `a` ou `b`. `setterZone` é inteiro de 1 a 6; `setterZones.a` e `.b` são inteiros de 1 a 6 ou `null`. `lineup` tem exatamente 6 `MemberId`, sem repetir, todos do próprio time. `system` é `5x1`, `6x2`, `4x2` ou `livre`, por lista permitida, e cada time tem o seu. `formationsVersion` é inteiro ≥ 1: o catálogo de formações é imutável por versão, e o replay aceita versão desconhecida, para a qual `getTeamServeAlignment` devolve `null`; só `startMatch` a recusa (ADR 0026). `null` é serializado, nunca omitido: ausente é `invalid-payload`. `rotations` vem depois de `teams` na ordem, porque confere o `lineup` contra ele.
- **Banco:** `bench` tem de 0 a 18 `MemberId` (`MAX_BENCH_MEMBERS`), sem repetir e sem sobrepor o `lineup`. Obrigatório mesmo vazio: `[]` é serializado, e ausente é `invalid-payload`. No `MatchStarted`, o parser confere que `lineup` e `bench` são exatamente `teams.<lado>.memberIds`, validando `bench` depois de `system`. No `LineupChanged`, o parser confere o formato, na ordem `matchId`, `team`, `lineup`, `setterZone`, `bench`, e o aplicador confere a partição. O evento grava a alocação inteira do time e não leva `system` nem `setNumber` (ADR 0027).
- **Líbero:** `libero` é `{ memberId, replacedIndexes }` ou `null`, obrigatório: `null` é serializado, e ausente é `invalid-payload`. `memberId` em UUID minúsculo, fora de `lineup` e de `bench`; `replacedIndexes` com 1 índice, ou 2 em diagonal (diferença 3) em ordem crescente, inteiros de 0 a 5. No `MatchStarted`, o parser confere também o sistema (só `5x1` e `6x2`), a vaga (nunca de levantador) e que o líbero é do time, depois de `bench` e antes da partição, que continua reportando `bench`. No `LineupChanged`, confere o formato depois de `bench`, e o aplicador confere partição, sistema e vaga. Entrada e saída do líbero não são gravadas: saem da zona e da fase (ADR 0028).
- **Fila:** `queue` é obrigatório no `MatchStarted` e no `QueueChanged`, com `[]` serializado; ausente ou `null` é `invalid-payload`. `memberIds` de cada time da fila: de 1 a 24; `players`: de 0 a 96; todos em UUID minúsculo, sem repetir na fila inteira, até 96 no total (`MAX_QUEUE_MEMBERS`, limite técnico). Ordem: `queue`, `queue.teams` (lista, cada time, ninguém em dois times), `queue.players` (lista, repetido, alguém de um time da fila), `queue` (total). No `MatchStarted`, `queue` é o último campo, e alguém de `teams` na fila é `queue`; no `QueueChanged`, a ordem é `matchId`, `queue`, e a sobreposição é do aplicador. A chave desconhecida dentro de um time da fila também é `unknown-field`, conferida primeiro. A escolha de quem sai é do comando e não é gravada; o evento grava a fila resultante (ADR 0029).
- **Trocar sacador:** `ServingTeamChanged` grava os dois campos decididos pelo comando: `servingTeam` e `firstServer` são `a` ou `b`, e `setNumber` vai de 1 a 5. Ordem: `matchId`, `setNumber`, `servingTeam`, `firstServer`. Não leva placar nem zona: ninguém gira (ADR 0030).
- **Ponto individual:** `PointAttributed` grava a resposta de "De quem foi?" a um ponto já gravado, como veio. `pointEventId` é o `eventId` do `PointScored`, em UUID minúsculo. `kind` é `attack`, `block`, `ace`, `other` ou `opponent-error`, por lista permitida (`POINT_KINDS`). `author` é um `MemberId` em UUID minúsculo, ou `null` só em `opponent-error`; ausente é `invalid-payload`, e a combinação errada com `kind` reporta `author`. Ordem: `matchId`, `pointEventId`, `kind`, `author`. Sem resposta não há evento: o ponto fica sem autor (ADR 0031).
- **`MatchEnded`:** `sets-won` exige `winner` não nulo. `manual` aceita `null`, inclusive para placar desligado.
- **Erro do parser:** `{ code: "invalid-payload", field }`. `field` é caminho do esquema (`scoring.bestOf`), `payload` ou `unknown-field`, nunca valor nem chave recebida. O desconhecido é conferido primeiro, em qualquer nível; depois, a ordem da tabela. Não objeto é `payload`. No replay, vira `event-rejected`.

**Aplicadores: conferem a estrutura, sem recalcular regra.** A exceção é o `PointScored`, que soma 1 e deriva o side-out do estado, sem nada gravado para conferir (ADR 0024). `event-rejected` quando:

| Tipo | Rejeitado se |
|---|---|
| `MatchStarted` | Há partida aberta, o `matchId` já foi usado por partida terminada no stream, ou o stream já tem 200 partidas terminadas (`MAX_FINISHED_MATCHES`, limite técnico, não regra: as 200 podem existir, e a 201ª não abre). Grava `queue` no estado, trocando a anterior |
| `PointScored` | Sem partida aberta com o `matchId`, ou sem set aberto com o `setNumber` |
| `SetEnded` | Como o `PointScored`; `nextSet` não nulo em `setNumber >= bestOf`, porque esse set não existe; ou `setterZones` com zona em time sem rotação ou `null` em time com rotação. É estrutura: não olha placar nem alternância |
| `MatchEnded` | Sem partida aberta com o `matchId`, ou `sets-won` com set aberto |
| `LineupChanged` | Sem partida aberta com o `matchId`, rotação desligada no time, `lineup`, `bench` e líbero que não são exatamente `teams.<lado>.memberIds`, ou líbero em sistema sem líbero ou em vaga de levantador. Confere a cópia congelada, nunca o estado: pontos ou trocas intercalados não o rejeitam, e vale o último na ordem canônica. Set fechado com a partida aberta é aceito, e alocação idêntica é aplicada sem efeito |
| `QueueChanged` | Sem partida aberta com o `matchId`, ou alguém da fila em `teams.a` ou `teams.b` da partida aberta. Confere a cópia congelada; troca a fila inteira, nunca acumula, e vale o último na ordem canônica. O `MatchEnded` mantém a fila |
| `ServingTeamChanged` | Como o `PointScored`. Grava `servingTeam` e `firstServer` como vieram, sem conferir placar nem valor atual (valor igual é aplicado sem efeito), não gira ninguém, vale com a rotação desligada, e vale o último na ordem canônica |
| `PointAttributed` | Sem partida aberta com o `matchId`, ou `author` fora de `teams.a` e `teams.b` da cópia congelada. **Não muda o estado** (devolve o mesmo objeto), que por isso não cresce por evento. Aceita qualquer set da partida aberta, decidido ou fechado, e não confere o alvo: quem pontuou sai da linha do tempo por `resolvePointAttributions`, que ignora preenchimento de ponto inativo, de outra partida ou com autor de fora do time que pontuou, e fica com o último válido na ordem canônica, antes ou depois do ponto (ADR 0031) |

## Contrato para E2.2–E2.10

- Cada tarefa só registra aplicadores no `ReadonlyMap`, sem mexer no núcleo.
- Aplicador é puro, aplica o resultado gravado (sem recalcular regra) e não muta. Exceção dentro dele vira `event-rejected`. A única regra no replay é a transição do `PointScored`, que faz parte do significado do evento em `schemaVersion` 1: mudá-la com dados reais exige versão nova do esquema (ADR 0024).
- Estado só com valores JSON (sem `Map`, `Set`, `undefined`), comparável com o C#, e números inteiros.
- Conteúdo do payload: parser estrito por tipo, só IDs (`MemberId`), a cargo de cada tarefa. O esquema fechado da E2.1 cobre só o envelope; os 4 tipos do placar têm parser desde a E2.2, `LineupChanged`, desde a E2.5, `QueueChanged`, desde a E2.6, `ServingTeamChanged`, desde a E2.7, e `PointAttributed`, desde a E2.8.

## Porte C# (E2.10)

O C# lê o mesmo log com as mesmas regras e produz o mesmo estado nos 14 golden de `packages/match-engine/golden/` ([ADR 0033](../arquitetura/adr/0033-porte-csharp-do-motor.md)). Diferenças deliberadas, que fecham mais que o TS:

- **Chave repetida** num evento recebido é recusada: `invalid-envelope` com `field` `envelope` no nível do envelope e `payload` dentro dele, nunca com o nome. O JS fica com a última, mas o app grava com `JSON.stringify`, que nunca repete.
- **Exceção dentro de um aplicador** não vira `event-rejected`: os aplicadores C# são totais e recusam por `Result`, com fuzz que exige zero exceção.
- **Mais de 64 níveis** de JSON falham no leitor, antes do parser, como corpo inválido (E3.7).
- **`NaN`** não vem de texto JSON no .NET: número enorme vira `Infinity` e é recusado como no JS.

## O que fica para depois

- **E3.7 (parte 1, feita, [ADR 0060](../arquitetura/adr/0060-sincronizacao-do-stream-da-quadra.md)):** as regras de escrita do servidor são uma função pura (`CourtWriteRules.Decide`): o replay roda sobre todo o stream com os novos **antes** de gravar, com tetos de tamanho e de contagem, conferências de plausibilidade ([placar.md](placar.md#conferencias-do-servidor)) e membros do grupo; o lote é tudo ou nada. Quem numera o lote é o servidor, e só o escritor do lote atual grava. **Parte 2:** rota, persistência e permissão (`courtSessionId` e papel vêm da rota e do token, não do envelope).
- **E4.9 (parte 1, feita, [ADR 0038](../arquitetura/adr/0038-log-local-da-quadra.md)):** o `deviceId` é um UUID aleatório por instalação, gerado na primeira abertura e gravado no SQLite; o log local simula o replay antes de gravar; `batch` é 1 enquanto só este celular escreve, e quem o numera depois é a E3.7/E4.11. **Parte 3:** medir o custo do replay no Hermes (há um cache por array de eventos, para o toque não rodar dois replays).
- **E4.11:** o que mostrar quando um evento atrasado reordena o passado. O estado no celular pode mudar ao sincronizar; é esperado pelo modelo.
- **E2.7 (feito, ADR 0030):** "3 pontos serão apagados" (`Corrigir`) é texto para o usuário, montado pela E4.10 a partir de `previewRevert`; no log nada se apaga, e o `RevertedTo` só acrescenta.
- **Dois escritores offline no mesmo lote:** não acontece no servidor (ADR 0060): o lote guarda o escritor (`deviceId` e `MemberId`), e o segundo celular recebe `not-the-writer`. A troca de escritor (E3.8, ADR 0063) abre um lote novo; o celular antigo recebe `not-the-writer` com o lote atual e, se escreveu um lote, a sua última `sequence` gravada, e o app conta os pontos que não entraram com `refusedPoints` (`match-engine`).
