# 06 · Plano de lançamento

Amarrado ao roteiro de `docs/plano-mvp.md`: M6 (app instalável por convite) → M7 (piloto com 3 a 5 grupos) → portão → loja aberta. As semanas são relativas, porque as datas dependem do fim do M6.

## As quatro fases

| Fase | Quando | Objetivo | Quem vê o app | Critério para passar |
|---|---|---|---|---|
| **0 · Preparação** | Agora até o fim do M6 | Deixar marca, grupos e peças prontos | Ninguém de fora | Lista de grupos fechada, perfis reservados, capturas e vídeo 3 prontos |
| **1 · Piloto (M7)** | 4 a 5 semanas | Provar que o racha roda no app | 3 a 5 grupos convidados, **teste fechado** do Play | Portão: **60% das confirmações pelo link** (meta do produto: 5 grupos por 4 rodadas seguidas, `produto.md`) e nenhum bug grave aberto |
| **2 · Lançamento suave** | 2 a 3 semanas | Crescer por indicação, sem barulho, e ganhar as primeiras avaliações | Loja aberta no Brasil, sem divulgação pública | 2 semanas sem bug grave, ficha completa, nota da loja saudável |
| **3 · Lançamento público** | 4 semanas de campanha | Chegar em organizadores que não conhecem o Gabriel | Todo mundo | Ver metas em `10-metricas.md` |

## Achado importante: o teste fechado do Google Play

