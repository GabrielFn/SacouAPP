# ADR 0024 · Saque, side-out e rotação por time (`setterZone`)

**Status:** aceito (02/11/2026). **Tarefa:** E2.3. Plano em [`docs/estado/tarefas/E2.3.md`](../../estado/tarefas/E2.3.md). Regras em [`rotacoes.md`](../../dominio/rotacoes.md); catálogo em [`eventos.md`](../../dominio/eventos.md). Estende o [ADR 0023](0023-placar-e-catalogo-de-eventos.md) e detalha o [ADR 0010](0010-rotation-and-rule-mode.md).

## Decisões

**Exceção consciente e estreita a `decisoes.md:26` e ao [ADR 0009](0009-court-session-event-sourcing.md): o side-out é derivado do estado.** Não há evento próprio nem campo novo no `PointScored`, cujo payload continua `{ matchId, setNumber, team }`. Aceita pelo orquestrador; citar no relatório do M2. Aquela regra existe para não manter dois motores (`revisao-mvp.md:121`), e aqui o porte são duas funções de uma linha. O `PointScored` já era a exceção aceita, porque o aplicador soma 1 (ADR 0023). Vale gravar quando a escolha é de alguém ou o resultado não sai do estado: `firstServer`, `setterZones` do set seguinte e as correções da E2.7.

| Opção | Com dois escritores intercalados ou evento atrasado (`eventos.md`) | Veredito |
|---|---|---|
| Evento próprio `SideOut`, depois do ponto | Dois celulares veem o mesmo rali e os dois emitem: ou gira duas vezes, ou o segundo é rejeitado e trava o stream. Gravar só um deixa o saque errado. O desfazer pode cair entre o ponto e o giro, e o log dobra nos ralis com side-out | Recusada |
| `PointScored` com zona gravada, **com** conferência | A intercalação vira `event-rejected` e trava o stream | Recusada |
| `PointScored` com zona gravada, **sem** conferência | Não trava, mas o resultado é errado: `b` gravado com "sem side-out" depois de `a` retomar o saque deixa quem venceu recebendo, sem o saque e sem girar. Um evento forjado escolhe a rotação | Recusada |
| **Derivar do estado** | Cada ponto é julgado no estado da ordem canônica: sem rejeição, determinístico e coerente. Ninguém forja rotação marcando ponto | **Escolhida** |

**Regra derivada.** `team !== currentSet.servingTeam` é side-out: `servingTeam` passa a `team`, e só `rotations[team].setterZone` avança uma casa. Com `team === servingTeam`, só o placar muda.

**A transição faz parte do significado do `PointScored` em `schemaVersion` 1, e não do `rulesVersion`.** O replay continua aceitando qualquer `rulesVersion`, que não altera a transição (caso `s12-*`). Mudar a transição com dados reais exige `schemaVersion` novo, com o aplicador antigo preservado para as versões antigas; versão desconhecida já falha fechada. Logs no formato da E2.2 são rejeitados, sem caminho de compatibilidade: nada foi gravado, e nenhum código fora de `packages/match-engine` conhece `PointScored`.

**Setup por time no `MatchStarted`:** `firstServer` e `rotations: { a, b }`, cada lado `{ lineup, setterZone }` ou `null`. `null` é rotação desligada naquele time, inclusive para quem não tem 6 jogadores (areia 2x2 e 4x4, pelada com 5): o app mostra só o time que saca (decisão do Gabriel de 02/11/2026). `null` é serializado, e ausente é `invalid-payload`. `firstServer` é obrigatório mesmo com rotação desligada: o saque continua sendo acompanhado por time e não gira ninguém.

**`lineup` ancorado no levantador.** Exatamente 6 `MemberId`, sem repetir, todos em `teams.<lado>.memberIds`. `lineup[0]` é o levantador, e os demais seguem a ordem crescente de posição, então o giro só muda `setterZone`. Sem líbero. `teams` segue como a cópia congelada do evento; `rotations` é a parte que muda, e a E2.5 troca jogador nela.

**`setterZone` em todos os sistemas.** Inteiro de 1 a 6, a zona atual de `lineup[0]`. O giro é igual nos sistemas, e o que muda é a formação. Na Livre, sem levantador, é a zona do primeiro da escalação, e a chave de formação da E2.4 segue `0`. A tela não mostra número nesse sistema.

**`SETTER_ZONE_SEQUENCE` é constante literal no motor,** e não leitura do catálogo: editar um JSON de formação não pode mudar o replay de partidas gravadas. Um teste amarra a constante a `FORMATION_CATALOG.systems["5x1"].rotationOrder`, o vínculo com a E1.1.

**Virada de set: resultado gravado, aplicado sem recalcular.** `SetEnded.nextSet` grava `firstServer` e `setterZones`, como `targetPoints`. O aplicador só rejeita o que é estrutura: zona em time sem rotação, ou `null` em time com rotação. Com `nextSet: null`, `rotations` fica como está.

**Decisões do Gabriel sobre a virada (02/11/2026, `perguntas.md`):**

