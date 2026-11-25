# E6.8 · Pedido

> Linha literal da E6.8 de `docs/plano-mvp.md`, mais o brief do orquestrador de 25/11/2026. Resposta 225 do Gabriel: sim, apagar do aparelho os pontos pendentes de quem exclui a conta.

## Brief do orquestrador (25/11/2026), literal

> Detalhe a tarefa **E6.8** do Sacou (pontos/eventos da quadra pendentes no aparelho de quem exclui a conta: apagar do SQLite local; lacuna G7 da E6.2; resposta 225: sim, apagar).
>
> Decida: o que apagar (eventos não enviados, sessões da quadra com o `owner_key` da conta, cache do servidor, preferências), quando (depois do 204 do `DELETE /v1/me`), e o que acontece se o mesmo aparelho tiver outra conta. Testes com o banco local falso. Se houver tela mexida, o roteiro do emulador.

## Linha do backlog (`docs/plano-mvp.md`, linha 198)

| E6.8 | Pontos pendentes de uma conta apagada no aparelho (lacuna G7, pergunta 225, M4-B7). ~150 linhas | A exclusão feita no aparelho (tela 30b) apaga do `sacou.db` as sessões da quadra cujo `owner_key` é da conta apagada; as de outras contas ficam (teste). Não bloqueia | E4.3, E4.11 |

## Origem da lacuna

ADR 0067, Consequências (literal): "**Risco aceito:** a exclusão da conta deixa os pendentes dela no aparelho para sempre (a mesma conta não existe mais e outra conta nunca os envia)."

Pergunta 225 (`docs/estado/perguntas.md`): "Apagar do aparelho os pontos pendentes de quem exclui a conta? **Recomendação: sim.**" Resposta: sim.
