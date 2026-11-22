# ADR 0075 · Tela "Rodadas do grupo"

**Status:** aceito (22/11/2026). **Tarefa:** R97 Parte 2 (D6). Plano e resposta do Gabriel (P3 = 2) em [`docs/estado/tarefas/R97.md`](../../estado/tarefas/R97.md), seção "Parte 2".

## Contexto

O domínio aceita até 20 rodadas futuras e 7 séries por grupo (`rodadas.md`), mas o app só mostrava a próxima rodada de cada grupo: uma segunda rodada marcada ficava invisível até a primeira começar. O Gabriel escolheu uma tela nova com a lista das rodadas do grupo, sem desenho em `design/mvp/`.

## Decisões

**D1 · A tela.** Rota `groups/[groupId]/rounds` (só IDs). Cabeçalho "Rodadas" com o nome do grupo e o botão em pílula "Nova rodada" (só admin e co-admin; a API continua sendo quem recusa). Duas seções:
- **Próximas:** as abertas e a "Rolando agora" (`startsAt ≤ now < endsAt`), em ordem crescente de início, mais as canceladas futuras.
- **Recentes:** as encerradas (`endsAt ≤ now`) e as canceladas passadas, da mais nova para a mais velha.

Cada item usa a linguagem do cartão da 17 (faixa do dia, data e estado em negrito, local, pílula do usuário e contagem): "Aberta", "Rolando agora", "Encerrada · Ver resumo" ou "Cancelada". O toque abre a 06; na encerrada, o resumo (12).

**D2 · Sem mudança na API.** `GET /rounds` já lista as futuras e as das últimas ~30 h desde o início, sem filtro nem paginação; o teto do domínio mantém a lista pequena. "Recentes" mostra só essa janela (~24 h depois do fim, a mesma do cartão "Ver resumo"). Um histórico maior pede `?pastDays` na API (pergunta P4 do plano).

**D3 · O cartão do grupo leva à lista.** Na aba Grupos, o corpo do cartão (com ou sem rodada) abre a tela nova, e não mais a 06. O rodapé continua como no desenho da 17 ("Membros", "Como jogamos", "Editar rodada" ou "Criar rodada"). O Início continua com cartões de rodada (abrem a 06 ou o resumo) e passa a mostrar **todas** as rodadas futuras da semana, de todos os grupos, em ordem de horário; o grupo sem rodada na semana mostra a próxima.

**D4 · Sugestão de data livre.** A "Nova rodada" (20) sugere o próximo dia fixo do grupo que ainda não tem rodada marcada, lido do cache da lista. É só a sugestão: dois rachas no mesmo dia continuam válidos.

## Consequências

- Desvio consciente da 17: tocar no cartão abre a lista, então a 06 da rodada em andamento fica a dois toques na aba Grupos (no Início continua a um).
- A lista e o papel são derivados do cache do TanStack Query (registro único); a tela não tem reducer porque não tem estado com transições.
- Os cartões do Início passam a ter chave por rodada, não por grupo.
