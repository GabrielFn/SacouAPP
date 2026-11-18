# Placar: sets, pontos, tie-break e vantagem

Regras do placar da partida (E2.2, [ADR 0023](../arquitetura/adr/0023-placar-e-catalogo-de-eventos.md)). Código em `packages/match-engine/src/score/`; casos em `packages/match-engine/golden/score-*.json`. Catálogo de eventos em [`eventos.md`](eventos.md).

## Configuração (`ScoringRules`)

Vem por valor no `MatchStarted`, todos os campos obrigatórios e sem padrão no motor (o SettingsResolver resolve antes, E3 e E4). O aplicador e os comandos leem da partida, nunca de constante.

| Campo | Valores | Observação |
|---|---|---|
| `bestOf` | 1, 3 ou 5 | Telas 08 e 20. "Livre" está em aberto (`perguntas.md`, item 6) |
| `pointsPerSet` | 1 a 99 | Limite técnico: dois dígitos no placar |
| `tieBreakPoints` | 1 a 99, ou `null` | `null` desliga o tie-break |
| `winMargin` | 2 (vantagem de 2) ou 1 (sem vantagem) | Vale também no tie-break |

## Regras

- **Sets para vencer:** metade arredondada para cima: 1, 2 e 3.
- **Alvo do set:** `pointsPerSet`, exceto no set decisivo de uma série (`bestOf > 1` e `setNumber === bestOf`) com tie-break ligado, em que vale `tieBreakPoints`. **Com 1 set, vale `pointsPerSet`**, mesmo com tie-break configurado (tela 18: "25 pontos · 1 set · tie-break 15").
- **Vencedor do set:** quem lidera, com pontos `>=` alvo e diferença `>=` margem. **Sem teto:** dois times nivelados em vantagem seguem até abrir a margem.
- **Set point:** o time que, marcando o próximo ponto, venceria o set. É uma lista, porque em 24–24 sem vantagem os dois têm set point; vazia com o set decidido. Uso: telas 09 e 10 e vibração (`produto.md:138`).
- **Vencedor da partida:** quem alcança os sets para vencer.
- **Fim de set é sempre confirmado** (`produto.md:69`; tela 25). A regra só detecta; `SetEnded` nasce da confirmação. Com o set decidido e sem confirmar, marcar ponto é recusado (`set-decided`), e desfazer o último ponto reabre o jogo normalmente.
- **Fim de partida:** a confirmação do set decisivo gera dois eventos, `SetEnded` com `nextSet: null` e `MatchEnded`, gravados juntos pelo chamador. Se só o primeiro gravar, a partida fica sem set aberto e confirmar de novo emite o `MatchEnded` que falta.
- **Encerrar partida antes do fim:** `MatchEnded` com `endReason: "manual"`. O vencedor (`a`, `b` ou `null`) vem de quem chama; o motor não decide (`perguntas.md`, item 7). No app, `manualEndWinner` (ADR 0066) decide: vence quem lidera em sets; com os sets iguais, vence quem lidera em pontos do set em andamento; empate total (ou sem set aberto) fica sem vencedor (`null`) e ninguém sai da quadra. O set em andamento fica em `currentSet` da partida terminada.
- **Limite de partidas por stream:** 200 terminadas podem existir. Um novo `MatchStarted` com 200 terminadas é rejeitado no replay (`event-rejected`), e `startMatch` recusa antes (`too-many-matches`). É limite técnico contra log hostil, não regra do vôlei: uma rodada real fica perto de 30 partidas.

## Comandos

`startMatch`, `scorePoint`, `confirmSetEnd`, `endMatchManually`, `changeLineup` e `substitutePlayer` decidem pelas regras acima e devolvem eventos sem envelope, porque `eventId` e `sequence` vêm de fora do motor.

