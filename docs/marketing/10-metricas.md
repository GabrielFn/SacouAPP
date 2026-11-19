# 10 · Métricas e acompanhamento

Sem ferramenta nova: o piloto não tem PostHog (ADR 0046). Tudo sai de três lugares que já existem ou já estão no plano.

| Fonte | O que dá | Custo |
|---|---|---|
| **Banco do Sacou** (painel da E7.2) | Uso de verdade: grupos, rodadas, confirmações, partidas | Já previsto |
| **Play Console** | Visitas à ficha, instalações, desinstalações, avaliações, termos de busca, origem das visitas | Incluso na conta |
| **Instagram e TikTok** (painel de cada rede) | Alcance, visualizações, cliques no link do perfil | R$ 0 |

Mais uma planilha particular do Gabriel para o que é conversa (de onde veio cada organizador). **Fora do repositório**, que é público.

## O número que manda

**Grupos ativos na semana:** grupos com pelo menos uma rodada que teve partida com placar no app nos últimos 7 dias. É o que mostra racha acontecendo, e não só instalação.

## Piloto (fase 1): métricas do portão, contadas no banco

| Métrica | Como contar | Meta |
|---|---|---|
| **Confirmações pelo link** | Presenças "vou" com origem `self`, divididas pelo total de "vou" de quem não é mensalista automático (`self` + `admin`), por rodada e por grupo | **60% ou mais** (portão) |
| Grupos em 4 rodadas seguidas | Grupos com rodada jogada em 4 semanas consecutivas | 5 grupos (`produto.md`); mínimo de 3 (`plano-mvp.md`) |
| Ativação | Grupos que fizeram a 1ª rodada em até 7 dias depois de criados | Todos os do piloto |
| Partidas com placar | Partidas encerradas no app, por rodada | Pelo menos 1 por rodada em todos os grupos |
| Sorteio usado | Rodadas com sorteio confirmado | Acompanhar, sem meta |
| Fila usada | Partidas com alguém saindo e entrando pela fila | Acompanhar, sem meta |
| Testadores no teste fechado | Play Console | 12 ou mais, por 14 dias seguidos |

A origem da presença (`self`, `admin`, `regular`) já é gravada (`dados-pessoais.md`, linha da presença). A fórmula exata do portão, em especial como tratar os mensalistas que já entram confirmados, é definição da E7.2; a tabela acima é a proposta do marketing.

**O que o marketing lê nesses números**

- Confirmações pelo link abaixo de 60%: o problema é o convite (texto, momento, login), não a divulgação. Ajustar a mensagem C de `07` antes de crescer.
- Partidas sem placar: a promessa "placar e fila na mesma tela" não está se cumprindo na quadra. Não usar como mensagem principal até resolver.
- Recurso que ninguém usa: tirar das capturas.

## Lançamento suave e público (fases 2 e 3)

| Etapa | Métrica | Fonte | Meta inicial (a calibrar depois do piloto) |
|---|---|---|---|
| Descoberta | Visitantes da ficha, por origem | Play Console | Sem meta; acompanhar por semana |
| Instalação | Conversão da ficha (visitas que instalam) | Play Console | Comparar com a mediana da categoria, que o Console mostra |
| Ativação | Contas que criaram ou entraram em um grupo em 7 dias | Banco | Maioria das contas novas |
| Grupo novo | Grupos criados por semana | Banco | Fase 2: de 2 a 3 por semana, por indicação |
| Grupo ativo | Grupos ativos na semana | Banco | Fase 3, semana L4: o triplo do piloto |
| Retenção | Grupos ativos na semana 4 depois da 1ª rodada | Banco | Metade ou mais |
| Convite | Jogadores por grupo que confirmaram pelo link | Banco | 60% ou mais, como no portão |
| Qualidade | Nota e número de avaliações; falhas | Play Console e Sentry | Nota 4,5 ou mais; responder todas |

As metas são proposta de partida, não previsão. Depois do piloto, trocar pelas médias reais.

## Saber de onde veio cada instalação, sem ferramenta nova

1. **Link da loja com origem marcada.** O Play Console separa as visitas por origem quando o link leva o parâmetro `referrer`:

   ```text
   https://play.google.com/store/apps/details?id=com.sacou.app&referrer=utm_source%3D[ORIGEM]%26utm_medium%3D[MEIO]
   ```

   | Onde o link vai | `utm_source` | `utm_medium` |
   |---|---|---|
   | Bio do Instagram | `instagram` | `bio` |
   | Bio do TikTok | `tiktok` | `bio` |
   | Cartaz da arena (um QR por arena) | `arena-01`, `arena-02`... | `cartaz` |
   | Mensagem em comunidade | `comunidade` | `whatsapp` |
   | Embaixador | `emb-01`, `emb-02`... | `whatsapp` |
   | Anúncio, se houver | `meta` ou `google` | `pago` |

   Usar códigos (`arena-01`), nunca o nome de uma pessoa, no link. Conferir no Console onde o relatório aparece (aquisição por origem) logo depois da publicação.
2. **Gerar o QR** com qualquer gerador gratuito que não exija cadastro nem encurte o link (o QR deve apontar direto para o endereço da loja).
3. **Perguntar.** A cada organizador novo que falar com o Gabriel: "como você conheceu o Sacou?". Uma linha na planilha.
4. **Cruzar por data e cidade.** Grupos criados na semana em que o cartaz entrou numa arena, com o local da rodada naquela arena, vêm de lá.

## Rotina

| Quando | O que olhar | Tempo |
|---|---|---|
| Toda segunda | Grupos ativos, grupos novos, confirmações pelo link, avaliações novas | 15 min |
| Fim de cada semana do calendário | Melhor e pior post (visualizações e cliques no perfil) | 10 min |
| Fim de cada fase | Tabela desta página preenchida, num relatório curto em `docs/estado/relatorios/` | 30 min |

## O que não dá para medir no piloto (e tudo bem)

- Quantas cartinhas e resumos foram compartilhados: saem pela folha de compartilhar do celular, sem registro no servidor.
- Funil tela a tela dentro do app: precisaria de PostHog, que é pós-piloto.
- Qual post gerou cada grupo: só por aproximação (itens 3 e 4 acima).
