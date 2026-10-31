# ADR 0015 · Planos, cobrança pelas lojas e Pix

**Status:** aceito (decidido em 30/10/2026, registrado em 31/10/2026), **com preços propostos, não confirmados**. **Tarefa:** E0.8.

**Fontes:** `decisoes.md:20`; `revisao-mvp.md:89, 113, 153, 158`; `produto.md:12, 65, 179-199, 313, 395`.

## Decisão

- **Dois planos:** Pro do Grupo e Sacou+ do Jogador.
- **Preços propostos, ainda não confirmados** ([`perguntas.md`](../../estado/perguntas.md), item 1): Pro do Grupo R$ 12,90/mês ou R$ 99/ano; Sacou+ R$ 5,90/mês ou R$ 44,90/ano.
- **Cobrança pelas lojas via RevenueCat.**
- **Pix copia e cola só para a mensalidade e a diária do racha,** com a chave do próprio organizador; nunca para os planos.
- **Nada pago dá vantagem em quadra.**
- **No piloto, Pro liberado de graça.**
- **Controle por `IGroupPlan` e `IUserPlan`.**

## Conflitos entre as fontes

- **Preço R$ 9,90/mês ou R$ 79/ano** (`produto.md:179, 184, 395`; `revisao-mvp.md:153`): superado pelos valores propostos em `decisoes.md:20`.
- **"O jogador nunca paga"** (`produto.md:12, 179`): superado pelo Sacou+, confirmado em `decisoes.md:20`.

## Alternativas

Venda só pela web: não adotada (`revisao-mvp.md:153`). Deixar só Livre/6x0 no piloto: não adotada (`revisao-mvp.md:158`).

## Consequências

- O Pix usa a chave do organizador e o app não confirma o pagamento sozinho: "Já paguei" com confirmação do admin (`produto.md:65, 199`). A taxa com gateway é futura (`produto.md:185`).
- **A definir:** como a assinatura se liga ao grupo e como a API recebe o estado da RevenueCat, inclusive se por webhook (E3.15); algoritmo e gestão da chave da criptografia do Pix (E3.10). Onde ficam os planos no código é decisão da E3.15 (ADR 0005).
