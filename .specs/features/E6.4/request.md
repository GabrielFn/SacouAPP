# E6.4 · Página web de exclusão de conta

Pedido literal do backlog (`docs/plano-mvp.md`, linha 194), passado pelo orquestrador em 26/11/2026:

> | E6.4 | Página web de exclusão de conta (lacuna G2, pergunta 220, opção 1). ~150 linhas; **sensível** | Página estática `/excluir-conta` (como `/termos`) com o passo a passo do app e o e-mail do encarregado para pedir sem o app; link no Data safety (`docs/operacao/google-play.md`). Bloqueia o teste fechado e a produção da Play, não o teste interno | E6.1, pergunta 199 |

Brief do orquestrador (26/11/2026), as frases que pesam no plano:

- "A pergunta 199 (e-mail do encarregado, novo e gratuito, criado pelo Gabriel) ainda não foi resolvida: o plano precisa dizer como a página sai sem o e-mail (ex.: valor por configuração/ambiente, sem e-mail fixo no código; não publicar em produção sem ele) e não pode inventar um endereço."
- "A rota nova não pode repetir esse furo" (M6-B1: `/R/` e `/C/` em maiúsculas sem CSP).
- Regra "como pedir sem o app" da ajuda da Play (answer 13327111): o nome do app/desenvolvedor visível, os passos, quais dados são apagados e quais ficam e por quanto tempo (prazos do inventário `docs/seguranca/dados-pessoais.md`).
- "Interface em pt-BR; textos centralizados como os de `/termos`."
- "Atualize no plano o que muda em `docs/seguranca/modelo-de-ameacas.md` (rota pública nova)."

Resposta 220 do Gabriel (25/11/2026, "Aprovo com as recomendações"): opção 1, página estática com o passo a passo e o e-mail (~150 linhas).

Capturas: nenhuma. A página não tem tela em `design/mvp/` (como `/termos`, ADR 0083, D6); o passo a passo copia os rótulos das telas 14 (`Perfil.dc.html`), 30 (`Conta.dc.html`) e 30b (`ExcluirConta.dc.html`).
