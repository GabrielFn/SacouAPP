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
- **Encerrar partida antes do fim:** `MatchEnded` com `endReason: "manual"`. O vencedor (`a`, `b` ou `null`) vem de quem chama; o motor não decide (`perguntas.md`, item 7). O set em andamento fica em `currentSet` da partida terminada.

## Comandos

`startMatch`, `scorePoint`, `confirmSetEnd` e `endMatchManually` decidem pelas regras acima e devolvem eventos sem envelope, porque `eventId` e `sequence` vêm de fora do motor.

| Recusa | Quando |
|---|---|
| `invalid-payload` | Entrada fora do esquema, ou `matchId` de uma partida já terminada (o replay rejeitaria o evento) |
| `unsupported-rules-version` | `rulesVersion` fora de `SUPPORTED_RULES_VERSIONS`. Só comandos recusam: o replay aceita qualquer versão |
| `match-already-open` | `startMatch` com partida aberta |
| `no-open-match` | Nenhuma partida aberta |
| `no-open-set` | Partida sem set aberto e sem vencedor a concluir |
| `set-decided` | Ponto com o set decidido e não confirmado |
| `set-not-decided` | Confirmação com o set ainda sem vencedor |

## Estado (`CourtSessionState`)

Chaves em ordem UTF-16 crescente, porque o golden compara o texto; sets e times ficam em arrays ou em `a`/`b`, nunca em chave numérica ou por ID.

```
CourtSessionState { currentMatch: MatchScore | null, finishedMatches: FinishedMatch[] }  // inicial: null, []
MatchScore { completedSets: [{ score, setNumber, winner }], currentSet: { score: { a, b }, setNumber, targetPoints } | null,
             matchId, rulesVersion, scoring, setsWon: { a, b }, teams }
FinishedMatch: MatchScore + endReason (depois de currentSet) + winner (no fim)
```

Decisões técnicas e reversíveis, para o relatório do M2: limites de 1 a 99 pontos e de 24 membros por time, `winMargin` 1 ou 2 com o mesmo valor no tie-break, sem teto de pontos.
