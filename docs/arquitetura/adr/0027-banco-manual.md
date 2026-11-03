# ADR 0027 · Banco manual e alteração de escalação em partida

**Status:** aceito (02/11/2026). **Tarefa:** E2.5. Plano em [`docs/estado/tarefas/E2.5.md`](../../estado/tarefas/E2.5.md). Regras em [`rotacoes.md`](../../dominio/rotacoes.md). Estende o [ADR 0024](0024-saque-e-rotacao-derivados.md) e o [ADR 0026](0026-posicoes-no-saque.md), resolve a lacuna da tela 22 apontada no ADR 0026 e corrige o [ADR 0017](0017-group-settings-queue-bench.md) quanto ao banco.

## Decisões

**Só Manual no MVP (decisão do Gabriel).** "Sai quem saca" foi para `docs/ideias.md`: nenhum documento definia como ela funciona, e a busca não achou padrão. Não existe `benchRule`, e `IBenchRule` (ADR 0011) não é criado agora. `applyPointScored` não muda `bench` nem `lineup`: **nenhum ponto troca jogador**. Com isso, `decisoes.md:26` vale sem exceção: a troca sempre grava o resultado.

**`bench` em `TeamState` e em `rotations.<lado>` do `MatchStarted`.** Obrigatório, mesmo vazio: `[]` é serializado, nunca omitido, e ausente é `invalid-payload`. Ordem de chaves no estado: `bench`, `lineup`, `setterZone`, `system`. Ordem de validação no time: `lineup`, `setterZone`, `system`, `bench`. Logs no formato da E2.4 são rejeitados, sem caminho de compatibilidade, porque nada foi gravado: segue `schemaVersion` 1.

**Partição obrigatória.** `lineup` e `bench`, sem repetir, são exatamente `teams.<lado>.memberIds` (`isRosterPartition`). O limite do banco é `MAX_BENCH_MEMBERS`, 18: `MAX_TEAM_MEMBERS` (24) menos as 6 posições.

**Evento novo `LineupChanged` `{ matchId, team, lineup, setterZone, bench }`, com a alocação inteira do time.** Serve à troca com o banco e à tela 22, que é o mesmo evento: toque em dois jogadores vira `lineup` novo; o seletor de rotação, `setterZone`; a reancoragem da E4.8, os dois. Não leva `system`, que não muda em partida, nem `setNumber`: exige só partida aberta, inclusive com o set fechado antes do `MatchEnded`.

**O parser confere o formato, e o aplicador, a partição contra `teams`, a cópia congelada.** Nunca contra o estado que muda. Por isso, um `LineupChanged` escrito por quem ainda não viu pontos ou outra troca nunca é rejeitado: é aplicado como gravado, e vale o último na ordem canônica. A zona também é a gravada: quem troca com a tela desatualizada pode desfazer um giro, o que é determinístico e fica visível para quem usa.

**Rotação desligada não tem banco.** Com `rotations.<lado>: null`, com qualquer número de membros, `LineupChanged` é `event-rejected`, e o comando recusa com `rotation-off`. A E4.7 liga a rotação para quem tem 6 ou mais.

**Regra da troca, no comando `substitutePlayer(state, team, outgoing, incoming)`.** Quem entra assume o índice de quem saiu em `lineup`, e `setterZone` não muda. Quem entra sai da lista, sem mudar a ordem dos outros, e quem sai vai para o fim. A ordem inicial vem no `MatchStarted`; a E4.7 usa a ordem de `teams.<lado>.memberIds`, sem quem está na escalação. O motor aceita qualquer ordem gravada.

**Comando da tela 22: `changeLineup(state, team, { bench, lineup, setterZone })`.** Recusas novas: `rotation-off` e `lineup-unchanged` (alocação idêntica, inclusive a ordem do banco; no replay, um evento idêntico é aplicado sem efeito). Jogador ou partição errados dão `invalid-payload`, com `field` `lineup` ou `bench`. A ordem é: `no-open-match`, `team`, `rotation-off`, formato, partição, `lineup-unchanged`.

**Quem sai é levantador ou sacador: nada especial.** A função vem do índice (ADR 0026), então quem entra em `lineup[0]` é o novo `S`, e o `actingSetter` acompanha. O sacador vem da posição, então quem entra no lugar dele saca na hora. Em `ServeAlignment`, muda só o `memberId` daquela posição e, se quem saiu levantava, o `actingSetter`. O aviso de função trocada é da E4.8.

