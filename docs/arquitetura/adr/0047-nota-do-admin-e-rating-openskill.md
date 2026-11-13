# ADR 0047 · Nota definida pelo admin e rating OpenSkill por partida

**Status:** aceito (11/11/2026). **Tarefa:** nenhuma; decisões do Gabriel em conversa de 11/11/2026. **Substitui em parte o [ADR 0018](0018-rating-and-mvp.md)** (rating e privacidade do nível) e ajusta o [ADR 0046](0046-escopo-do-piloto-e-papel-placar.md) (o rating volta ao piloto, escondido).

## Contexto

O nível autodeclarado era a semente do Glicko-2. Com o Glicko-2 fora do piloto (ADR 0046), o nível declarado viraria a nota definitiva: quem se superestima ganha nota alta, o sorteio depende de quem foi honesto e o iniciante que se subestima fica marcado. O Glicko-2 também foi feito para jogo individual, e o vôlei é em time.

## Simulação (11/11/2026)

Comparação feita com a biblioteca `openskill` (Python), num modelo de brinquedo: 24 jogadores com força real conhecida, 14 presentes por rodada, 5 partidas de 25 pontos por rodada, times sorteados, e a chance de vencer o rali dada pela diferença de força média dos times. Métrica: correlação de Spearman entre o rating e a força real, na média de 120 a 200 simulações. O nível declarado tem ruído e 30% dos jogadores se superestimam.

| Rodadas | Por partida | Por rali (β × 10) | Só o nível declarado |
|---|---|---|---|
| 1 | 0,70 | 0,70 | 0,70 |
| 5 | 0,75 | 0,74 | 0,70 |
| 10 | 0,79 | 0,79 | 0,70 |
| 20 | 0,84 | 0,82 | 0,70 |

Os valores acima partem do nível declarado. Começando com todos iguais, o rating só alcança o nível declarado perto de 10 rodadas. Atualizar por rali com o β padrão piora (0,61 em 20 rodadas), porque o σ cai rápido demais com ralis ruidosos; com β calibrado, só empata. O placar como peso não muda nada com dois times. **Conclusão:** atualizar por partida, e o que mais pesa no início é um bom ponto de partida.

## Decisões

1. **Rating com OpenSkill (método Weng-Lin), atualizado por partida.** Substitui o Glicko-2. Continua separado quadra x areia. O modelo (Plackett-Luce, o padrão das bibliotecas) e a escala ficam com a E3.9; se a escala usar μ e σ na mesma faixa do Glicko (por exemplo, μ inicial 1500), a conversão para a nota 1–5 e as faixas da E1.3 continuam valendo.
2. **A nota inicial é do admin.** O Admin ou o Co-admin define a nota de cada membro no grupo. O jogador pode **sugerir** o próprio nível no cadastro; o admin vê a sugestão e aceita ou corrige.
3. **Sem nota do admin:** vale a sugestão do jogador; sem sugestão, 3,0. Nos dois casos, o rating começa com **incerteza alta** (σ maior), para as primeiras partidas corrigirem rápido. A nota confirmada pelo admin começa com incerteza menor.
4. **O jogador não vê a nota que o admin deu** nem o rating calculado. Ele vê só as estatísticas. O admin continua vendo as notas no sorteio, nunca na imagem compartilhada, e o ranking do grupo nunca é por nível (ADR 0018).
5. **No piloto, o rating é calculado e escondido.** Ninguém vê o rating calculado, nem o admin: o sorteio usa a nota do admin (ou a sugestão). Os dados servem para calibrar o modelo. A cartinha do piloto não mostra nota nem faixa, só estatísticas, e o MVP do dia não usa o ganho de rating.

## Alternativas descartadas

- **Glicko-2:** feito para jogo individual; precisa de muitas rodadas para estabilizar no vôlei.
- **TrueSkill:** feito para times, mas patenteado e com a marca da Microsoft.
- **Rating por rali:** não ganhou de por partida na simulação e é mais sensível à calibração.
- **Saldo +/− ajustado (estilo NBA):** precisa de muitos jogos e é difícil de explicar.
- **Só o nível autodeclarado:** não se corrige e premia quem se superestima.

## Consequências

- Não há biblioteca oficial de OpenSkill em C#. A E3.9 porta o modelo para o C#, com testes golden gerados da `openskill` de TypeScript (MIT), como já é feito com o motor.
- A nota do admin é privada e precisa de autorização na API: nenhuma rota devolve ao jogador a nota que o admin deu nem o rating (`produto.md:373`). Entra no modelo de ameaças e no inventário de dados pessoais na tarefa que a implementar (E3.17).
- A tela de membros (E4.5) ganha a nota do admin com a sugestão do jogador. Telas aprovadas pelo Gabriel em 12/11/2026: 19 (Membros, com a nota), 19a (Definir a nota), 19b (Revisar notas sugeridas) e 27 (Perfil rápido, com o nível como sugestão).
- O sorteio (E3.6) usa a nota do admin, ou a sugestão, ou 3,0.
- Mostrar o rating ao jogador, a nota e a faixa na cartinha e o ganho de rating no MVP voltam com decisão do Gabriel depois do piloto, com os dados calibrados.
