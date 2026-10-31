# ADR 0017 · Configuração herdada, membros, fila e banco

**Status:** aceito (decidido em 30/10/2026, registrado em 31/10/2026). **Tarefa:** E0.8.

**Fontes:** `decisoes.md:8-11, 13`; `revisao-mvp.md:91, 155`; `produto.md:62, 68, 77-81, 93, 307, 312, 359`.

## Decisão

**Configuração herdada.** Grupo → rodada → partida, tudo opcional: cobrança, limite de vagas, sets, pontos, tie-break, placar, rotação, fila e sorteio. Implementação no SettingsResolver ([ADR 0011](0011-backend-patterns.md)). Modelos: Pelada descontraída, Racha organizado, Treino, Areia rei da quadra e Do zero. Padrão de partida: 1 set, com opção de mudar.

**Membros.** Mensalista ou avulso. Convidado é sempre avulso, nunca mensalista. Papéis Admin, Co-admin e Placar.

**Fila "quem perde sai", com saída parcial.**

- Se há menos gente esperando que um time, sai do perdedor só o número de quem espera, pelo critério configurável. O padrão é mais partidas seguidas.
- Quem entra assume a posição de quem saiu.
- Ninguém esperando, ninguém sai.
- Avulsos que saíram e somam um time formam time por ordem de chegada.

**Banco no MVP:** "sai quem saca" e manual.

## Alternativas

- **Time de avulsos por equilíbrio de nível:** não adotada no MVP (`revisao-mvp.md:155`).
- **Banco por pontos, por set e por tempo:** ficam para depois (`produto.md:93`).

## Consequências

- `produto.md:68` detalha outros critérios de saída e os modos da fila; `decisoes.md:11` fixa o critério configurável e o padrão.
- **A definir:** nome do convidado no código e efeitos do merge de membros (E3.5).
