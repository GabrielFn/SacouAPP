# E6.7 · pedido

Brief do orquestrador (25/11/2026), literal:

> Detalhe a tarefa **E6.7** do Sacou (a página web pública da rodada `/r/{código}` esconde os apelidos 7 dias depois da rodada; lacuna G6 da E6.2; resposta 224: sim, 7 dias).
> Decida: "7 dias depois" de `starts_at` ou de `closed_at`; o que aparece no lugar (contagem? "Jogador 1"?); cache (`Cache-Control`); testes com 6 e 8 dias (relógio falso). Texto pt-BR centralizado.

Linha do backlog (`docs/plano-mvp.md:197`), literal:

> | E6.7 | Apelidos da página `/r` escondidos depois da rodada (lacuna G6, pergunta 224). ~100 linhas | A página `/r/{código}` mostra a lista de apelidos só até 7 dias depois do início da rodada; depois, só grupo, data e local; teste com 6 e 8 dias. Não bloqueia | E3.12 |

Pergunta 224 (`docs/estado/perguntas.md:281`): "Esconder os apelidos da página `/r` 7 dias depois da rodada? **Recomendação: sim.**" (aprovada com as recomendações).

Sem capturas: a tela 01 (`design/mvp/`) desenha só a rodada aberta; o estado "depois de 7 dias" não tem desenho.

Plano: [plan.md](plan.md).
