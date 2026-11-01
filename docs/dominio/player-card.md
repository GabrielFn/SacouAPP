# Cartinha: nível 1–5 e faixas

Implementação: `packages/volley-rules/src/player-card/`. Casos compartilhados: `packages/volley-rules/golden/player-card-level.json`. Decisão de produto das faixas e da conversão: [ADR 0018](../arquitetura/adr/0018-rating-and-mvp.md).

## Fórmula

O nível exibido tem uma casa decimal ("3,8 · Ouro"). O cálculo termina em **décimos inteiros**, para não depender de ponto flutuante nos limites:

`levelTenths = clamp(floor((rating - 1500) / 20 + 30 + 0.5), 10, 50)`

Rating não finito falha fechado, com o erro `invalid-rating`.

## Decisão: arredondar antes de classificar

Os documentos não definem o caso 2,45. A **faixa sai do nível exibido**, com meio para cima. Assim, a cartinha nunca mostra "2,5 · Bronze", e não há lacuna entre as faixas. Decisão pequena e reversível: para mudar, alteram-se só a fórmula, o golden e este documento, pois a cartinha é projeção recalculável.

`floor` com `+ 0.5` é contrato: `Math.Round` do C# arredonda 24,5 para 24.

## Limites

| Faixa | `tier` | Décimos | Nível | Rating |
|---|---|---|---|---|
| Bronze | `bronze` | ≤ 24 | ≤ 2,4 | abaixo de 1390 |
| Prata | `silver` | 25–34 | 2,5–3,4 | a partir de 1390 |
| Ouro | `gold` | 35–44 | 3,5–4,4 | a partir de 1590 |
| Elite | `elite` | ≥ 45 | ≥ 4,5 | a partir de 1790 |

Consequência: 1790, que daria 4,45 sem arredondar, já é Elite.

## Fora desta regra

Rótulos em pt-BR e a formatação "3,8" (E4.13); Glicko-2 e a conversão inversa da semente, em que 3 vira 1500 (E3.9); privacidade do nível, garantida na API (E3.9 e E4.13).