Contas **pessoais** do Play Console criadas depois de 13/11/2023 só ganham acesso à produção depois de um **teste fechado com pelo menos 12 testadores inscritos por 14 dias seguidos**; depois é preciso pedir o acesso, e a análise costuma levar até 7 dias ([fonte](https://support.google.com/googleplay/android-developer/answer/14151465)). Conta de organização (com CNPJ) não tem essa exigência.

O que isso muda no plano:

1. **O piloto deve rodar na faixa de teste fechado**, não na de teste interno (o teste interno não conta para os 14 dias). Ajuste para a E5.4.
2. **Pelo menos 12 pessoas com Android** precisam entrar no teste e continuar nele. Com 3 a 5 grupos dá com folga, se organizadores, co-admins, quem marca o placar e alguns jogadores instalarem. Quem só confirma pelo link não conta.
3. **Lista de testadores por Grupo do Google** (cada um entra pelo link do grupo), para o Gabriel não precisar coletar e guardar e-mails em planilha.
4. **Pedir o acesso à produção na 3ª semana do piloto.** Assim a loja abre logo depois do portão.

## Fase 0 · Preparação (não depende de código)

| Semana | O que fazer | Quem |
|---|---|---|
| −4 | Reservar os perfis no Instagram e no TikTok (o mesmo nome nos dois; `produto.md` sugere @sacou e @sacouapp). Busca do nome no INPI (classes 9 e 41). Registrar o domínio | Gabriel |
| −4 | Listar 8 a 10 grupos candidatos (critérios abaixo) | Gabriel |
| −3 | Mandar o convite aos organizadores (texto em `07-conteudo-e-textos.md`). Fechar 3 a 5 grupos e 2 de reserva | Gabriel |
| −2 | Criar o grupo fictício no ambiente de teste. Produzir as 8 capturas e o vídeo 3 (`04` e `05`) | Gabriel, com apoio de agente |
| −2 | Publicar Termos e Política de Privacidade (E6.1), com a seção de exclusão de conta | Tarefa do M6 |
| −1 | Criar o Grupo do Google dos testadores e a faixa de teste fechado. Conversa de 15 minutos com cada organizador e o roteiro da primeira rodada | Gabriel |

### Como recrutar os grupos do piloto

**Critérios (o conjunto deve cobrir todos):**

- Joga toda semana, com dia fixo e 12 pessoas ou mais.
- Organizador animado, com Android, disposto a falar com o Gabriel toda semana.
- Pelo menos um grupo com **gente de fora e "quem perde sai"**.
- Pelo menos um de **areia** (duplas ou quartetos).
- Pelo menos um em **quadra coberta à noite** e um ao **sol**.
- De preferência na cidade do Gabriel, para ele ir à primeira rodada de cada um.

**Onde achar, por ordem:** o próprio racha do Gabriel → rachas de amigos → organizadores indicados pelos primeiros → arenas e quadras onde ele joga (perguntar na recepção quem organiza os rachas fixos) → atléticas de faculdade → páginas locais de vôlei no Instagram.

**O que oferecer:** tudo liberado no piloto, linha direta com quem faz o app, correções toda semana e o nome do grupo entre os primeiros a usar (só com autorização). **Não prometer** preço, desconto ou Pro grátis para sempre (ver decisão 2 no `README.md`).

**Cuidado com dados:** nomes de grupos e contatos de organizadores ficam numa planilha particular do Gabriel, **nunca no repositório**, que é público (ADR 0058).

## Fase 1 · Piloto (M7)

| Semana | Produto | Marketing e relacionamento |
|---|---|---|
| P1 | Primeira rodada de cada grupo. Gabriel presente na quadra | Organizador manda o link no grupo (texto pronto). Anotar tudo que travou |
| P2 | Correções da semana (E7.3) | Pedir autorização de imagem a quem topar aparecer. Gravar os vídeos 2 e 4 num racha |
| P3 | Correções. Conferir os 12 testadores há 14 dias e **pedir o acesso à produção** | Perguntar a cada organizador: "quem mais organiza racha e toparia testar?" (lista de espera do lançamento suave) |
| P4 | Medir o portão (E7.2) | Pedir depoimento curto por escrito, com autorização de uso. Montar a ficha final da loja |
| P5 (folga) | Corrigir o que o portão mostrou | Preparar os posts das semanas 1 e 2 |

**O que medir no piloto:** ver `10-metricas.md`. O número que decide é a parcela de confirmações feitas pelo próprio jogador no link.

**Rotina semanal (30 minutos):** segunda, ler os números da E7.2; terça, mensagem a cada organizador ("o que atrapalhou ontem?"); sexta, avisar o que foi corrigido.

**Se o portão não bater:** não abrir a loja. Descobrir por que os jogadores não usam o link (não viram, não entenderam, login atrapalhou) e mudar o texto do convite ou o fluxo antes de qualquer divulgação.

## Fase 2 · Lançamento suave

| Semana | O que fazer |
|---|---|
| S1 | Publicar em produção, só Brasil. Avisar **apenas** os grupos do piloto e os organizadores indicados (mensagem pronta). Perfis das redes no ar com 3 posts fixados |
| S2 | Pedir avaliação na loja a quem já jogou 2 rodadas ou mais (texto pronto, sem oferecer nada em troca). Responder toda avaliação em até 2 dias |
| S3 | Primeira arena parceira com cartaz na recepção (`08-venda-e-parcerias.md`). Revisar a descrição curta com os termos de busca reais do Console |

Sem anúncio pago nesta fase: primeiro confirmar que gente que **não** conhece o Gabriel consegue criar um grupo sozinha.

## Fase 3 · Lançamento público (4 semanas)

Calendário dia a dia e textos em `07-conteudo-e-textos.md`. Resumo:

| Semana | Tema | Ação principal |
|---|---|---|
| L1 | "O app do racha de vôlei chegou" | Vídeo 1, carrossel das capturas, mensagem nos grupos de vôlei (com permissão do admin) |
| L2 | "Quem perde sai, sem discussão" | Vídeo 2, visita a 2 ou 3 arenas, embaixadores postam |
| L3 | "Sorteio sem panelinha" | Vídeo 4, depoimento de organizador do piloto, areia |
| L4 | "Sua cartinha" | Jogadores postam a cartinha, balanço do mês, decidir se vale impulsionar |

## Canais

| Canal | Como usar | Custo | Fase |
|---|---|---|---|
| **Grupos de WhatsApp de racha** | O organizador manda o link da rodada. É o canal principal: cada rodada apresenta o Sacou a 12 ou mais pessoas | R$ 0 | 1 em diante |
| **Organizadores embaixadores** | Os do piloto indicam outros organizadores e postam o racha | R$ 0 | 2 e 3 |
| **Indicação entre jogadores** | Quem joga em dois grupos leva para o outro. A cartinha e o resumo compartilhados levam o nome Sacou | R$ 0 | 1 em diante |
| **Instagram (Reels) e TikTok** | 3 vídeos curtos por semana, o mesmo nos dois. Marcar a cidade e a quadra (com permissão) | R$ 0 | 2 e 3 |
| **Comunidades de vôlei** | Grupos de Facebook e de WhatsApp da cidade, páginas locais de vôlei amador. **Sempre pedir ao admin antes de postar** | R$ 0 | 3 |
| **Arenas e quadras** | Cartaz com QR na recepção, conversa com quem aluga horário fixo | R$ 0 a R$ 60 (impressão) | 2 e 3 |
| **Busca na loja** | Ficha bem escrita (`02`), capturas (`04`), responder avaliações | R$ 0 | 2 em diante |
| **Impulsionamento** | Só o melhor vídeo, só na cidade, só depois da semana L4 | A partir de R$ 50 (`09-orcamento.md`) | 3, se o Gabriel decidir |

### Indicação, sem recurso novo no app

O app não tem programa de indicação, e não precisa para lançar:

1. **Pedido direto:** ao fim da 2ª rodada, o Gabriel pergunta ao organizador quem mais organiza racha.
2. **Link da loja com origem marcada** para cada embaixador (ver `10-metricas.md`), para saber quem trouxe instalações.
3. **Reconhecimento, não dinheiro:** post agradecendo o grupo (com autorização) e acesso antecipado às novidades. Recompensa com valor (meses de Pro, brinde) é decisão do Gabriel.
