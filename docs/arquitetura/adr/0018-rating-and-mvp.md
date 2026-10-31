# ADR 0018 · Rating, faixas, MVP do dia e ponto individual

**Status:** aceito (decidido em 30/10/2026, registrado em 31/10/2026). **Tarefa:** E0.8.

**Fontes:** `decisoes.md:14-17`; `revisao-mvp.md:68, 80-81, 111, 154, 157`; `produto.md:67, 70, 264`.

## Decisão

**Rating.** Glicko-2, separado quadra x areia. Conversão: 1500 = 3,0; cada 100 pontos = 0,5; limitado a 1–5. O nível autodeclarado é a semente.

**Privacidade do nível.** Privado no app; aparece na cartinha por padrão, e o jogador pode esconder. O admin vê os níveis no sorteio, nunca na imagem compartilhada. Ranking do grupo nunca por nível.

**Faixas da cartinha.** Bronze ≤ 2,4 · Prata 2,5–3,4 · Ouro 3,5–4,4 · Elite ≥ 4,5.

**MVP do dia.** Padrão calculado por dados: saldo +/− em quadra, aproveitamento, sequência e ganho de rating. Votação é opção do grupo.

**Ponto individual.** Pro, opção do grupo. "De quem foi?" fica aberto sem limite de tempo; o próximo ponto fecha. Sem resposta, o ponto fica sem autor e pode ser preenchido depois, em Corrigir ou no fim de set.

**Projeções.** Módulo Stats com projeções recalculáveis quando há correção; fórmula do MVP versionada (`revisao-mvp.md:111`).

## Conflitos entre as fontes

**Votação de MVP e "De quem?" "depois do MVP"** (`revisao-mvp.md:68`). Vale `decisoes.md:14-15`, que os define como opções do grupo; o ponto individual está no backlog (E2.8, E4.10). Os fluxos próprios mais completos seguem em [`ideias.md`](../../ideias.md).

## Alternativas

- **Um nível só:** não adotada (`revisao-mvp.md:157`).
- **Admin vê só a média do time:** não adotada (`revisao-mvp.md:154`).

## Consequências

- `produto.md:67` avisa que os números da conversão serão ajustados com os dados do piloto.
- "Rating com IA" foi corrigido: Glicko-2 é cálculo, não IA (`revisao-mvp.md:81`).
- **A definir:** pesos da fórmula do MVP e parâmetros do Glicko-2 (E3.9).
