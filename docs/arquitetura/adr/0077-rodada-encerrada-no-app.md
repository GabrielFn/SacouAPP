# ADR 0077 — Rodada encerrada no app (telas 06 e 26)

Status: aceita (23/11/2026, decisão do Gabriel). Complementa a ADR 0076.

## Contexto

Com o encerramento antes do horário (ADR 0076), `endsAt` fica no passado e `startsAt` no futuro. O app decidia
"próxima rodada" só pelo `startsAt`: a rodada aparecia duas vezes no Início e as telas 06 e 26 seguiam oferecendo
"Abrir quadra", "Sortear times" e "Adicionar". O canvas (`Rodada.dc.html`) não desenha esse estado.

## Decisão

- Uma regra só para "encerrada": `hasEnded` em `round-cards.ts` (`endsAt <= now` e não cancelada). Usam-na
  `groupRoundState`, `nextRoundOf`, `upcomingRoundsOf`, `roundsInWindow` e as telas 06 e 26. "Próxima" passa a querer
  dizer início no futuro e ainda não encerrada.
- Telas 06 e 26 de rodada encerrada: selo "Encerrada", a lista de quem foi e um único botão no rodapé, "Ver resumo"
  (abre a 12). Somem Abrir quadra, Sortear/Montar times, Adicionar quem confirmou, o rodapé de presença (VOU / Não vou)
  e o link "Resumo da rodada" (o botão o substitui).
- `summaryAvailable` vale para rodada não cancelada com `startsAt <= now` ou `endsAt <= now`.

## Consequências

- Nenhuma mudança de API nem de dados. Reabrir rodada encerrada continua fora do produto.
- Alternativa descartada: manter as ações e só mostrar o selo (deixaria reabrir a quadra de uma rodada fechada).