- **Rotação do set seguinte:** continua de onde parou. O time não se move, e só o lado do desenho troca. A escolha fica isolada em `chooseNextSetZones`, em `commands.ts`.
- **Primeiro saque:** sorteio no 1º set e no set decisivo de md3 e md5; nos demais, alterna em relação ao `firstServer` do set, **e não** "quem perdeu saca". O motor não tem aleatoriedade: `confirmSetEnd(state, { firstServer })` recebe o sorteio de fora, e sem a opção alterna. **Quem chama decide quando sortear** (E4.10, que também faz a interface); o valor passa pelo parser. Casos `s8-toss-of-the-deciding-set-of-best-of-*`.

**Troca de lados fora do estado do motor.** Não influencia nenhuma regra, e as coordenadas são do próprio time. A E2.3 prova só o que a regra exige: virar set e chegar a 8 no tie-break não giram nem mudam quem saca (`s7-*`). O desenho da E4.10 deriva o lado de `setNumber`, do placar e da escolha local de "Inverter lados". Se outro celular precisar ver o mesmo lado, um evento se soma depois.

**`IRotationSystem` não nasce aqui** ([ADR 0011](0011-backend-patterns.md)): a ordem de giro é única. A diferença entre sistemas aparece ao transformar zona em chave de formação, então a Strategy entra na E2.4, quando houver quem leia. `system` também só entra lá, pelo mesmo motivo do ADR 0023.

**Pasta e versão.** `packages/match-engine/src/score/`, porque não há tipo novo de evento nem estado novo. Segue `schemaVersion` 1, com o golden atualizado (ADR 0023).

## Contrato para a E2.10 (C#)

**A E2.10 porta parsers e aplicadores, mais as funções de `rotation-rules.ts`: `nextSetterZone`, `isSideOut`, `getNextSetFirstServer`, `getLineupBySlot` e `getServingPlayer`. `getCurrentServingPlayer` serve às telas e fica só em TS. Roda `rotation-rules.json` e `rotation-events.json` pelo caminho, além dos golden do ADR 0023.** Comandos ficam só em TS, salvo decisão da E3.7.

| Arquivo em `packages/match-engine/golden/` | Formato |
|---|---|
| `rotation-rules.json` | `{ id, rule: "zone" \| "side-out" \| "next-first-server", input, expected }`. `zone`: `input { lineup, setterZone }`, `expected { nextSetterZone, lineupBySlot, servingPlayer }`. `side-out`: `input { servingTeam, pointWinner }`, `expected { isSideOut }`. `next-first-server`: `input { firstServer }`, `expected { firstServer }` |
| `rotation-events.json` | Mesmo formato de `event-log.json` |

Os esperados são decididos à mão, sem o motor. Um script descartável, fora do repositório e sem importar o motor, só expandiu a notação curta.

Pontos de divergência, além dos dos ADR 0022 e 0023:

- **A transição é a única regra no aplicador:** a tabela de `nextSetterZone` em C# precisa ser a mesma constante, sem aritmética própria. Módulo de número negativo em C# difere de uma implementação ingênua; use índice na tabela.
- **Ordem de chaves:** `rotations` vem antes de `rulesVersion`, e `setsWon` continua antes de `teams`. O golden compara texto.
- **`null` de `rotations.*` e `setterZones.*` é serializado, nunca omitido.** Atenção a `JsonIgnoreCondition`.
- **Ausente diferente de `null`:** o parser C# precisa distinguir, como `readOwn`.
- **`lineup`** preserva a ordem, e sua conferência contra `teams` usa comparação ordinal.
- **Casos só em TS:** comandos, exaustivo, canário, `Object.prototype` poluído, congelamento e volume.

## Consequências

- **Primeira regra do vôlei no replay.** Editar a constante em silêncio mudaria partidas gravadas; o golden `s3-*` é a trava.
- **O evento prova formato, não verdade.** `rotations`, `firstServer` e `nextSet.*` passam no replay mesmo falsos, e mudam quem saca: a mesma classe de `targetPoints`. **Para a E3.7:** conferir `rotations` contra a escalação, `nextSet.firstServer` contra a regra ou um sorteio autorizado, e `setterZones` contra o estado. Marcar ponto, em si, não dá poder novo sobre a rotação.
- **Rali final gira.** Um side-out no ponto que fecha o set gira o time, e a rotação segue para o set seguinte. Coerente com "cada ponto é julgado igual"; o desfazer da tela 25 reverte tudo (`s6-side-out-on-the-deciding-point`).
- **Custo:** O(1) por evento, e o tamanho do estado não depende do número de ralis. Vale o limite existente, `MAX_FINISHED_MATCHES`, e nenhum novo é necessário.
- **E2.4, E2.5 e E2.7 mexem aqui:** `TeamState` e `MatchStarted` crescem, de novo com o golden. A E2.7 precisa do estado de cada ponto para a tela 24, porque `replayEvents` só devolve o final.
- **Telas 08, 25 e 09 não fecham entre si pelas regras.** O golden começa em a1/b5 para fechar as telas 09, 10, 24 e 25; ver a pendência da E4.7 em `progresso.md`.
