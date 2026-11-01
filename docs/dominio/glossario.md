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
| Set | `Set` | |
| Placar | `Score` | |
| Configurações do jogo | `GameSettings` | Value object (`produto.md:272`) |
| Fila de times | `TeamQueue` | Mistura times e jogadores avulsos |
| Saída parcial | `PartialExit` | |
| Banco | `Bench` | |
| Sacador | `ServingPlayer` | |
| Side-out | `SideOut` | |
| Desfazer (evento) | `RevertedTo` | Nunca apaga |
| Versão do evento | `SchemaVersion` | |
| Versão das regras da partida | `rulesVersion` | |

## Rotação

| Termo no app | Nome no código | Nota |
|---|---|---|
| Rotação / sistema de rotação | `Rotation` / `RotationSystem` | |
| Rotação atual | `RotationIndex` | |
| Id interno da rotação | `setterZone` | Zona do levantador |
| Chave de rotação nas formações | `RotationKey` | `setterZone` ou `0`, na Livre (ADR 0006) |
| Estado do time | `TeamState` | Sistema, escalação, levantador, rotação atual e banco |
| Posição atual na quadra (1–6) | `RotationSlot` | Muda a cada giro. Não é o índice fixo na escalação. Ver a nota abaixo |
| Coordenada na quadra (x, y) | `CourtPoint` | |
| Posição no saque | `ServeAlignment` | |
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
