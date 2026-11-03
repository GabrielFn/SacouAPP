# Glossário

Termo do app (pt-BR) e nome fixo no código (inglês). Fontes: `produto.md:279-301`, `revisao-mvp.md:95, 106-107`, `decisoes.md:12, 20, 26-28` e [ADR 0006](../arquitetura/adr/0006-formacoes-em-json.md). Quando um termo ainda não tem nome em nenhum documento, o nome fica **a definir** na tarefa indicada.

## Organização

| Termo no app | Nome no código | Nota |
|---|---|---|
| Grupo | `Group` | |
| Membro do grupo | `GroupMember` (`MemberId`) | Tudo aponta para `MemberId`, nunca `UserId` |
| Mensalista / avulso | `Regular` / `DropIn` | |
| Convidado | A definir (E3.5) | Sempre avulso, nunca mensalista |
| Ex-jogador | A definir (E3.16) | Como quem excluiu a conta aparece no histórico |
| Admin / Co-admin / Placar (papéis) | `Admin` / `CoAdmin` / `Scorekeeper` | |
| Rodada | `Session` | |
| Presença | `Attendance` | |
| Lista de espera | `Waitlist` | |
| Sorteio | `TeamDraw` | |
| Resumo da rodada | `SessionSummary` | |

## Quadra e partida

| Termo no app | Nome no código | Nota |
|---|---|---|
| Quadra da rodada | `CourtSession` | Stream de eventos, com as partidas dentro |
| Partida | `Match` | |
| Set | `MatchSet` | Para não colidir com o `Set` do JS (ADR 0023) |
| Placar | `Score` | |
| Placar da partida em andamento | `MatchScore` | Sets, set aberto e cópia congelada da configuração (ADR 0023) |
| Partida terminada | `FinishedMatch` | `MatchScore` mais motivo do fim e vencedor (ADR 0023) |
| Lado do time | `TeamSide` | `a` ou `b`, como as etiquetas das telas (ADR 0023) |
| Configurações do jogo | `GameSettings` | Value object (`produto.md:272`) |
| Regras de pontuação | `ScoringRules` | Sets, pontos, tie-break e vantagem, por valor no `MatchStarted` (ADR 0023) |
| Fila de times | `TeamQueue` | Mistura times e jogadores avulsos: `{ teams, players }`, no estado da `CourtSession`, gravada inteira no `MatchStarted` e no `QueueChanged` (ADR 0029) |
| Saída parcial | `PartialExit` | Quem sai do perdedor, quem entra e o lugar herdado, calculado por `planNextMatch` com o critério (`QueueExitCriterion`); nunca gravado (ADR 0029) |
| Banco | `bench` | Quem é do time e não está em `lineup`, na ordem da fila. Só manual no MVP (ADR 0027) |
| Alteração de escalação | `LineupChanged` | Evento com a alocação inteira do time: troca com o banco e tela 22 (ADR 0027) |
| Sacador | `ServingPlayer` | Quem está na posição 1 (`getServingPlayer`) |
| Time que saca | `servingTeam` | Lado que saca agora, no set aberto (ADR 0024) |
| Primeiro saque do set | `firstServer` | Lado que sacou primeiro no set; base da alternância (ADR 0024) |
| Side-out | `SideOut` | Regra derivada do estado, `isSideOut`; não é tipo de evento (ADR 0024) |
| Desfazer (evento) | `RevertedTo` | Nunca apaga. Emitido por `undoLastAction` e `revertToEvent` (ADR 0030) |
| Trocar sacador | `ServingTeamChanged` | Evento com `servingTeam` e `firstServer` decididos pelo comando; ninguém gira (ADR 0030) |
| Girar / desgirar | `shiftRotation` | Comando que grava um `LineupChanged` com a zona vizinha, `forward` ou `backward` (ADR 0030) |
| Linha do tempo | `replayTimeline` | Eventos ativos com o estado logo depois de cada um (ADR 0030) |
| Prévia do voltar | `RevertPreview` | O que muda ao voltar a um ponto: placar, saque, zonas e o que sai da linha do tempo; não grava nada (ADR 0030) |
| Ponto da linha do tempo | `RecentPoint` | Linha da tela 24: placar depois, sacador antes, side-out, zona, autor e tipo (ADR 0030, ADR 0031) |
| Ponto individual (de quem foi?) | `PointAttributed` | Evento com autor e tipo de um ponto já gravado, na hora ou depois; o último válido vale (ADR 0031) |
| Tipo do ponto | `PointKind` | `attack` (Ataque), `block` (Bloqueio), `ace` (Ace), `other` (Outro) e `opponent-error` (Erro do adversário, sem autor) (ADR 0031) |
| Autor do ponto | `PointAttribution` | Quem pontuou e como, por ponto ativo, lido da linha do tempo por `resolvePointAttributions` (ADR 0031) |
| Versão do evento | `SchemaVersion` | |
| Versão das regras da partida | `rulesVersion` | |

