# ADR 0013 · Placar por QR com token por stream

**Status:** aceito (decidido em 30/10/2026, registrado em 31/10/2026). **Tarefa:** E0.8.

> **Substituído no piloto pelo [ADR 0046](0046-escopo-do-piloto-e-papel-placar.md) (11/11/2026):** a entrega por QR, o código de uso único e o token sem conta saem; quem tem o papel Placar, Co-admin ou Admin assume a quadra com confirmação. Continua valendo "um celular escreve por vez". O QR pode voltar depois do piloto, com decisão do Gabriel.

**Fontes:** `decisoes.md:21`; `revisao-mvp.md:85, 110, 123, 156`; `produto.md:121, 357`.

## Contexto

O admin precisa passar o placar a alguém sem conta e sem dar outros poderes.

## Decisão

- O QR dá uma **sessão temporária de Placar daquela quadra**, sem conta e sem outros poderes.
- O QR troca um **código de uso único por um token da própria API,** válido só para aquele stream.
- **Um celular escreve por vez;** o admin pode retomar.
- **No MVP pede-se instalar o app.**

## Conflitos entre as fontes

"Só daquela partida" (`revisao-mvp.md:85`, `produto.md:121`). Vale `decisoes.md:21`: "daquela quadra", coerente com o stream por `CourtSession` ([ADR 0009](0009-court-session-event-sourcing.md)).

## Alternativas

Placar web simplificado para quem não tem o app: não adotado no MVP (`revisao-mvp.md:156`), mantido em [`ideias.md`](../../ideias.md).

## Consequências

**A definir na E3.8:** validade do código e do token, formato e tamanho do código, se o token é assinado ou opaco, revogação ao fim da sessão e mecanismo de "um celular por vez". Ver o [modelo de ameaças](../../seguranca/modelo-de-ameacas.md).