| Recusa | Quando |
|---|---|
| `invalid-payload` | Entrada fora do esquema, `matchId` de uma partida já terminada (o replay rejeitaria o evento), ou troca com jogador ou partição errados (`field` `lineup` ou `bench`) |
| `unsupported-rules-version` | `rulesVersion` fora de `SUPPORTED_RULES_VERSIONS`. Só comandos recusam: o replay aceita qualquer versão |
| `unsupported-formations-version` | `formationsVersion` diferente da versão atual do catálogo; o replay aceita, e `getTeamServeAlignment` devolve `null` (ADR 0026) |
| `match-already-open` | `startMatch` com partida aberta |
| `too-many-matches` | `startMatch` com 200 partidas terminadas no stream (`MAX_FINISHED_MATCHES`) |
| `no-open-match` | Nenhuma partida aberta |
| `no-open-set` | Partida sem set aberto e sem vencedor a concluir |
| `set-decided` | Ponto com o set decidido e não confirmado |
| `set-not-decided` | Confirmação com o set ainda sem vencedor |
| `rotation-off` | `changeLineup` ou `substitutePlayer` em time com a rotação desligada, que não tem banco (ADR 0027) |
| `lineup-unchanged` | `changeLineup` com a alocação idêntica à atual, inclusive a ordem do banco (ADR 0027) |

## Ponto individual (autor e tipo)

"De quem foi?" (tela 31) grava autor e tipo de um ponto **já marcado**, num evento à parte, `PointAttributed` ([ADR 0031](../arquitetura/adr/0031-ponto-individual.md)). O `PointScored` não muda: o ponto já está no placar antes da resposta. Código em `packages/match-engine/src/attributions/`.

- **Tipos:** Ataque (`attack`), Bloqueio (`block`), Ace (`ace`), Outro (`other`) e Erro do adversário (`opponent-error`). Os quatro primeiros têm autor; o erro do adversário nunca tem.
- **Sem resposta, sem evento:** "Pular" e o próximo ponto não gravam nada, e o ponto fica sem autor.
- **Quando:** na hora ou depois, pelo Corrigir ou no fim do set, em qualquer set da partida aberta, inclusive o decidido e o já fechado. Com a partida terminada, não (P2).
- **Quem pode ser o autor:** quem estava em quadra **no rali** pelo time que pontuou, no estado logo antes do ponto (fase de saque se o time sacava), com o líbero se estava em quadra e nunca o banco. Trocar alguém ou girar depois não muda isso. Com a rotação do time desligada, qualquer um do time. Só o comando confere a quadra.
- **Combinações impossíveis (P1, só no comando):** Ace só do sacador do rali, então o time tinha de estar sacando e, com a rotação ligada, o autor estava na posição 1. O líbero nunca tem Ace nem Bloqueio.
- **Trocar a resposta:** responder de novo grava outro evento, e o último válido na ordem canônica vale. Não há "sem autor" no Corrigir: só trocar por outro, ou DESFAZER se foi a última ação (P3).
- **Correções:** DESFAZER logo depois de preencher tira só o preenchimento; o segundo tira o ponto. Voltar a um ponto anterior tira também os preenchimentos feitos depois dele, mesmo de pontos que ficam, e `previewRevert` conta isso em `removed.attributions`.
- **Leitura:** `resolvePointAttributions(timeline)` devolve `[{ pointEventId, matchId, setNumber, team, kind, author }]`, só dos pontos com preenchimento válido, na ordem dos pontos. Ignora o preenchimento de ponto inativo, de evento que não é ponto, de outra partida ou com autor fora do time que pontuou, como se não existisse. `getRecentPoints` traz `author` e `kind` em cada linha; `getUnattributedPoints(timeline)` lista os pontos do set da tela 24 ainda sem resposta, do mais antigo.

| Recusa de `attributePoint` | Quando |
|---|---|
| `no-open-match` | Nenhuma partida aberta |
| `invalid-attribution-target` | O alvo não é `PointScored` ativo da partida aberta (o erro não leva o id) |
| `invalid-point-kind` | `kind` fora de `POINT_KINDS` |
| `invalid-point-author` | Autor ausente num tipo que pede autor, presente no erro do adversário, fora da quadra do rali, ou combinação impossível (P1) |

## Estado (`CourtSessionState`)

Chaves em ordem UTF-16 crescente, porque o golden compara o texto; sets e times ficam em arrays ou em `a`/`b`, nunca em chave numérica ou por ID.

