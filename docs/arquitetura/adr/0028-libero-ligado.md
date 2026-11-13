# ADR 0028 · Líbero ligado: vagas por índice, entrada e saída calculadas

**Status:** aceito (03/11/2026). **Tarefa:** E2.11. Plano e respostas do Gabriel em [`docs/estado/tarefas/E2.11.md`](../../estado/tarefas/E2.11.md). Regras em [`rotacoes.md`](../../dominio/rotacoes.md). Estende o [ADR 0024](0024-saque-e-rotacao-derivados.md), o [ADR 0026](0026-posicoes-no-saque.md) e o [ADR 0027](0027-banco-manual.md), e amplia a exceção de `decisoes.md:26`.

## Decisões

**Entrada e saída do líbero são calculadas, nunca gravadas (decisão do Gabriel, P1).** Como o side-out e o giro (ADR 0024), elas saem só do estado, sem escolha de ninguém: de `setterZone` e da fase (`serving` ou `receiving`). O evento grava só quem é o líbero e quais vagas cobre. `PointScored` e `SetEnded` não mudam, e `rulesVersion` e `schemaVersion` seguem em 1. `decisoes.md:26` já registra a exceção.

**`TeamState.libero: { memberId, replacedIndexes } | null`, fora de `lineup` e de `bench`.** Obrigatório no time com rotação: `null` é serializado, e ausente é `invalid-payload`. Logs no formato da E2.5 são rejeitados, sem caminho de compatibilidade, porque nada foi gravado. Ordem de chaves no estado: `bench`, `libero`, `lineup`, `setterZone`, `system`; no líbero, `memberId`, `replacedIndexes`.

**Vagas por índice de `lineup`, nunca por `MemberId`.** Uma vaga, ou duas em diagonal (diferença 3), em ordem crescente, nunca de levantador: no 5x1, o índice 0; no 6x2, 0 e 3. Os centrais são `[2, 5]` (`MIDDLE_BLOCKER_LINEUP_INDEXES`). O motor aceita as duas formas, e a E4.7 envia os dois centrais, alternando, como o catálogo (decisão do Gabriel, P2). Por índice, quem entra numa vaga coberta herda a cobertura, sem par órfão (ADR 0027). A lista grava a escolha: o replay não depende de constante, e o índice único do aviso da E2.5 não representaria a alternância sem mudar o estado a cada ponto.

**Só 5x1 e 6x2 (decisão do Gabriel, P3).** 4x2 e Livre recusam o líbero (`LIBERO_SYSTEMS`). `formations.json` não muda, e o hash da v1 fica intacto.

**Partição com o líbero.** `lineup`, `bench` e `libero.memberId`, sem repetir, são exatamente `teams.<lado>.memberIds` (`isRosterPartition`).

**Projeção pura: `getLiberoSlot(state, phase)` e `getOnCourtBySlot(state, phase)`.** O líbero fica no slot do fundo (1, 5 ou 6) em que está uma vaga coberta; uma diagonal tem sempre uma vaga no fundo e uma na rede, então há no máximo um slot. Com a vaga coberta na rede, o líbero está fora, e por isso sai ao chegar na 4. Em `serving`, na posição 1, devolve `null`: quem saca é o titular. `getLineupBySlot` continua sendo a ordem de rotação, e `getServingPlayer` continua lendo `lineup`: o líbero não tem como sacar. O índice do slot vem da mesma tabela que coloca os membros, sem módulo.

**`ServeAlignment`:** no slot do líbero, o `memberId` dele e o papel `L`, no ponto da formação. Outro slot `L` do catálogo segue `roleWithLiberoOff`. `liberoReplaces` do catálogo nunca decide quem sai, porque não cobre a vaga única. `actingSetter` não muda: vaga de levantador é proibida.

**Ordem de validação no time do `MatchStarted`:** `lineup`, `setterZone`, `system`, `bench` (formato), `libero` (formato, sistema, vaga, membro do time), e por fim a partição, que continua reportando `bench`. `field` novos: `rotations.a.libero`, `rotations.b.libero` e `libero`. Nenhum código de recusa novo.

**`LineupChanged` ganha `libero`, obrigatório.** Ordem: `matchId`, `team`, `lineup`, `setterZone`, `bench`, `libero`. O parser confere o formato (UUID fora de `lineup` e de `bench`, vagas válidas). O aplicador confere a partição contra `teams` e o sistema e as vagas contra `teamState.system`, nunca a zona: quem está em quadra vem da projeção, e um escritor intercalado continua aceito (ADR 0027).

