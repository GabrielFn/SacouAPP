# ADR 0076 — Encerrar antes do horário com partida jogada

Status: aceita (22/11/2026). Emenda a ADR 0072, D1.

## Contexto

O "Encerrar rodada" era recusado antes do `startsAt` (`sessions.round-not-started`). Num racha em que a quadra
começa cedo e uma partida já terminou, o resumo e a votação do MVP só abririam 6 h depois do `startsAt`.

## Decisão

- `Round.Close(now, hasFinishedMatch)` aceita fechar antes do `startsAt` quando a quadra da rodada tem pelo menos uma
  partida terminada. `ClosedAt = now` e `endsAt` vira `now` (o fim mais cedo vence, como na ADR 0072).
- O `CloseRoundHandler` só consulta antes do início: `IRoundFacts` + o porto `IRoundPlayedMatches` (Sessions), implementado em Matches sobre `ICourtSessionResults.FindOfRoundAsync` e
  `SummarizeAsync` (`FinishedMatches.Count > 0`). O porto fica em Sessions porque Matches referencia Sessions (o inverso seria ciclo).
- Sem partida terminada, o erro continua `sessions.round-not-started`. Rodada cancelada continua `round-canceled`.
  Fechar de novo mantém o primeiro instante.

## Consequências

- Rodadas podem ter `endsAt < startsAt`. A votação (abre em `endsAt`) e as projeções leem `EndsAt`, então seguem o
  novo instante; o risco de filtros que assumem `endsAt >= startsAt` não tem teste dedicado (as consultas de estatísticas
  e `recentRoundOf` com `endsAt < startsAt` ficam como pendência).
- Depois do encerramento antecipado, as regras de antes do início deixam de valer: o link (`IsOpenForLinkAt`) fecha
  e a página `/r` mostra "já terminou"; confirmar ou sair responde `sessions.round-closed` para o próprio jogador (o admin segue corrigindo a presença); e a
  edição da rodada também é recusada (`sessions.round-closed`). Cobertos por testes de unidade e de integração.
- Alternativas descartadas: antecipar o `startsAt` pelo primeiro evento da quadra (muda a data exibida e a página
  web) e esconder o botão (resumo só 6 h depois).
