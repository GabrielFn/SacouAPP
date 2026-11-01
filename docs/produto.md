# Sacou — Produto do app de racha de vôlei

2026-10-30 · @Gabriel

## Resumo executivo

O Sacou é o app do racha de vôlei amador: lista de presença, sorteio equilibrado e fila de "quem perde sai" integrada ao placar, sem bagunça no WhatsApp. Não existe hoje nenhum app brasileiro focado em vôlei; todos os concorrentes nacionais são de futebol e tratam vôlei como "outro esporte".

- **Diferencial nº 1:** a tela de quadra (placar + fila de times + rotação) em um só lugar. Nenhum concorrente junta a fila ao placar.
- **Diferencial nº 2:** rotação com sistema selecionável (Livre, 6x0, 4x2, 5x1, 6x2), que hoje só existe em apps de técnico, em inglês e pagos em dólar.
- **Princípio:** tudo é opcional e configurável (cobrança, vagas, sets, pontos), com modelos prontos que escondem a complexidade.
- **Quem paga:** só o organizador. O jogador usa grátis, confirmando presença por link, sem instalar o app (login uma vez na própria página).

Este documento junta a pesquisa de concorrentes e a proposta de UX/UI, já revisadas uma contra a outra.

## Mercado e concorrentes

O concorrente real é a lista colada no WhatsApp, não outro app. Os apps de racha no Brasil são de futebol; no vôlei só há apps de técnico ou de súmula, com usabilidade fraca.

