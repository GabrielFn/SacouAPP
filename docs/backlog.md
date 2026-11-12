# Backlog: mapa e próxima tarefa

Este arquivo guarda só o mapa de marcos e a regra da próxima tarefa. Cada informação tem um único dono:

| Informação | Onde está |
|---|---|
| ID, tarefa, aceite e dependências | [`plano-mvp.md`](plano-mvp.md), seção "Backlog" |
| Marco atual e status (inclusive adiadas) | [`estado/progresso.md`](estado/progresso.md) |
| Detalhe de cada tarefa | `estado/tarefas/<ID>.md`, escrito pelo analista |

## Tarefas por marco

| Marco | Tarefas |
|---|---|
| M1 · Fundação | E0.1–E0.9, E1.1 |
| M2 · Motor da partida | E1.2–E1.5, E2.1–E2.11 |
| M3 · Base da API e do app | E0.10, E3.1–E3.5, E3.17, E4.1–E4.6 |
| M4 · A quadra | E3.6–E3.8, E4.7–E4.11, E4.17, E5.1 |
| M5 · Depois do jogo | E3.9, E3.11, E3.12, E4.12, E4.13 |
| M6 · Prontidão para o piloto | E3.16, E5.2–E5.4, E6.1, E6.2 |
| M7 · Piloto | E7.1–E7.3 |
| Pós-piloto ([ADR 0046](arquitetura/adr/0046-escopo-do-piloto-e-papel-placar.md)) | E3.10, E3.13–E3.15, E4.14–E4.16; e as partes adiadas da E3.5, E3.7, E4.11 e E4.12. Não entram na regra da próxima tarefa; voltam com decisão do Gabriel depois do M7 |

## Próxima tarefa

Retome o que está em andamento em `estado/progresso.md`. Senão, escolha uma tarefa do marco atual que não esteja feita, adiada nem bloqueada e cujas dependências estejam feitas; a ordem dentro do marco é livre e tarefas independentes podem correr em paralelo. Com as tarefas do marco feitas (sem contar adiadas), faça a revisão de segurança geral e o relatório antes de seguir para o marco seguinte. Para bloqueios e autonomia, vale o `CLAUDE.md`.
