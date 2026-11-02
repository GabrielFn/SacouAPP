# ADR 0009 · Event sourcing por `CourtSession`

**Status:** aceito (decidido em 30/10/2026, registrado em 31/10/2026). **Tarefa:** E0.8.

**Fontes:** `decisoes.md:26, 28`; `revisao-mvp.md:108-109, 118-122`; `produto.md:262, 274, 309, 315`.

## Contexto

A fila e as saídas parciais atravessam partidas, então um stream por partida não guarda esse estado (`revisao-mvp.md:108`). O app também precisa de modo offline, desfazer e corrigir.

## Decisão

- **Um stream por quadra da rodada (`CourtSession`),** com as partidas dentro. O event sourcing fica só aí.
- **Eventos gravam o resultado das regras:** quem saiu, quem entrou, nova posição. O servidor aplica eventos sem reimplementar toda a lógica.
- **Versão em tudo:** `SchemaVersion` nos eventos, `rulesVersion` na partida e cópia congelada de configurações e formações no início.
- **Desfazer é evento (`RevertedTo`),** nunca apaga.
- **Envelope** com ID do celular, sequência e lote. Reenviar não duplica, porque o evento chega com ID gerado no celular (`produto.md:309`).
- **Eventos só com IDs** (`MemberId`), nenhum dado pessoal ([ADR 0012](0012-personal-data-member-id.md)).

## Alternativas

**Stream por partida:** o desenho anterior, descartado porque a fila atravessa partidas (`revisao-mvp.md:18, 108, 120`).

## Consequências

- Os testes golden compartilhados mantêm o estado igual em TS e C# (`produto.md:315`, E2.10).
- Como o servidor aplica o resultado que recebe, a validação do que chega é um ponto aberto do [modelo de ameaças](../../seguranca/modelo-de-ameacas.md).
- **Envelope e função de estado:** definidos no [ADR 0022](0022-event-envelope-replay.md).
- **A definir:** catálogo de eventos (E2.2 a E2.8); tratamento de conflito na sincronização (E3.7).
