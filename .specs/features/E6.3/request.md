# E6.3 · Pedido

> Linha literal da E6.3 de `docs/plano-mvp.md` (PR #253), colada pelo orquestrador em 25/11. Resposta 222: marca de exclusão por 60 dias (aprovada com as recomendações).

## Brief do orquestrador (25/11/2026), literal

> Detalhe a tarefa **E6.3** do Sacou (reaplicar as exclusões de conta depois de restaurar um backup; lacuna G1 da E6.2; sensível; ~400 linhas; bloqueia o piloto com jogadores reais).
>
> Decida com o plano: comando/rota de operação que reaplica exclusões (idempotente, auditado, sem dado pessoal nos logs), onde fica a lista de exclusões (dentro ou fora do backup), como o roteiro de restauração passa a chamar o comando, testes de integração com Postgres real. Fatias S1.. de até ~800 linhas (infraestrutura).

## Linha do backlog (`docs/plano-mvp.md`, branch da E6.2)

| E6.3 | Reexclusão depois de restaurar o backup (lacuna G1 da E6.2, ADR 0082, D10). ~400 linhas; **sensível** | Um comando (Cloud Run Job ou modo do executável) lê `identity.deleted_accounts` e reaplica o `DELETE /v1/me` de cada marca no banco restaurado; teste de integração: conta apagada depois do dump volta na restauração e some depois do comando, sem tocar nas outras. Bloqueia o piloto com jogadores reais | E5.3 |

## Origem da lacuna

ADR 0082, D10 (literal): "**Nenhuma restauração real da produção nem piloto com jogadores reais antes do comando de reexclusão a partir de `identity.deleted_accounts`.**" `docs/operacao/backup.md`, "Restaurar de verdade", passo 3: "**Ainda não há comando para isso** (a exclusão só roda pelo `DELETE /v1/me` da própria pessoa): **pendente**".

Prazo da marca: resposta 222 da E6.2 (marca de exclusão guardada por 60 dias, aplicada na E6.5), segundo o brief; o texto da resposta está na branch da E6.2.