**`getServeAlignment` passa a receber `Pick<TeamState, "lineup" | "setterZone" | "system">`,** para `serve-alignment.json` não mudar: o alinhamento não depende do banco.

**Porta aberta para regra automática futura:** seria um campo novo no `MatchStarted`, em `schemaVersion` novo. Nada a fazer agora.

## Contrato para a E2.10 (C#)

**A E2.10 porta o parser e o aplicador de `LineupChanged`, `isRosterPartition` e o campo `bench` do `MatchStarted`, e roda os golden pelo caminho. `changeLineup` e `substitutePlayer` ficam só em TS.**

| Arquivo em `packages/match-engine/golden/` | O que tem |
|---|---|
| `bench-events.json` | 48 casos no formato de `event-log.json`: tabelas de 7 e 8 jogadores, banco nos dois times, set inteiro, rotação desligada, virada de set, `RevertedTo`, escritores intercalados e rejeições. Campos opcionais `servingPlayer` e `substitutions`, que o C# pode ignorar: o primeiro confere `getCurrentServingPlayer`, e o segundo confere o comando em TS contra o evento gravado |
| `score-payloads.json` | Acrescenta os casos de `LineupChanged` e os de `bench` no `MatchStarted`, com `field` e ordem de validação |
| `rotation-events.json` | Migrado só com o acréscimo de `bench` |

Os esperados são decididos à mão, a partir das tabelas do plano, em um script descartável fora do repositório, que não importa o motor. Os casos `d4-*` usam um `initialState` em que o estado saiu de `teams`, porque só assim se distingue conferir `teams` de conferir o estado.

Pontos de divergência, além dos dos ADR 0022, 0023, 0024 e 0026:

- **Ordem de chaves:** `bench`, `lineup`, `setterZone`, `system` no time; `bench`, `lineup`, `matchId`, `setterZone`, `team` no payload parseado. O golden compara texto.
- **Ordem de validação:** `matchId`, `team`, `lineup`, `setterZone`, `bench` no `LineupChanged`, com o desconhecido sempre antes.
- **Ausente é diferente de vazio:** `bench` ausente ou `null` é erro, e `[]` é válido. Em C#, cuidado com o serializador omitir coleção vazia.
- **Partição contra `teams`, nunca contra o estado:** o mesmo vale para o `MatchStarted`, que confere o banco depois do `lineup`.
- **Sem aritmética de fila no aplicador:** a ordem do banco é a gravada.

## Consequências

- **Golden migrado por script, só com acréscimo de campos.** `rotation-events.json` e `score-payloads.json` não têm linha removida. `score-events.json` não mudou, porque todos os seus times têm rotação desligada, e ele não tem `bench` a acrescentar. `s15-match-started-in-the-e2-3-format-is-rejected` fica sem `bench`, para continuar no formato antigo.
- **O estado não cresce por evento:** `LineupChanged` só permuta membros, sem histórico de trocas. Vale `MAX_FINISHED_MATCHES`, sem limite novo, e o payload tem no máximo 30 valores.
- **O evento prova formato, não verdade:** um `LineupChanged` forjado escolhe quem está em quadra, quem saca e, por `setterZone`, a rotação, com efeito em saldo e rating. A E3.7 autoriza o evento por papel e sessão, confere `MatchStarted.bench` contra a escalação e conta eventos por partida.
- **E2.6:** `FinishedMatch.rotations` traz o banco no fim. A partida seguinte chega em outro `MatchStarted`.
- **E2.7:** `RevertedTo` já reverte a troca. Girar e desgirar podem usar `LineupChanged`.
- **E2.9:** quem está em quadra em cada ponto é o `lineup` do estado **antes** do ponto, e o saldo não credita quem está no banco. Com rotação desligada, a E2.9 decide.
- **E2.11:** o líbero fica fora de `lineup` e de `bench`, e a partição passa a incluí-lo. Gravar a posição substituída por índice de `lineup`, não por `MemberId`, para `LineupChanged` não deixar par órfão. `LineupChanged` é esquema fechado, e ela acrescenta campo.
- **E4.8 e E4.9:** o design não tem o estado com banco na tela 22 nem o destino de "Trocar jogador" (`revisao-mvp.md:57`): a E4.8 aponta o que falta. A E4.8 depende desta tarefa (`plano-mvp.md:161`).
- **Sem regra automática, o admin faz toda troca à mão:** fica visível no piloto, que dirá se vale uma regra automática.