## Rotação

| Termo no app | Nome no código | Nota |
|---|---|---|
| Rotação / sistema de rotação | `Rotation` / `RotationSystem` | |
| Rotação atual | `RotationIndex` | |
| Id interno da rotação | `setterZone` | Zona do levantador. Na Livre, sem levantador, é a zona do primeiro da escalação (ADR 0024) |
| Chave de rotação nas formações | `RotationKey` | `setterZone` ou `0`, na Livre (ADR 0006) |
| Estado do time | `TeamState` | `bench`, `lineup`, `setterZone` e `system` (E2.3 a E2.5). A função vem do índice no `lineup` (ADR 0026). `null` em `rotations` é rotação desligada (ADR 0024) |
| Posição atual na quadra (1–6) | `RotationSlot` | Muda a cada giro. Não é o índice fixo na escalação. Ver a nota abaixo |
| Coordenada na quadra (x, y) | `CourtPoint` | |
| Posição no saque | `ServeAlignment` | Quem fica em cada `RotationSlot`, com função e `CourtPoint`, mais `actingSetter`. Só o slot em que o líbero está tem `L`; com o líbero desligado ou fora, nenhum (ADR 0026, ADR 0028) |
| Quem levanta | `actingSetter` | `MemberId` de quem levanta naquela rotação: o único no 5x1, o do fundo no 6x2, o da rede no 4x2, quem está na posição 3 na Livre (ADR 0026) |
| Versão do catálogo de formações | `formationsVersion` | Gravada no `MatchStarted`. O catálogo é imutável por versão (ADR 0026) |
| Formação | `Formation` | Resultado por fase (ADR 0006) |
| Modelo de formação | `FormationTemplate` | Entrada crua (ADR 0006) |
| Validador de sobreposição | `OverlapValidator` | |
| Relação de sobreposição | `OverlapRelation` | As 7 de `rotacoes.md`, com id como `1-behind-2` (ADR 0021) |
| Modo de regra (FIVB 2025–28 / Clássico) | `OverlapRuleMode` | `fivb-2025-28`, o padrão, e `classic` (ADR 0021) |
| Levantador / líbero | `Setter` / `Libero` | |
| Função do jogador | `PlayerRole` | |

**`RotationSlot` e `CourtPosition`:** são o mesmo conceito, a posição oficial atual de 1 a 6, que muda a cada giro. O índice fixo do jogador na escalação é outro conceito e não usa esse nome. O nome no código é `RotationSlot`, e não há tipo `CourtPosition` ([ADR 0021](../arquitetura/adr/0021-overlap-validator.md)). O lugar físico do jogador é o `CourtPoint`.

## Jogador

| Termo no app | Nome no código | Nota |
|---|---|---|
| Nível | `SkillLevel` | 1–5, privado |
| Cartinha | `PlayerCard` | |
| Faixa da cartinha | A definir (E1.3) | Bronze, Prata, Ouro, Elite |

## Planos

| Termo no app | Nome no código | Nota |
|---|---|---|
| Pro do Grupo | `IGroupPlan` | Interface de controle de acesso |
| Sacou+ do Jogador | `IUserPlan` | Interface de controle de acesso |