| App | Foco | Preço | Lição para o Sacou |
|---|---|---|---|
| [Chega+](https://mwm.ai/pt/apps/chega/1084859198) | Futebol, BR | ~R$ 100/mês no Premium | Líder, mas criticado pelo preço, por não ter 2º admin e por bugs |
| [Pelada+](https://apps.apple.com/BR/app/id1637292238) | Futebol, BR | R$ 6,90–19,90 | Máximo de 2 admins, atributos rasos, bugs a cada versão |
| [Appito](https://apps.apple.com/BR/app/id1054372715) | Futebol, BR | Grátis | Mapa de quadras falha sem densidade; recorrência exige reconfirmar todos |
| [PeladaBot](https://mwm.ai/apps/peladabot/6741855212) | Multi, BR | Assinatura | Funciona dentro do WhatsApp ("DENTRO/FORA"); único que cita vôlei |
| [Volleyball Rotations](https://apps.apple.com/us/app/volleyball-rotations/id1440107449) | Vôlei, técnicos | US$ 6,99/mês | Rotação tem valor, mas o público é técnico, não pelada |
| [VolleyStation Score](https://apps.apple.com/app/id1614399577) | Vôlei, súmula | — | Nota 2,6: placar no celular falha por usabilidade; corrigir erro estressa |
| [Volleyball Lineup Tracker](https://apps.apple.com/app/id420162043) | Vôlei, rotação | US$ 5,99 | Gestos escondidos são criticados |
| [Next Up](https://apps.apple.com/us/app/-/id6443439799) | Pickup, global | Grátis | Funcionar offline e sem conta é valorizado na quadra |
| [OpenSports](https://mwm.ai/apps/opensports-meetup-for-sports/1056940981) | Pickup, global | Taxa | Melhor modelo de presença + espera + pagamento, sem Pix |

**Lacunas que ninguém cobre:**

1. App brasileiro feito para vôlei.
2. Fila "quem perde sai" integrada ao placar.
3. Rotação para pelada, em português.
4. Pix nativo na confirmação de presença.
5. Multi-admin grátis.
6. Areia no formato "rei da quadra".

**Paridade (o mínimo esperado):** convite por link, presença com limite e espera, mensalista x avulso, sorteio por nível e posição, controle de pagamento, push, mais de um admin, ranking simples.

## Princípios e posicionamento

**Posicionamento:** "Feito pra vôlei: lista, sorteio e fila de quem perde sai, sem bagunça no WhatsApp." Não competir com Chega+ e PeladaPRO no futebol.

1. **A quadra é o produto.** Prioridade: tela de quadra > presença > sorteio > cobrança.
2. **Trabalhar junto com o WhatsApp, não contra ele.** A lista sempre sai em texto pronto para colar, e o admin lança quem respondeu "eu" no grupo.
3. **Jogador entra sem instalar.** Confirma presença numa página web; o app vem depois, como ganho.
4. **Tudo opcional, com padrões fortes.** Função desligada some da tela. Modelos prontos escondem a complexidade.
5. **Configuração aparece quando faz falta**, não numa tela gigante de ajustes.
6. **Nada de gesto escondido.** Toda ação é um botão com texto; o toque longo só protege contra erro, sempre com o rótulo "Segure para…".
7. **Tudo vira conteúdo compartilhável.** Lista, sorteio, placar e resumo saem prontos para WhatsApp e Instagram.
8. **Menos escopo, menos bug.** Avaliação ruim vem de bug, não de falta de recurso.

## Funcionalidades

O núcleo é grátis e cobre presença, sorteio, fila, placar e Pix. A configuração herda em níveis, e a rotação tem sistema selecionável.

### Núcleo

1. **Grupos:** convite por link e QR; papéis Admin, Co-admin e Placar (opera a quadra sem outros poderes); multi-admin grátis e sem limite.
2. **Jogadores:** apelido, posição principal e secundárias, nível 1–5 autodeclarado; tipo mensalista ou avulso.
3. **Rodadas:** presença VOU / NÃO VOU (sem "talvez"); lista de espera com promoção automática; mensalista já entra confirmado e só avisa se não for; lista de avulsos abre X horas antes; recorrência automática sem reconfirmar todo mundo; admin adiciona convidado sem conta.
4. **Cobrança Pix (opcional):** Pix copia e cola gerado a partir da chave do organizador (QR opcional) na própria confirmação; serve só para a diária e a mensalidade do racha, nunca para o Pro; "Já paguei" com confirmação do admin, exibida como "pago (marcado por Fulano)"; lembrete neutro, nunca lista pública de devedores.
5. **Sorteio:** equilibra nível e posição, evita repetir times; medidor de equilíbrio; trocar e travar duplas; imagem dos times para compartilhar.
6. **Rating ****(Glicko-2, separado por modalidade: quadra e areia)****:** ajustado pelos resultados (conversão para a nota: 1500 = 3,0 e cada 100 pontos valem 0,5, limitado entre 1 e 5; o nível autodeclarado no cadastro é o ponto de partida; os números são ajustados com os dados do piloto), privado no app (o jogador vê só o próprio); na cartinha compartilhável aparece por padrão, e o jogador pode esconder. A borda da cartinha indica a faixa: Bronze até 2,4; Prata de 2,5 a 3,4; Ouro de 3,5 a 4,4; Elite a partir de 4,5. A cartinha usa a foto do jogador com o fundo removido, recortada na silhueta: o recorte é automático no próprio celular (Vision no iOS, ML Kit Subject Segmentation no Android, via módulo nativo do Expo), com pincel para apagar ou restaurar bordas e enquadramento por arrastar e pinça. Se o aparelho não suportar, o recorte é feito no servidor com um modelo de segmentação em ONNX Runtime no .NET. A imagem final é salva em PNG ou WebP com transparência.
7. **Fila de times:** quem perde sai ou vencedor sai após X vitórias; contador de sequência; próximo time entra automaticamente ao fim da partida. Quando há menos gente esperando do que um time completo, a saída é parcial: só sai do time perdedor o número de pessoas que está esperando (ex.: 2 substitutos → saem 2). Quem sai é definido por critério configurável — quem está há mais partidas seguidas (padrão), ordem de chegada, sorteio, equilíbrio de nível ou escolha manual. Quem entra assume a posição de quem saiu; com rotação ligada, entra no lugar dela na escalação. Se ninguém está esperando, ninguém sai. Quem sai entra no fim da fila como avulso; quando os avulsos somam um time, ele se forma por ordem de chegada. Modos da fila: automático (time inteiro quando há time completo esperando, parcial quando não há), sempre parcial com N fixo, ou sempre time inteiro.
8. **Placar:** pontos por set, número de sets, tie-break e vantagem configuráveis; desfazer ilimitado; fim de set sempre confirmado.
9. **Resumo da rodada com IA:** placares, sequências, MVP do dia calculado pelos dados por padrão (saldo de pontos +/− enquanto em quadra, aproveitamento de vitórias, maior sequência e ganho de rating); votação rápida como opção do grupo; ponto individual ("De quem?" ao marcar, para aces e bloqueios) como opção do grupo no Sacou Pro; formatos texto, feed e story.
10. **Offline na quadra:** placar, fila e rotação funcionam sem internet e sincronizam depois.

### Configuração flexível

Tudo pode ser desligado: cobrança, limite de vagas, número de sets (livre, único, md3, md5), pontos por set, tie-break, placar, rotação, fila, sorteio e presença.

| Nível | O que ajusta | Onde fica |
|---|---|---|
| Grupo | Todos os padrões | Ajustes → "Como jogamos", em blocos com interruptor mestre |
| Rodada | Qualquer padrão, só naquele dia | Acordeão "Personalizar esta rodada" |
| Partida | Pontos, sets e sistema de rotação | Folha de pré-jogo |

- O mais específico vence. Valor herdado aparece em cinza ("padrão do grupo"); valor sobrescrito ganha ponto laranja ("nesta rodada") e link "Voltar ao padrão".
- Modelos prontos: Pelada descontraída, Racha organizado, Treino, Areia rei da quadra e Do zero (tudo desligado). O grupo salva os próprios modelos: 1 no plano grátis, ilimitados no Pro.
- Sugestões ligam funções dormentes no momento certo, por exemplo: "18 pessoas pediram 12 vagas. Ligar lista de espera?"

### Rotação

1. **Sistemas selecionáveis** por time: Livre, 6x0, 4x2, 5x1 e 6x2. O padrão vem do modelo: Livre na Pelada e na Areia, 6x0 no Racha organizado, 5x1 no Treino. Os três últimos são do Sacou Pro, com o rótulo "Avançado" e um mini-tutorial na primeira vez.
2. **Pergunta só os papéis necessários:** 5x1 pede 1 levantador; 4x2 e 6x2 pedem 2 e o app os coloca opostos sozinho.
3. **Escalação auto-preenchida** pelas posições declaradas; ajuste tocando em dois jogadores para trocar (sem arrastar).
4. **Rotação automática no side-out**** e posições reais no momento do saque. Duas camadas: a ordem de rotação oficial (1–6), que define o sacador, quando gira e a regra de sobreposição; e a posição física de cada jogador no saque, que depende do sistema, da rotação e de o time estar sacando ou em recepção (ex.: no 5x1, levantador escondido para infiltrar). ****Regras e formações detalhadas em `docs/dominio/rotacoes.md` (pesquisa de 30/10/2026). Modo de regra configurável: FIVB 2025–28 (padrão; só o time que recebe precisa respeitar a sobreposição) ou Clássico (os dois times). A rotação é identificada internamente pela posição do levantador (setterZone). ****Cada time tem a própria rotação, independente: sistema, escalação, levantador, rotação atual e regra do banco são por time. ****A tela de quadra mostra só a posição no saque, não a troca depois dele. Cada sistema traz modelos de formação prontos; no Pro, o grupo ajusta as formações com validação de sobreposição**
5. **Rodízio do banco:** "Sai quem saca" (padrão) e "Manual" no início; por pontos, por set e por tempo depois.
6. **Líbero e limite de substituições:** em "Avançado", desligados por padrão.
7. Violações viram aviso ("Levantadores não estão opostos — Corrigir?"), nunca bloqueio.

### Areia rei da quadra

Em 2x2 e 4x4, a fila é de duplas ou quartetos e a regra padrão é "vencedor fica", com vitórias do dia por dupla e ranking no resumo.

## UX: navegação, fluxos e tela de quadra

Três abas para todos, entrada sem instalar e uma tela de quadra em tela cheia, pensada para sol, mão suada e celular passando de mão em mão.

### Navegação

1. **Início:** próxima rodada de cada grupo com o status (Vou, Na espera, Pagar) e banner "AO VIVO — Abrir quadra".
2. **Grupo:** lista de grupos → Rodadas, Membros, Ranking (por vitórias, saldo e MVPs, nunca por nível) e Ajustes (só admin).
3. **Eu:** perfil, histórico, pagamentos e nível privado.

Uma aba "Explorar" (Falta 1, mapa) só entra quando houver densidade de usuários por cidade.

### Fluxos principais

1. **Entrada por link:** prévia rica no WhatsApp ("Vôlei de quinta · 9/12 confirmados") → página web → VOU → login com Google, Apple (no iPhone) ou e-mail e senha, sem confirmar telefone → nível e posição opcionais → Pix. Meta: menos de 45 s.
2. **Criar grupo (menos de 60 s** até o grupo criado, 90 s até o 1º convite): escolher modelo → modalidade, mensalistas fixos, cobra? (com chave Pix), quando e onde → compartilhar no WhatsApp.
3. **Criar rodada:** formulário pré-preenchido com o padrão, chips com o resumo herdado, recorrência ligada quando há dia fixo.
4. **Confirmar presença:** VOU / NÃO VOU; ao desistir, aviso de quem entra no lugar.
5. **Sorteio:** times coloridos com medidor de equilíbrio → trocar, travar ou refazer → imagem para o grupo.
6. **Jogo:** folha de pré-jogo → modo quadra → fim de partida com "Laranja venceu 25–21 · Sai Azul · Entra Verde" → próxima partida já montada.
7. **Entregar placar:** QR na tela do admin; quem escaneia ganha uma sessão temporária de Placar, só daquela partida, sem conta e sem outros poderes; precisa ter o app instalado. Um celular escreve por vez e o admin pode retomar.
8. **Fim de rodada:** resumo da IA, três formatos para compartilhar, resumo financeiro para o admin e "Crie seu grupo" para quem não é admin.

### Tela de quadra

| Zona (retrato) | Altura | Conteúdo |
|---|---|---|
| Barra de status | 6% | Set, sets ganhos, trava, offline, menu |
| Time A | 34% | Placar gigante, bola de saque, minirrotação 3x2 |
| Faixa central | 10% | DESFAZER (largura total), sacador, botão Corrigir |
| Time B | 34% | Igual ao Time A |
| Fila | 16–18% | Próximo time, regra e sequência, "Entra no saque: Ana" |

1. **A zona inteira do time é o botão de ponto**, não um "+1". Números com pelo menos 45% da altura da zona, legíveis a 5 m.
2. **Tema Sol:** preto puro sobre branco puro de dia; tema Noite em quadra coberta. Contraste mínimo 7:1. Cor nunca é o único sinal (nome e letra A/B também).
3. **Proteção contra erro:** trava ligada por padrão, bloqueio de 700 ms após cada ponto, toques com a palma ignorados, toast "+1 Laranja (22–19)".
4. **Corrigir sem estresse:** linha do tempo dos últimos 10 pontos; um toque volta àquele estado; trocar sacador e girar time a 1 toque; cada correção mostra o que mudou.
5. **Feedback:** vibração no ponto, no side-out, no set point e no fim de set; bipe opcional.
6. **Tela sempre ligada** durante o modo quadra; aviso de bateria abaixo de 20% sugerindo entregar o placar.
7. **Paisagem** quando o celular está apoiado: Time A à esquerda e B à direita, com "Inverter lados".

## Identidade visual e nome

Nome escolhido: **Sacou**. Na loja, "Sacou: Vôlei, Pelada e Placar" para ganhar busca. A identidade foge do verde-gramado dos apps de futebol e vem da quadra e da areia.

**Tom:** parceiro de quadra, zoeiro e competente ("Lista fechou, 12 de 12. Bora!").

| Token | Uso | Hex |
|---|---|---|
| Areia | Fundo do app | #F6F1E7 |
| Noite de quadra | Texto e fundo escuro | #0F1B2D |
| Laranja Saque | Marca, botões, sobrescrita | #FF5A1F |
| Amarelo Bola | Destaque, sacador | #FFC83D |
| Azul Rede | Secundário, links | #1F5BFF |

- **Tipografia:** Barlow Condensed para placar e títulos (algarismos tabulares); Inter para a interface, de 15 a 17 pt.
- **Motivos gráficos:** linhas de quadra nos cantos dos cards, malha diagonal da rede, a grade 3x2 da rotação como ícone.
- **Cores de time:** laranja, azul, verde, roxo, rosa e cinza.

**Nomes avaliados:**

1. **Sacou** — duplo sentido (saque e "entendeu?"), curto, sem app homônimo encontrado nas lojas. Escolhido em 30/10/2026.
2. **Levanta** — sem conflito encontrado, mas soa como app de academia ou despertador.
3. **Rei da Quadra** — conversa com a areia, mas soa menos como app.
4. **Rodízio** — descartado: a busca é dominada por churrascaria e já existe ferramenta grátis de rodízio no [visu.network](https://visu.network/br/ferramentas/rodizio-volei/).

Antes de fechar: consultar o INPI (classes 9 e 41), registrar sacou.app e sacou.com.br e reservar @sacou e @sacouapp no Instagram e no TikTok. A disponibilidade de domínio não pôde ser verificada nesta pesquisa.

## Roadmap em fases

A Fase 1 leva o diferencial inteiro ao piloto: quadra com fila e saída parcial, rotação por time com posições no saque e a cartinha com foto recortada. São as 16 telas desenhadas mais 12 que faltam (ver a revisão do MVP).

*[Diagrama: roadmap · 3 fases, 1 portão (revisado em 30/10) — diagrama não incluído; vale o texto da seção]*

No piloto o Pro fica liberado de graça para os grupos testarem o 5x1. O que exige cobrança pelas lojas ou densidade de usuários fica para as fases seguintes.

## Monetização e crescimento

O jogador nunca paga. O organizador assina o Sacou Pro por grupo, por R$ 9,90 por mês ou R$ 79 por ano, e o núcleo nunca fica atrás do paywall.

| Plano | Inclui | Preço |
|---|---|---|
| Grátis | Presença, espera, mensalistas, sorteio, fila, placar, rotação Livre/6x0, Pix copia e cola, multi-admin, 2 resumos de IA por mês | R$ 0 |
| Sacou Pro (por grupo) | Sistemas de rotação 4x2, 5x1 e 6x2, ponto individual no placar, resumo de IA ilimitado, histórico completo além da temporada atual, ajuste de formações, modelos salvos ilimitados, imagens sem marca d'água | R$ 9,90/mês ou R$ 79/ano |
| Taxa Pix (futuro) | Baixa automática do pagamento via gateway | R$ 0,50–1,00 por cobrança |

**Revisão de 30/10/2026: dois planos pagos.** O jogador também terá um plano próprio. Preços propostos, a confirmar:

| Plano | Quem paga | Preço proposto | O que entrega |
|---|---|---|---|
| Sacou Pro do Grupo | Admin (pode ratear na mensalidade) | R$ 12,90/mês ou R$ 99/ano | Sistemas 4x2/5x1/6x2, ajuste de formações, modelos ilimitados, relatório financeiro; para todos os membros: ponto individual, resumo com IA de todas as rodadas, ranking da temporada com troféus, cartinhas e stories sem marca, histórico do grupo |
| Sacou+ do Jogador | Cada jogador | R$ 5,90/mês ou R$ 44,90/ano | Cartinha premium (edições especiais, molduras animadas, vídeo, várias fotos), evolução do nível, histórico de todos os grupos, parcerias ("você vence 71% com a Bia"), rendimento por rotação, resumo pessoal com IA e retrospectiva do mês e do ano, comparar com amigos (com consentimento) |

Regra dos dois planos: nada pago dá vantagem em quadra (sorteio, vagas, fila e rating são iguais para todos). Arquitetura: o controle de acesso passa a ser por grupo (`IGroupPlan`) e por pessoa (`IUserPlan`), ambos via RevenueCat.

- Exibir o Pro como "≈ R$ 1 por jogador por mês", para o admin dividir com o grupo.
- O convite ao Pro aparece no fim de uma rodada bem-sucedida, nunca no onboarding.
- Sem anúncio na tela de quadra.
- A taxa Pix exige CNPJ e gateway ([Asaas cobra R$ 1,99 por Pix recebido](https://asaas.com/precos-e-taxas)); no MVP, o Pix copia e cola usa a chave do próprio organizador. O Pro é vendido como assinatura pelas lojas (App Store e Google Play, via RevenueCat), ligada ao grupo; no piloto, o Pro fica liberado de graça.

**Motores de crescimento embutidos:**

1. Cada link de rodada expõe o app a 12–20 pessoas.
2. Imagens de sorteio e de placar final para o grupo.
3. Story do resumo e do MVP, com marca discreta.
4. "Crie seu grupo" no fim do resumo: todo jogador joga em 2 ou 3 grupos.
5. Quem recebe o placar descobre o app e tende a organizar a própria pelada.
6. QR do grupo na quadra para quem chega.

## Riscos, testes e validação

A Fase 2 só começa quando 5 grupos reais usarem o app por 4 rodadas seguidas, com pelo menos 60% dos confirmados vindo pelo link, e não pela lista do WhatsApp.

| Risco | Mitigação |
|---|---|
| Adoção pela metade (parte do grupo só no WhatsApp) | Admin lança nomes em 2 toques; texto do WhatsApp continua sendo a lista visível |
| Bugs a cada versão (o que derrubou Chega+ e Pelada+) | Escopo pequeno e testes automatizados da lógica de fila e de cada sistema de rotação |
| Excesso de configuração | Modelos, funções dormentes, no máximo 5 itens visíveis por bloco |
| Rotação errada desacredita o app | Livre como padrão, Corrigir visível, testes extensos |
| Conflito social com o nível | Nível autodeclarado e rating privado |
| Constrangimento ao cobrar | Cobrança opcional, lembrete neutro, sem lista pública de devedores |
| Tela ilegível ao sol e bateria | Tema Sol, aviso de bateria, entregar placar |
| Rejeição nas lojas (exclusão de conta, denúncia de foto, privacidade) | Exclusão de conta no app, denúncia e remoção de foto, termos e política de privacidade desde a Fase 1 |
| Jogador que não quer criar conta | Admin adiciona como convidado sem conta |
| Recursos de rede sem densidade (Falta 1, mapa) | Fora do roadmap até haver densidade por cidade |

**Testes com usuários reais:**

1. Do clique no link à confirmação, com 5 pessoas que nunca viram o app: menos de 45 s, sem ajuda.
2. Criação de grupo por 5 organizadores reais: menos de 90 s até o primeiro convite.
3. Rodada inteira na areia, de dia, com o celular passando por 3 ou 4 pessoas: toques errados por set, uso do desfazer, legibilidade a 3 m e 5 m.
4. Rodada inteira em modo avião, depois sincronizar sem perder nada.
5. Corrigir um erro de 3 rallies atrás: menos de 10 s.
6. 5x1 e 4x2 com um racha organizado: 3 sets sem correção manual.
7. Herança de configuração: pelo menos 4 de 5 acertam quantos pontos vale a rodada com sobrescrita.
8. Mensalista na 2ª semana: alguém ficou em dúvida se já estava confirmado?

## Arquitetura do back-end

Monólito modular em ASP.NET Core (.NET 10), com DDD enxuto: agregados só onde há regra de verdade, funções organizadas em fatias verticais e os princípios de Clean Code em todo o código. Decidido em 30/10/2026.

### Stack

| Camada | Escolha |
|---|---|
| API | ASP.NET Core .NET 10, Minimal APIs |
| Banco | PostgreSQL (Neon) + EF Core/Npgsql |
| Tempo real | SignalR (placar ao vivo) |
| Jobs | Hangfire (rodadas recorrentes, lembretes, outbox) |
| Login | Firebase Auth: Google, Apple e e-mail com senha; a API valida o token com FirebaseAdmin |
| Página da rodada | Razor Pages no mesmo projeto, com meta tags para a prévia no WhatsApp |
| Push | Expo Push Service |
| Hospedagem | Railway, plano Hobby |

### Módulos

| Módulo | Responsabilidade | Modelo |
|---|---|---|
| Identity | Usuário, perfil, posições, nível | CRUD |
| Groups | Membros, papéis, mensalistas, configuração padrão, plano | Agregado Group |
| Sessions | Presença, vagas, lista de espera, sorteio | Agregado Session |
| Matches | Placar, fila, rotação, banco | Stream CourtSession (quadra da rodada) com event sourcing; partidas, fila e saída parcial dentro dele |
| Payments | Pix copia e cola, "já paguei", confirmação | CRUD |
| Summaries | Resumo da rodada com IA (com cota por grupo); estatísticas, MVP e rating Glicko-2 ficam num módulo Stats com projeções recalculáveis | Serviço |

Cada módulo tem o próprio schema no Postgres e nunca lê tabelas de outro; a comunicação é pela interface pública do módulo ou por eventos.

### DDD

1. **Linguagem do negócio no código, em inglês:** cada termo do vôlei tem um nome fixo no código (glossário abaixo). A interface do app continua em português.
2. **Agregados protegem as regras:** a Session garante o limite de vagas e promove o primeiro da espera; o Match garante que a rotação só gira no side-out.
3. **Value objects para conceitos com regra:** Score, RotationSlot (1–6), SkillLevel (1–5), GameSettings. Nada de int solto representando conceito de domínio.
4. **Eventos de domínio:** PlayerPromotedFromWaitlist, TeamsDrawn, MatchEnded.
5. **Event sourcing só n**a quadra da rodada (CourtSession): um stream por quadra contém as partidas, a fila e as saídas parciais, porque esse estado atravessa partidas. Os eventos gravam o resultado das regras (quem saiu, quem entrou, nova posição), têm versão e trazem cópia congelada das configurações e formações. Nenhum dado pessoal nos eventos, só IDs (MemberId). O estado é recalculado a partir dos eventos. Isso torna Desfazer e Corrigir simples e permite o modo offline.
6. **O domínio não conhece infraestrutura:** nenhuma referência a EF Core, HTTP ou Firebase dentro de `Domain/`.

**Glossário (português → código):**

| Termo no app | Nome no código |
|---|---|
| Grupo | Group |
| Rodada | Session |
| Partida | Match |
| Set | Set |
| Presença | Attendance |
| Lista de espera | Waitlist |
| Mensalista / avulso | Regular / DropIn |
| Fila de times | TeamQueue |
| Sorteio | TeamDraw |
| Placar | Score |
| Rotação / sistema de rotação | Rotation / RotationSystem |
| Sacador | ServingPlayer |
| Side-out | SideOut |
| Banco | Bench |
| Levantador / líbero | Setter / Libero |
| Posição na quadra (1–6) | RotationSlot |
| Função do jogador | PlayerRole |
| Nível | SkillLevel |
| Resumo da rodada | SessionSummary |

Termos acrescentados na revisão: Quadra da rodada → CourtSession, Cartinha → PlayerCard, Formação → Formation, Posição no saque → ServeAlignment, Rotação atual → RotationIndex, Saída parcial → PartialExit, Membro do grupo → GroupMember (MemberId).

### Padrões

1. **Vertical Slice:** cada funcionalidade é uma pasta com endpoint, request, handler, validação e testes (ex.: `Sessions/ConfirmAttendance/`).
2. **Strategy** para tudo que é selecionável: `IRotationSystem`, `IQueueExitCriterion`, `IBenchRule`, `ITeamBalancer`.
3. **SettingsResolver:** mescla grupo → rodada → partida; cada nível é um record com campos anuláveis (null herda), guardado em `jsonb`.
4. **Outbox:** eventos gravados na mesma transação e enviados pelo Hangfire (push, e-mail).
5. **Idempotência:** eventos da partida chegam com ID gerado no celular; reenviar não duplica.
6. **Concorrência otimista:** a disputa pela última vaga usa `xmin` como versão.
7. **Result pattern:** erros de regra voltam como resultado e viram `ProblemDetails`, sem exceção.
8. **Autorização por recurso:** policies verificam o papel no grupo (Admin, CoAdmin, Scorekeeper).
9. **Entitlements:** `IGroupPlan` concentra o que é Pro (ex.: sistemas 4x2, 5x1, 6x2).
10. **CQRS leve:** comandos passam pelo domínio; leituras usam projeções com `AsNoTracking`.
11. **Testes golden compartilhados:** JSONs com eventos e estado esperado, rodados pelos testes em C# e em TypeScript, para a lógica do app e do servidor nunca divergir.

### Clean Code

1. **Nomes que explicam a intenção:** `Promo`teFirstFromWaitlist(), não Process`()`. Sem abreviações nem prefixos.
2. **Funções pequenas, uma responsabilidade:** se precisa de "e" para descrever, divide.
3. **Cláusulas de guarda** no início do método em vez de `if` aninhado.
4. **Sem números mágicos:** constantes nomeadas ou value objects (`Po``intsPerSet.Default`).
5. **Imutabilidade por padrão:** records, `init`, coleções somente leitura expostas pelo agregado.
6. **Comentário explica o porquê, nunca o quê;** o código deve se explicar sozinho.
7. **SOLID:** Strategy cobre aberto/fechado; injeção de dependência em vez de estado estático.
8. **Nullable reference types ligado** e avisos tratados como erro.
9. **Padrão de formatação e análise:** `.editorconfig`, analisadores do .NET e `dotnet format` no CI.
10. **Testes legíveis:** Arrange-Act-Assert, nome descrevendo o comportamento (`Withdrawal_PromotesFirstFromWaitlist`), testes de integração com Testcontainers e Postgres real.

### Bibliotecas

- **Usar:** EF Core + Npgsql, FluentValidation, Hangfire, FirebaseAdmin, Testcontainers.
- **Evitar:** MediatR e AutoMapper, que passaram a ter licença comercial em 2025; handlers injetados diretamente e mapeamento manual resolvem.

### Estrutura de pastas

```
src/
  Sacou.Api/              → Program.cs, configuração, Razor Pages da rodada
  Sacou.Modules/
    Sessions/
      Domain/             → Session, Attendance, Waitlist, regras
      ConfirmAttendance/  → Endpoint, Handler, Validator
      CreateSession/
    Matches/
      Domain/             → eventos, estado, estratégias de rotação e fila
      SyncEvents/
  Sacou.Shared/           → Result, Outbox, SettingsResolver, Entitlements
tests/
  golden/                 → JSONs compartilhados com o app
```

## Ajustes de arquitetura da revisão

Decididos em 30/10/2026, antes do primeiro commit.

1. **Placar sem conta:** o QR troca um código de uso único por um token da própria API, válido só para aquele stream; um celular escreve por vez e o admin pode retomar.
2. **Rotação:** `TeamState` por time; `RotationSlot` (1–6) separado de `CourtPoint` (x, y); formações como dados JSON num pacote compartilhado (`volley-rules`); `OverlapValidator` com a regra oficial.
3. **Fila:** mistura times e jogadores avulsos; avulsos que saíram formam time por ordem de chegada.
4. **Convidado vira conta:** tudo aponta para `MemberId`; reivindicação por link e merge de membros.
5. **Cartinha:** recorte no celular na Fase 1; fotos em Cloudflare R2 (só o recorte em WebP, sem EXIF); denúncia de foto.
6. **Stack acrescentada:** Cloudflare R2, RevenueCat (Pro), Sentry e logs estruturados, PostHog, e-mail transacional (Resend), limite de requisições, feature flags com versão mínima do app, backup diário, monorepo com `packages/match-engine` e `packages/volley-rules`.
7. **Custo:** aumentar o intervalo de consulta do Hangfire para o Neon grátis poder dormir, ou mover o banco para o Railway.

## Arquitetura do app

Expo + TypeScript strict, Expo Router, EAS (Build, Submit, Update), TanStack Query, Zustand, React Hook Form + Zod, cliente gerado do OpenAPI, SignalR, Firebase Auth, expo-sqlite para o log de eventos, keep-awake, haptics, screen-orientation, Reanimated e view-shot. Módulo nativo próprio para o recorte da foto (Vision no iOS, ML Kit no Android). Decidido em 30/10/2026: Unistyles para estilos e temas, e monorepo único com app, API e os pacotes match-engine e volley-rules.

## Privacidade e LGPD

1. Exclusão de conta dentro do app (exigência das lojas): apaga perfil, foto e usuário no Firebase; o histórico fica como "Ex-jogador".
2. Exportar os dados da pessoa, termos e política de privacidade, canal do encarregado de dados.
3. Consentimento para mostrar foto e nível na cartinha; nível privado garantido na API, não só na tela.
4. Denúncia, bloqueio e remoção de foto (diretriz da Apple).
5. Chave Pix criptografada no banco; logs sem e-mails nem tokens.

## Métricas do produto

1. Ativação: grupo com a 1ª rodada jogada em até 7 dias.
2. Retenção: grupos ativos na semana 4.
3. Confirmações vindas pelo link (meta do portão: 60%).
4. Partidas com placar no app.
5. Cartinhas e stories compartilhados por rodada.
6. Grupos criados a partir de "Crie seu grupo".
7. Conversão para o Pro (a partir da Fase 2).

## Decisões tomadas e pendências

Os três pontos em que os agentes divergiram foram decididos em 30/10/2026.

| Decisão | Escolha | Consequência |
|---|---|---|
| Plataforma | App nativo (React Native/Expo) desde a Fase 1 | Vibração, push e tela ligada no iOS desde o início; a página da rodada continua web, para o jogador confirmar sem instalar |
| Sistemas 4x2, 5x1, 6x2 | No Sacou Pro | Livre e 6x0 seguem grátis para todos |
| Preço do Pro | R$ 9,90/mês ou R$ 79/ano | Reajustar com dados depois da tração |

**Ainda em aberto:**

- Registrar o nome Sacou: busca e pedido no INPI (classes 9 e 41), domínios sacou.app e sacou.com.br, perfis @sacou e @sacouapp.
- Back-end decidido em 30/10/2026: monólito modular em ASP.NET Core (.NET 10), PostgreSQL + EF Core, SignalR, Hangfire e Razor Pages para a página da rodada. Hospedagem: API no Railway (plano Hobby, ~US$ 5/mês) e banco no Neon (plano grátis). Login: Google, Apple e e-mail com senha via Firebase Auth, sem confirmação de telefone; a API valida o token.
- Recrutar 3–5 grupos de vôlei para o piloto.

## Fontes

- [Chega+](https://mwm.ai/pt/apps/chega/1084859198) · [Pelada+](https://apps.apple.com/BR/app/id1637292238) · [Appito](https://apps.apple.com/BR/app/id1054372715) · [PeladaBot](https://mwm.ai/apps/peladabot/6741855212)
- [Volleyball Rotations](https://apps.apple.com/us/app/volleyball-rotations/id1440107449) · [Volleyball Lineup Tracker](https://apps.apple.com/app/id420162043) · [VolleyStation Score](https://apps.apple.com/app/id1614399577) · [Next Up](https://apps.apple.com/us/app/-/id6443439799) · [OpenSports](https://mwm.ai/apps/opensports-meetup-for-sports/1056940981)
- [Sorteio de Times](https://apps.apple.com/BR/app/id6476064177) · [Asaas: taxas](https://asaas.com/precos-e-taxas) · [Spond: taxas de pagamento](https://help.spond.com/app/en/articles/118091-payments-costs-in-the-spond-app) · [visu.network: rodízio](https://visu.network/br/ferramentas/rodizio-volei/)