```
CourtSessionState { currentMatch: MatchScore | null, finishedMatches: FinishedMatch[] }  // inicial: null, []
MatchScore { completedSets: [{ score, setNumber, winner }],
             currentSet: { firstServer, score: { a, b }, servingTeam, setNumber, targetPoints } | null,
             formationsVersion, matchId, rotations: { a: TeamState | null, b: TeamState | null }, rulesVersion, scoring, setsWon: { a, b }, teams }
TeamState { bench: MemberId[0..18], lineup: MemberId[6], setterZone: 1..6, system: "5x1" | "6x2" | "4x2" | "livre" }  // regras em rotacoes.md
FinishedMatch: MatchScore + endReason (depois de currentSet) + winner (no fim)
```

Decisões técnicas e reversíveis, para o relatório do M2: limites de 1 a 99 pontos e de 24 membros por time, `winMargin` 1 ou 2 com o mesmo valor no tie-break, sem teto de pontos, 200 partidas terminadas por stream.

## Conferências do servidor

O evento prova o formato, não a verdade. Ao receber eventos do celular (E3.7, [ADR 0060](../arquitetura/adr/0060-sincronizacao-do-stream-da-quadra.md)), o servidor roda o replay de todo o stream e recusa, com `event-implausible` e um `reason` da lista fechada, o que um celular honesto nunca grava, porque os comandos do motor recusam. Cada conferência lê só o próprio stream, pelo estado logo antes do evento, e catálogos imutáveis.

| Evento | Regra | `reason` |
|---|---|---|
| Qualquer um, entre um `SetEnded` que decide a partida e o `MatchEnded` | Só entram `MatchEnded`, `PointAttributed` e `RevertedTo` (o "desfazer" e o "De quem foi?" seguem valendo) | `match-pending` |
| `PointScored` | O set aberto ainda não tem vencedor (`getSetWinner` nulo): 25–23 com vantagem já decidiu; 24–24, não | `set-decided` |
| `SetEnded` | O set tem vencedor e é o do evento; `nextSet` nulo só quando o set decide a partida; `targetPoints` do próximo set por `targetPointsForSet`; `setterZones` iguais aos atuais; `firstServer` alternado, salvo quando o próximo set é o decisivo (sorteio de quem escreve) | `set-not-decided`, `wrong-set-winner`, `wrong-next-set`, `wrong-target-points`, `wrong-setter-zones`, `wrong-first-server` |
| `MatchEnded` | `sets-won`: o vencedor é o de `getMatchWinner`. `manual`: aceito, com o vencedor escolhido | `wrong-match-winner` |
| `ServingTeamChanged` | Set aberto e sem vencedor; saca o adversário de quem sacava; em 0–0 ele também passa a ter sacado primeiro, depois de 0–0 quem sacou primeiro fica | `set-decided`, `wrong-serving-team`, `wrong-first-server` |
| `PointAttributed` | O alvo é `PointScored` ativo da partida aberta; o autor segue `isValidAuthor` e `isPlausibleAuthor` (na quadra do rali, Ace só do sacador, líbero sem Ace nem Bloqueio, `opponent-error` sem autor). O resolvedor ignoraria em silêncio; o servidor recusa | `invalid-attribution-target`, `invalid-point-author` |
| `QueueChanged` | A fila muda (igual à atual é recusada) | `queue-unchanged` |
| `MatchStarted` | `rulesVersion` e `formationsVersion` nas listas de versões suportadas (listas, para um app antigo offline) | `unsupported-rules-version`, `unsupported-formations-version` |

**Não recusado** (pergunta 69, padrão adotado): o que depende de dado que muda durante a rodada, como times e fila contra a presença, a fila recalculada pelo modo do grupo e o plano Pro. Recusar travaria para sempre a sincronização de um celular honesto; o risco fica com quem tem papel, registrado pelo lote. Os casos estão no golden `packages/match-engine/golden/server-checks.json`, lido pelo TS (os recusados passam no replay do motor; os aceitos saem dos comandos) e pelo C#.
