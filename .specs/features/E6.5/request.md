# E6.5 · Pedido

Linha literal de `docs/plano-mvp.md` (linha 195):

> | E6.5 | Prazo da marca de exclusão (lacuna G3, pergunta 222). ~150 linhas | A varredura diária (ADR 0069) apaga de `identity.deleted_accounts` as marcas com mais de 60 dias; teste com 59 e 61 dias. Não bloqueia | E3.16 |

Brief do orquestrador (25/11/2026), resumido em frases:

- Prazo de 60 dias da marca de exclusão `identity.deleted_accounts`, lacuna G3 da E6.2; resposta 222: 60 dias.
- Reaproveitar o mecanismo de varredura agendada existente (Cloud Scheduler das notificações).
- Decidir: quem expurga (rota interna chamada pelo Scheduler, como as varreduras das notificações?), idempotência, o que o sign-in faz depois do expurgo (a conta pode voltar a se cadastrar), teste com 59 e 61 dias.
- Dependência: E6.3 S2 na main (condição 5 da segurança no plano da E6.3).

Resposta 222 (`docs/estado/perguntas.md:279`): "Prazo da marca de exclusão (reaplicar exclusões depois de restaurar backup). **Recomendação: 60 dias.**"

Sem capturas: não há tela.