**Comandos.** `changeLineup` recebe `libero` em `LineupAllocation`: permite trocar ou desligar o líbero em partida, e a E4.8 decide se oferece. Alocação que difere só no líbero é mudança; idêntica, inclusive o líbero, é `lineup-unchanged`. Erro de partição aponta `lineup`, depois `libero`, depois `bench`; líbero em sistema sem líbero ou em vaga de levantador aponta `libero`. `substitutePlayer` preserva o líbero; líbero como quem sai ou quem entra é recusado com os erros atuais (`lineup` e `bench`).

**Um rali entre trocas** vale nas trocas calculadas: só um ponto muda a projeção, e a vaga coberta nunca muda num mesmo ponto (provado por teste). Em `LineupChanged` não há validação, como no ADR 0027.

## Contrato para a E2.10 (C#)

**A E2.10 porta** o parser do líbero, `isRosterPartition`, `isLiberoAllowed`, `getLiberoSlot`, `getOnCourtBySlot`, a sobreposição em `getServeAlignment` e as constantes (`LIBERO_SYSTEMS`, `SETTER_LINEUP_INDEXES`, `BACK_ROW_SLOTS`, `SERVING_SLOT`).

| Arquivo em `packages/match-engine/golden/`  | O que tem                                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `libero-alignment.json`                     | 48 casos `{ id, input: { system, lineup, setterZone, phase, libero }, expected: { formationKey, actingSetter, liberoSlot, slots } }`: 5x1 e 6x2 com os centrais, 5x1 só com `MB2` e só com `OH2`, nas 6 zonas e 2 fases                                                                    |
| `libero-events.json`                        | 42 casos no formato de `event-log.json`, com `servingPlayer` e `onCourt` opcionais: ciclo inteiro de side-outs, saque perdido na zona 5, `RevertedTo` de ponto e de `LineupChanged`, virada de set com o líbero fora, fim de partida, escritores intercalados, titular trocado e rejeições |
| `score-payloads.json`                       | Acrescenta 105 casos de `libero` no `MatchStarted` e no `LineupChanged`, com `field` e ordem de validação                                                                                                                                                                                  |
| `rotation-events.json`, `bench-events.json` | Migrados só com o acréscimo de `libero: null`                                                                                                                                                                                                                                              |

Os esperados são decididos à mão, em scripts descartáveis fora do repositório, que não importam o motor: as tabelas de slot do líbero por zona e fase são literais, e o alinhamento parte do `serve-alignment.json` do líbero desligado. Os golden reprovam as mutações do plano (fundo com a 4 ou sem a 1, sem a regra do saque, `rotateTeam` ou `withRecordedZones` perdendo o líbero, aplicador sem gravar o líbero, partição sem o líbero, slot lido de `liberoReplaces`, papel `L` trocado com os pares, aplicador conferindo a zona, vaga de levantador aceita). Ler o sacador de `getOnCourtBySlot` na fase `serving` dá o mesmo resultado, porque o líbero nunca está na posição 1 sacando: não é mutação observável.

Pontos de divergência, além dos ADR anteriores:

- **Ordem de chaves:** `bench`, `libero`, `lineup`, `setterZone`, `system` no time; `memberId`, `replacedIndexes` no líbero; `bench`, `libero`, `lineup`, `matchId`, `setterZone`, `team` no payload parseado.
- **`null` serializado:** `libero` ausente é erro, e `null` desliga.
- **Índice com tabela:** o slot de cada índice vem de `getLineupBySlot` sobre os índices, sem `%`, que em C# dá negativo.
- **Vagas:** inteiros de 0 a 5; `2.5`, `"2"` e `null` são erro. A lista é copiada antes de conferir.

## Consequências

- **Golden migrado por script, só com acréscimo de campos.** `serve-alignment.json` e `score-events.json` não mudam. Os casos do formato da E2.4 seguem sem `bench` e sem `libero`.
- **O estado não cresce por evento:** o líbero é um campo fixo por time, e o payload tem no máximo 2 índices a mais.
- **O evento prova formato, não verdade:** um `libero` forjado muda quem está em quadra, com efeito em saldo e rating. A E3.7 confere `libero` contra a escalação e `system` contra o plano.
- **E2.9:** quem está em quadra deixa de ser só o `lineup`: usar `getOnCourtBySlot`. O crédito do líbero é decisão da E2.9.
- **E4.7 e E4.8:** o design não tem o controle do líbero (`perguntas.md:15`): onde se escolhe, como a tela 22 o mostra e como as telas 09 e 10 o desenham. O orquestrador encaixa essa lacuna.
- **Vaga de não central:** as coordenadas do catálogo foram pensadas para o central; aparece no piloto, se alguém usar.
