# ADR 0026 · Posições no saque por sistema e fase (`ServeAlignment`)

**Status:** aceito (02/11/2026). **Tarefa:** E2.4. Plano em [`docs/estado/tarefas/E2.4.md`](../../estado/tarefas/E2.4.md). Regras em [`rotacoes.md`](../../dominio/rotacoes.md). Estende o [ADR 0024](0024-saque-e-rotacao-derivados.md), o [ADR 0010](0010-rotation-and-rule-mode.md) e resolve as pendências do [ADR 0006](0006-formacoes-em-json.md) sobre pares trocados e líbero desligado.

## Decisões

**`system` em `TeamState` e em `rotations.<lado>`.** Obrigatório, com os valores de `FORMATION_SYSTEMS`, na ordem `lineup`, `setterZone`, `system`. Cada time tem o seu. Logs no formato da E2.3 são rejeitados, sem caminho de compatibilidade, porque nada foi gravado: segue `schemaVersion` 1, com o golden atualizado (como no ADR 0023).

**`formationsVersion` em `MatchStarted` e `MatchScore`, em vez de cópia das coordenadas (decisão do Gabriel, `decisoes.md:26`).** A partida grava o número, e o catálogo é imutável por versão. Inteiro ≥ 1 no parser. Ao mudar `formations.json`, sobe `FORMATION_CATALOG_VERSION` e o catálogo anterior fica disponível. Um teste em `volley-rules` guarda o hash do conteúdo do catálogo da versão 1, e é ele que falha em quem editar sem subir a versão. A cópia real das coordenadas entra com o editor do Pro.

| Situação | Comportamento |
|---|---|
| Replay com versão desconhecida | Aceito: o evento é aplicado como gravado (caso `s16-unknown-formations-version-*`) |
| `getTeamServeAlignment` com versão desconhecida | `null`, como rotação desligada: a tela mostra só o time que saca |
| `startMatch` com versão diferente da atual | Recusado com `unsupported-formations-version`, como `rulesVersion`: uma partida nova nunca nasce sem posições |

**A função vem do índice no `lineup`, sem campo novo.** 5x1: `[S, OH1, MB1, OPP, OH2, MB2]`. 6x2 e 4x2: `[S1, OH1, MB1, S2, OH2, MB2]`, com o 2º levantador no índice 3. O giro não muda a função de ninguém, e o estado não representa levantadores fora da diagonal: esse aviso depende da posição declarada, na E4.8.

**`IRotationSystem` é a tabela `ZONE_FORMATIONS`, em `score/constants.data.ts`, sem classe.** Cada sistema e zona dão `{ formationKey, swapPairs }`. A diferença entre sistemas é só dado, então a Strategy do ADR 0011 não tem o que escolher além de uma linha na tabela. Um teste amarra a tabela a `rotationOrder`. O `*` marca `swapPairs: true`:

| `setterZone` | 1 | 6 | 5 | 4 | 3 | 2 |
|---|---|---|---|---|---|---|
| 5x1 | 1 | 6 | 5 | 4 | 3 | 2 |
| 6x2 | 1 | 6 | 5 | 1* | 6* | 5* |
| 4x2 | 4 | 3 | 2 | 4* | 3* | 2* |
| livre | 0 | 0 | 0 | 0 | 0 | 0 |

Na zona 1 do 4x2, o levantador `lineup[0]` está no fundo e `lineup[3]` na rede: é a chave 4, sem troca.

**Troca de pares só no rótulo.** `S1↔S2`, `OH1↔OH2`, `MB1↔MB2`, inclusive sobre `liberoReplaces` e `serveSubstitution`. O ponto é o do modelo, e `getFormation` não muda.

**Líbero desligado.** Com o líbero desligado, o slot `L` recebe a função de `liberoReplaces`, já com a troca, no ponto do modelo. Nenhum slot de saída tem `L`.

**Pendência do ADR 0006 sobre `liberoReplaces`.** Ele só é lido em slot `L`, e `ServeAlignment` não o expõe. Em `serving`, nas chaves 2 e 5 do 5x1 e 5 do 6x2, a posição 1 já vem de `serveSubstitution`. Líbero em quadra é slot `L`, nunca `liberoReplaces != null`.

**`ServeAlignment` não leva `note`.** "Líbero no lugar do Central 2" e "S1 infiltrando" ficam falsos com líbero desligado ou pares trocados.

