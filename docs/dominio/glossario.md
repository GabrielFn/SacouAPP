# Glossário

Termo do app (pt-BR) e nome fixo no código (inglês). Fontes: `produto.md:279-301`, `revisao-mvp.md:95, 106-107`, `decisoes.md:12, 20, 26-28` e [ADR 0006](../arquitetura/adr/0006-formacoes-em-json.md). Quando um termo ainda não tem nome em nenhum documento, o nome fica **a definir** na tarefa indicada.

## Organização

| Termo no app | Nome no código | Nota |
|---|---|---|
| Grupo | `Group` (`GroupId`) | Agregado com os membros dentro ([grupos.md](grupos.md), ADR 0040) |
| Nome do grupo | `GroupName` | 1 a 60 caracteres visíveis, até 240 pontos de código; nunca em log |
| Membro do grupo | `GroupMember` (`MemberId`) | Tudo aponta para `MemberId`, nunca `UserId`. Um por pessoa por grupo, para sempre; entre módulos viaja como `Guid` (ADR 0040) |
| Papel no grupo | `GroupRole` | `Admin`, `CoAdmin`, `Scorekeeper`, `Player`. Não confundir com `PlayerRole` (função em quadra) |
| Jogador (papel) | `Player` | Papel sem poderes de gestão |
| Permissão no grupo | `GroupPermission` | O que um papel pode fazer; cada rota de grupo exige exatamente uma ([grupos.md](grupos.md)) |
| Situação do membro | `MembershipStatus` | `Active`, `Left` (saiu), `Removed` (removido pelo admin). A linha nunca é apagada |
| Tipo de membro | `MemberType` | `Regular` (mensalista) ou `DropIn` (avulso) |
| Convite por link ou QR | `GroupInvite` | Token de 256 bits mostrado uma vez; o banco guarda só o hash (E3.2, parte 3) |
| Conta (pessoa que entrou no app) | `User` (`UserId`) | Módulo Identity (E3.1). `UserId` é interno (UUID v7) e nunca vai a evento ([ADR 0036](../arquitetura/adr/0036-verificacao-do-token-e-usuario.md)) |
| Identidade do login | `AuthSubject` | UID do Firebase (`sub` do ID token), 1 a 128 caracteres ASCII visíveis, sensível a maiúsculas |
| Mensalista / avulso | `Regular` / `DropIn` | Valores de `MemberType` |
| Convidado | A definir (E3.5) | Sempre avulso, nunca mensalista |
| Ex-jogador | A definir (E3.16) | Como quem excluiu a conta aparece no histórico |
| Admin / Co-admin / Placar (papéis) | `Admin` / `CoAdmin` / `Scorekeeper` | Valores de `GroupRole`; permissões em [grupos.md](grupos.md) |
| Configuração do grupo ("Como jogamos") | `GroupSettings` | Documento completo; toda folha tem valor ([configuracao.md](configuracao.md), ADR 0041) |
| Configuração da rodada ou da partida | `SettingsLayer` | Camada parcial: folha ausente ou `null` herda |
| Configuração resolvida | `ResolvedSettings` | `values` (documento completo) e `sources` (de onde veio cada folha) |
| Origem de um valor | `SettingsSource` | `group`, `round` ou `match`: o cinza "do grupo" e o ponto laranja "nesta rodada" |
| Modelo (Pelada, Racha, Treino, Areia, Do zero) | `SettingsTemplate` | Cópia, não vínculo; nunca traz nem apaga os fatos do grupo |
| Rodada | `Session` (no código, o agregado é `Round`) | Uma ocorrência do racha ([rodadas.md](rodadas.md), ADR 0043) |
| Série de rodadas ("Repetir toda semana") | `RoundSeries` | Dia da semana e hora local; cada ocorrência nasce herdando o grupo |
| Presença | `Attendance` | Uma por membro por rodada; estados `Going`, `NotGoing`, `Waitlisted`, `Promoted` |
| Lista de espera | `Waitlist` | A posição é calculada pela ordem (`Sequence`), nunca gravada |
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
| Times entrando | `enteringTeams` | Lados em que entra um time novo no plano da próxima partida (`a` antes de `b`), com a rotação a montar (ADR 0050) |
| Vitórias seguidas | `getWinStreak` | Partidas terminadas seguidas, terminando na última, vencidas pelo lado com o mesmo conjunto de membros; dispara o "vencedor também sai" (`winnerLeaving`, ADR 0050) |
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
