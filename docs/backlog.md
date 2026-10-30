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
| M2 · Motor da partida | E1.2–E1.5, E2.1–E2.10 |
| M3 · Base da API e do app | E3.1–E3.5, E4.1–E4.6 |
| M4 · A quadra | E3.6–E3.8, E4.7–E4.11, E5.1 |
| M5 · Depois do jogo | E3.9–E3.14, E4.12–E4.14, E4.16 |
| M6 · Prontidão para o piloto | E3.15, E3.16, E4.15, E5.2–E5.4, E6.1, E6.2 |
| M7 · Piloto | E7.1–E7.3 |

## Próxima tarefa

1. **Retomar:** se alguma tarefa está "Em andamento" em `progresso.md` e nenhuma sessão ativa cuida dela, retomar a de menor ID. Uma sessão nova assume que não há sessão ativa, salvo aviso em contrário.
2. **Escolher:** senão, pegar a de menor ID do marco atual que não esteja feita nem adiada, com todas as dependências feitas e sem acesso pendente.
3. **Nada elegível no marco:** registrar o bloqueio em `estado/perguntas.md` e aplicar o passo 2 ao marco seguinte, enquanto o Gabriel não responde.

Como ler a regra:

- Tarefa fora de `progresso.md` não foi iniciada.
- O ID é comparado por número: épico, depois tarefa (E2.2 vem antes de E2.10).
- "Sem acesso pendente": nenhuma dependência do tipo "acesso ..." aguardando o Gabriel. Pedir um acesso segue a seção "Autonomia" do `CLAUDE.md`.
- Dependência em um marco inteiro (E7.1 depende de M6) exige o marco concluído.
- Um marco está concluído quando todas as suas tarefas estão feitas, sem contar as adiadas. O marco atual passa a ser o seguinte.