**`actingSetter` é quem levanta, por função no modelo, antes da troca.** 5x1: `S`. 6x2: `S1`, o do fundo. 4x2: `S2`, o da rede. Livre: `P3`, quem está na posição 3.

**Na Livre,** a chave é sempre `0`, os membros giram, e a função é `P<slot>`, da posição e não do jogador.

**Fase e nulos.** `getServeAlignment(teamState, phase)` recebe a fase, para servir à prévia do seletor da tela 22. `getTeamServeAlignment(match, team)` deriva a fase do estado: `servingTeam === team` é `serving`. Devolve `null` sem partida, sem set aberto, com rotação desligada ou com catálogo desconhecido.

**O motor não bloqueia por sobreposição.** `validateServeAlignment(alignment, { mode, tolerance? })` devolve o `Result` do validador, com modo obrigatório, e quem chama faz o aviso (ADR 0010, ADR 0021). Com pontos do catálogo, nunca há violação.

**Pasta e tipos de evento.** Tudo em `packages/match-engine/src/score/`, sem tipo novo de evento. Nada aqui impede o líbero ligado da E2.11: o slot `L` continua no catálogo, e `roleWithLiberoOff` é o único ponto que o resolve.

## Contrato para a E2.10 (C#)

**A E2.10 porta `getServeAlignment` e as tabelas `ZONE_FORMATIONS`, `SWAPPED_PAIR_ROLES` e `ACTING_SETTER_ROLES`, sem aritmética própria, e roda `serve-alignment.json` pelo caminho.** `getTeamServeAlignment` e `validateServeAlignment` ficam só em TS, salvo decisão da E3.7.

| Arquivo em `packages/match-engine/golden/` | Formato |
|---|---|
| `serve-alignment.json` | `{ id, input: { system, lineup, setterZone, phase }, expected: { formationKey, actingSetter, slots } }`, com `slots["1".."6"] = { memberId, role, point: { x, y } }`. São 48 casos (4 sistemas × 6 zonas × 2 fases, id `6x2-zone-4-receiving`), mais um com `lineup` fora de ordem de UUID |

Os esperados são decididos à mão, com tabelas próprias em um script descartável fora do repositório, que não importa o motor. As coordenadas vêm de `volley-rules/golden/formations.json`.

Pontos de divergência, além dos dos ADR 0022, 0023 e 0024:

- **Ordem de chaves:** `lineup`, `setterZone`, `system` no time; `formationsVersion` entre `currentSet` (ou `endReason`) e `matchId` no estado, e no payload parseado entre `firstServer` e `matchId`. O golden compara texto.
- **Ordem de validação:** `matchId`, `rulesVersion`, `formationsVersion`, `scoring`, `teams`, `firstServer`, `rotations`; dentro do time, `lineup`, `setterZone`, `system`.
- **`system` por lista permitida e comparação ordinal:** `"constructor"` e `"6x0"` são `invalid-payload`, sem ecoar o valor.
- **`double` em igualdade exata** nas coordenadas, como no ADR 0006.
- **Casos só em TS:** propriedades, `getTeamServeAlignment`, validador sobre o alinhamento e o hash do catálogo.

## Consequências

- **Golden migrado por script, só com acréscimo de campos:** `score-payloads.json`, `rotation-events.json` e `score-events.json`. As únicas linhas removidas pelo diff são as que ganharam vírgula.
- **Mudar uma formação agora exige versão nova:** o teste do hash reprova a edição silenciosa. Quando a versão 2 existir, `getFormation` passa a receber a versão, e `getTeamServeAlignment` deixa de comparar só com a atual.
- **O evento prova formato, não verdade:** `system` forjado passa no replay e permitiria usar sistema Pro em grupo grátis. A E3.7 confere `system` contra o plano e `rotations` contra a escalação. `formationsVersion` forjado só faz as posições sumirem naquela partida; a E3.7 confere o número na escrita.
- **Interface:** a E4.8 gira o desenho (a rede fica embaixo na tela e no topo nas coordenadas), compara posições declaradas com `role` e reancora `lineup` e `setterZone` quando o levantador muda de lugar. A E4.7 passa `system` e o `lineup` na ordem acima.
- **Lacuna do backlog, para o orquestrador:** a tela 22 salva a escalação no meio da partida, a E4.8 depende só da E2.4, e nenhum evento grava essa alteração. É preciso decidir entre E2.5 e E2.7 antes da E4.8.
