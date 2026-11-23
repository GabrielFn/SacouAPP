# Sacou · análise de entendimento e fluxo (M5)

Data: 23/11/2026. Base: `roteiro.md` (passos 0 a 45, prints 01 a 128), o diário de 23/11, o fim de `pendencias.md` (R99 e teste do push), `produto.md`, `decisoes.md`, as telas de `design/mvp/` e os arquivos de texto do app (`apps/mobile/src/strings/`) e da web (`WebTexts.cs`, `apps/web/src/strings.pt-BR.ts`).

Limite desta análise: ela foi feita sobre os prints e os textos, sem usar o app. O que não tem print está marcado como "pelo texto" ou "não percorrido".

## 1. Veredito

**O organizador consegue, o jogador ainda não.**

- **Organizador:** chega do cadastro ao resumo com MVP sem ajuda (passos 40 e 41, duas rodadas inteiras em cerca de 15 minutos). Os pontos em que ele se perde são poucos e têm conserto de texto: o próprio nome na lista de presença, o convite escondido em Membros, o "Encerrar rodada" sem confirmação e o aviso "Outro celular está marcando" com o nome dele.
- **Jogador:** o caminho principal do produto (link da rodada no WhatsApp, página web, VOU) **nunca foi percorrido** nas 5 tentativas. Só o convite do grupo foi testado, e ele termina em "Baixe o app para ver as rodadas", sem botão e sem loja. Além disso, o avulso pode encontrar o VOU desligado sem entender o motivo, e o app promete avisos (lista aberta, times sorteados) que o servidor não manda.

Recomendação: antes do piloto, uma 6ª tentativa só com o papel de jogador, começando pelo link da rodada num celular sem o app.

## 2. Os dois fluxos, passo a passo

Marcação: **claro**, **confuso** ou **travado**. "Registrado" quer dizer que o defeito já está no roteiro ou em `pendencias.md`.

### 2.1 Organizador

| # | Passo | Estado | Motivo | Evidência |
|---|---|---|---|---|
| 1 | Abrir o app e criar conta | claro | Dois botões, um caminho. A folha diz "Entrar pra confirmar… confirma qualquer rodada", texto de jogador para quem veio organizar | print 01, passo 2 |
| 2 | Perfil de quadra | claro | "Leva 20 segundos. Ajuda no sorteio." e "é só uma sugestão" explicam o porquê. Rótulos das notas quebram no meio da palavra ("Tô apren-dendo") | print 03 |
| 3 | Início vazio | claro | Diz o que fazer nos dois casos (criar grupo ou abrir o link) | print 05 |
| 4 | Criar grupo: modelo | claro | Cada modelo diz o que liga. "Treino" traz selo Pro, que no piloto não bloqueia nada (achado 10) | print 06 |
| 5 | Criar grupo: dados | confuso | Respondeu "Tem mensalistas fixos? Não" e mesmo assim o grupo nasce com "mensalistas com prioridade · avulsos abrem 24h antes" | prints 07 e 12 |
| 6 | Depois de criar | confuso | Cai em "Seus grupos" com Membros, Como jogamos e Criar rodada. Nada chama para **convidar**, que é o passo seguinte do produto ("compartilhar no WhatsApp") | print 11, `produto.md` fluxo 2 |
| 7 | Como jogamos | confuso | Fila e MVP estão bem explicados. "Regra de sobreposição: FIVB atual / Clássica" e "Livre / 6x0" são jargão; 5x1 aparece bloqueado com "Pro" | prints 12 e 13 |
| 8 | Membros | confuso | Abre na aba "Mensalistas (0)" com "Ninguém aqui ainda", num grupo que tem gente (todos em Avulsos). Parece grupo vazio | prints 16 e 123 |
| 9 | Convidar | claro | Texto, QR, link e "Mandar no WhatsApp" na ordem certa. "O link vale até você desativar." | print 17 |
| 10 | Nova rodada | claro | "Veio com o padrão do grupo. Mude só o que precisar." Chips e ponto laranja funcionam. O Local vem vazio e o horário só aceita "21:00" (registrados) | prints 24 e 25, passos 29 e 41 |
| 11 | Publicar | confuso | "Publicar e compartilhar no WhatsApp" abre a folha de compartilhar do Android. Quem fecha a folha já publicou, sem aviso, e não há como cancelar a rodada | print 37, passos 27 e 29 |
| 12 | Presença | confuso | A tela do admin não tem VOU. Para entrar na lista ele precisa achar "Você · Avulso · Adicionar" dentro de "Adicionar quem confirmou no WhatsApp". No passo 20 a organizadora ficou fora do sorteio | prints 26 e 27 |
| 13 | Sortear | claro | "2 times de 6", "Diferença 0,0 · ótimo", "Toque num nome pra trocar". Com 10 de 12 não avisa que faltam 2 (registrado) | print 110, passo 20 |
| 14 | Preparar a partida | claro | Uma folha, quatro escolhas. "Laranja tem 5: sem rotação" explica o caso | prints 111 e 75 |
| 15 | Marcar pontos | confuso | Nada na tela diz que **tocar no lado do time marca o ponto**. No modo Livre a quadra fica vazia sob o título "Posições no momento do saque". O selo "L" é levantador, mas todo jogador lê líbero | prints 42 e 112 |
| 16 | Fim de set e de partida | claro | "Fim do set 1?" com "Desfazer último ponto" ao lado de "Confirmar fim da partida" | prints 44 e 113 |
| 17 | Encerrar a rodada | confuso | Na tela de fim de partida, "Encerrar rodada" é um link entre dois botões e, pelo roteiro e pelo código, encerra **sem confirmar** (a confirmação só existe com partida em andamento, no Menu) | print 113, passos 24 e 40 |
| 18 | Resumo e MVP | confuso | "MVP do dia · Leo · Calculado pelo placar" aparece como resultado final, com "Votação da galera aberta" logo abaixo. Não se sabe se Leo é o MVP ou o provisório | print 114 |
| 19 | Retomar uma quadra antiga | travado nas tentativas 2 a 4, hoje confuso | Registrado e corrigido (R98). Sobra o texto: "Org Teste está marcando esta quadra" para a própria Org Teste, "há 1467 min" e "Nenhuma partida aberta agora" na mesma folha | print 101, passos 27, 35 e 39 |

### 2.2 Jogador

| # | Passo | Estado | Motivo | Evidência |
|---|---|---|---|---|
| 1 | Recebe o link **da rodada** no WhatsApp | não percorrido | O texto sai como "Grupo · dia · hora · local · vagas. Confirma aqui: link". A página `/r/…` existe no servidor (lista, VOU, NÃO VOU, login na própria página), mas nenhuma tentativa a abriu no celular | passo 29, `Round.cshtml` |
| 2 | Recebe o link **do grupo** | confuso | A página diz só "Convite para um grupo no Sacou" e "Entrar pra ver o convite". Ele precisa criar conta antes de saber qual é o grupo | print 19, passo 11 |
| 3 | Entra no grupo pela web | confuso | Depois do login aparece o nome do grupo e "Entrar no grupo". O link "Sair" logo abaixo pode ser lido como "sair do grupo" | print 21 |
| 4 | Baixa o app | travado | "Você entrou. Baixe o app para ver as rodadas." sem botão, sem loja e sem a próxima rodada. No piloto o app nem está na loja. Registrado como lacuna no passo 12 | print 22 |
| 5 | Vê a rodada no app | claro | Início com o cartão da rodada; a tela mostra "Você é jogador", "Vai?", "Falta 1 vaga · 11/12" | print 31 |
| 6 | Confirma VOU | claro | "Você vai · 12º da lista" e "Não vou mais". Ao desistir, o app diz quem entra no lugar | prints 31 e 32 |
| 7 | VOU desligado (avulso) | confuso | "Avulsos confirmam a partir de ter, 20h" não diz por quê, nem o que é avulso, nem oferece aviso. Na web o texto é pior: "A lista dos avulsos ainda não abriu.", sem data. Registrado só como "conferir se é a regra desejada" | `pendencias.md`, teste do push, item 4 |
| 8 | Recebe o pedido de notificação | claro para o jogador | "Quer saber quando sair da espera?" depois do 1º VOU. O texto promete também "quando a lista abrir e quando os times saírem", que o servidor não envia | teste do push, `notifications.pt-BR.ts` |
| 9 | Vê os times | travado no app | A tela do jogador não mostra os times. Eles só chegam se o admin mandar o texto do sorteio no WhatsApp | print 40, tela 26 do canvas |
| 10 | Vê o resultado | claro | "Ver resumo" no cartão da Início e na rodada encerrada (R99). Ninguém é avisado de que a rodada acabou | print 116, diário de 23/11 |
| 11 | Vota no MVP | confuso | A entrada é o botão "Votar no MVP · fecha em 23 h" dentro do resumo. Sem aviso, o jogador só vota se abrir o app por conta própria em 24 h. As regras da votação estão bem escritas | print 114, `mvp-vote.pt-BR.ts` |
| 12 | Vê a cartinha | claro | "Seus números aparecem depois da primeira partida." e "Os números vêm do placar." A demora para atualizar foi corrigida na R99 | prints 106 e 115 |

## 3. Achados

Os de 1 a 15 são **achados novos de entendimento**. Os defeitos já registrados estão no fim da seção, só com o passo.

### Impede o uso

**1. O caminho do jogador pela web não foi provado e termina num beco.**
O produto promete "jogador entra sem instalar", mas o roteiro só percorreu o convite do grupo, que acaba em "Baixe o app" (print 22). O link da rodada, que é o que o organizador de fato manda toda semana, não foi aberto em nenhum celular.
Sugestão:
- Percorrer `/r/…` na 6ª tentativa, com conta nova e sem o app: abrir, VOU, criar conta, apelido, confirmação, voltar no dia seguinte.
- Na página de sucesso do convite, trocar o texto por "Você entrou no Grupo Fluxo." e mostrar logo abaixo a próxima rodada aberta com o botão VOU. Sem rodada: "Quando marcarem a próxima rodada, o link chega no grupo do WhatsApp."
- "Baixe o app" só com um botão que funcione no piloto (o link do build de teste). Sem isso, tirar a frase.

**2. O avulso encontra o VOU desligado e o organizador não sabe que a lista está fechada.**
O texto "Avulsos confirmam a partir de ter, 20h" pressupõe que a pessoa sabe que é avulsa e que existe uma janela. A tela do admin (print 26) não mostra essa janela em lugar nenhum. Risco concreto: o organizador publica a rodada com 3 dias de antecedência, manda no WhatsApp, ninguém consegue confirmar e ele não entende o motivo. Não ficou claro, pelo material, se a janela vale num grupo sem nenhum mensalista; se valer, o problema atinge o grupo inteiro.
Sugestão:
- Texto do jogador: "A lista abre para você na terça, às 20h. Até lá, só os mensalistas confirmam." com o botão "Me avisa quando abrir".
- Web: o mesmo texto, com a data (hoje é "A lista dos avulsos ainda não abriu.").
- Tela do admin, sob o contador: "Avulsos confirmam a partir de ter, 20h · Mudar", levando a Como jogamos.
- Num grupo sem mensalistas, a janela não se aplica e a palavra "avulso" não aparece.

### Confunde

**3. "Encerrar rodada" sem confirmação na tela de fim de partida.**
É um link de texto entre "Confirmar e ir para a próxima partida" e "Voltar ao início" (print 113). Um toque encerra a rodada e abre a votação do MVP. Com gente esperando para jogar, o erro custa a noite.
Sugestão: abrir sempre a folha "Encerrar a rodada?" com o corpo "Foram N partidas. Depois disso não dá para jogar outra nesta rodada, e a votação do MVP abre por 24 h." e os botões "Encerrar rodada" e "Continuar jogando". Mover o link para baixo de "Voltar ao início".

**4. Não existe cancelar rodada, e a rodada acaba sozinha sem aviso.**
Rodada publicada por engano ou em dia de chuva fica aberta recebendo VOU (passo 27). A rodada 1 terminou sozinha, virou "0 partidas" e o grupo passou a dizer "Nenhuma rodada marcada" (passo 18).
Sugestão: "Cancelar rodada" em Editar rodada, com confirmação e o texto "Quem confirmou vê 'Rodada cancelada'". Rodada que acaba sem partida aparece como "Não teve jogo", sem "Ver resumo".

**5. O app promete avisos que não existem.**
A tela de Notificações e o pedido de permissão dizem "a gente avisa quando a lista abrir, quando você sair da espera e quando os times saírem". O servidor só envia a saída da espera (o backlog E3.11 só cobre isso). O jogador que confia no aviso perde a abertura da lista, os times e a votação.
Sugestão: no piloto, prometer só o que existe: "A gente avisa quando você sair da espera." O texto próprio para o admin já está registrado (`pendencias.md`, teste do push, item 1).

**6. O jogador não vê os times no app.**
O sorteio só chega pelo texto do WhatsApp. Se o admin fechar a folha de compartilhar (como nos passos 21 e 31), ninguém recebe. A tela 26 do canvas também não tem os times, então é decisão de produto.
Sugestão para o Gabriel decidir: bloco "Times" na tela da rodada depois do sorteio, com "Você está no Laranja".

**7. MVP provisório apresentado como definitivo.**
Print 114: "MVP do dia · Leo · Calculado pelo placar · Votação da galera aberta". Além disso, os 6 do Laranja tinham o mesmo saldo; não se sabe por que Leo.
Sugestão: com a votação aberta, o título vira "Na frente pelo placar" e a linha de baixo "A galera decide até amanhã, 12h44". Depois de fechada: "MVP do dia · Escolhido pela galera".

**8. O organizador não tem VOU.**
Ele entra na própria lista por "Adicionar quem confirmou no WhatsApp", como "Você · Avulso" (print 27). É o passo que mais se esquece: no passo 20 a organizadora ficou fora do sorteio sem aviso.
Sugestão: linha "Você vai jogar? VOU / Não vou" no topo da tela do admin, ou a pergunta "Você joga nesta rodada?" logo depois de publicar.

**9. "Mensalista" e "Avulso" aparecem para quem disse que não tem mensalistas.**
O grupo criado com "Não" mostra abas Mensalistas e Avulsos, abre na aba vazia e chama todo mundo de "Avulso" (prints 16, 27 e 123). Para o jogador comum, "avulso" soa como "de fora".
Sugestão: sem mensalistas no grupo, a tela Membros é uma lista só, sem abas e sem o rótulo. Com mensalistas, abrir na aba que tem gente. Na criação, "Não" desliga "mensalistas com prioridade" e a janela dos avulsos.

**10. Selo "Pro" bloqueia no grupo e libera na rodada.**
Em Como jogamos, 5x1, 4x2 e 6x2 têm selo Pro e não podem ser o padrão (print 13). Em "Personalizar esta rodada" e na preparação da partida os mesmos sistemas estão livres (prints 25 e 111). No piloto o Pro é grátis (`decisoes.md`).
Sugestão: no piloto, tirar o selo e liberar no grupo; ou trocar o selo por "Grátis no piloto".

**11. "Outro celular está marcando" fala do próprio usuário.**
Print 101: "Org Teste está marcando esta quadra" para a Org Teste, "Último ponto que chegou, há 1467 min" e "Nenhuma partida aberta agora". O título diz "celular", o botão diz "placar" e o erro diz "quadra".
Sugestão: quando a conta é a mesma, "Esta quadra ficou aberta em outro celular seu (ou numa sessão antiga)". Tempo em "há 1 dia", "há 4 h". Sem partida aberta, o botão vira "Continuar neste celular". Usar sempre "placar".

**12. A quadra não ensina a marcar ponto.**
Prints 42 e 112: nenhuma instrução. O produto diz "nada de gesto escondido". O título "Posições no momento do saque" fica sobre uma quadra vazia no modo Livre. O selo "L" quer dizer levantador (o líbero é "Lí"), o contrário do que o vôlei usa.
Sugestão: no 0 a 0 da primeira partida, "Toque no lado do time que fez o ponto" no centro de cada metade, sumindo no primeiro ponto. No modo Livre, esconder o título. Trocar os selos para "Lev" e "L".

**13. Publicar e compartilhar são uma ação só, sem retorno.**
O botão "Publicar e compartilhar no WhatsApp" abre a folha genérica do Android (print 37). Fechar a folha deixa a rodada publicada sem dizer nada. Nos prints 116 e 128 há rodadas do mesmo grupo no mesmo dia e hora, sem aviso de duplicata e com cartões idênticos na Início.
Sugestão: depois de publicar, aviso "Rodada publicada" e, na tela da rodada, o botão "Mandar no WhatsApp" sempre à mão. Ao criar outra no mesmo dia e hora: "Já existe uma rodada do Grupo Fluxo na seg, 20h. Criar outra mesmo assim?"

**14. A página do convite não diz qual é o grupo antes do login.**
Print 19. É limitação conhecida (o servidor não vê o código), mas o texto pode ajudar.
Sugestão: "Você foi convidado para um grupo de vôlei. Entre com sua conta para ver qual é e participar. Leva 30 segundos." Trocar "Sair" por "Sair da conta" (print 21).

**15. Convidar está escondido.**
Depois de criar o grupo, o caminho é Grupo, Membros, Convidar por link (prints 11 e 16). O produto pede o convite como fecho da criação.
Sugestão: terminar a criação numa tela "Grupo criado. Chame a galera" com "Mandar no WhatsApp" e "Agora não". No cartão do grupo, trocar o atalho "Membros" por "Convidar" enquanto o grupo tiver só o admin.

### Polimento

16. **Hora em três formatos:** "0h30" nos cartões, "21:00" para digitar, "ter, 20h" em minúscula no aviso do avulso. Aceitar "21", "21h" e "2100" (registrado no passo 41) e escrever "terça, 20h".
17. **Folha de entrada do app** diz "Entrar pra confirmar" a quem veio criar um grupo (print 01). No app: "Entrar no Sacou · Organize seu racha ou confirme presença."
18. **"Duas perguntas e pronto"** tem seis campos (print 07). "Quase lá" é mais honesto.
19. **Erros sem o quê nem o próximo passo:** "Grupo criado, mas não salvamos tudo" não diz o que faltou (print 09; a causa foi corrigida na R98). "Ainda faltam 6 pontos para enviar" não diz o que fazer; acrescentar "Deixe o app aberto com internet."
20. **"Sem conexão"** na Início (print 128) poderia dizer o que continua valendo: "Sem conexão. Você vê o que já estava aqui; o placar funciona normal."
21. **Rótulos das notas** cortados no perfil ("Jogo fe-derado", print 03).
22. **"Regra de sobreposição"** e **"Líbero"** em Como jogamos: esconder sob "Avançado", como o produto já previa.
23. **Cartões da Início do admin** não têm estado (print 28): mostrar "Você ainda não confirmou" ou "Vou".

### Defeitos já registrados (não repetidos aqui)

- "Muitas tentativas em pouco tempo" e lentidão: passos 3, 6, 8, 9, 10, 19, 23, 24, 26 e 27 (laço do push, corrigido no PR #209).
- Início quebrada pelo `toSorted`: terceira tentativa (corrigido no PR #213).
- Rodada 1 encerrada sozinha: passo 18. Rodada futura que não encerrava: passo 34 (R98).
- Rotação fora dos chips: passos 20, 27 e 35 (R98). Quadra presa e "placar com defeito": passos 27 e 35 (R98).
- Início duplicando rodadas, página da rodada e cartinha desatualizadas, "Compartilhar" quebrado: passos 38 a 41 e 43 (R99, PR #227).
- Local da rodada vazio, nomes sobrepostos na rede, horário só em "21:00", aviso de desenvolvimento sobre as abas: `pendencias.md`, 5ª tentativa, item 4.
- Título "Notificações" quebrado: passo 18. Folha que pula com o teclado: passos 14 e 26. Voltar com o teclado aberto perde a Nova rodada: teste do push, item 3.
- Convite sem abrir o app e "Baixe o app" sem botão: passos 11 e 12. Mensalista que já nasce confirmado: passo 42.

## 4. Termos

### Precisam de explicação ou de outro nome

| Termo | Onde aparece | Problema | Sugestão |
|---|---|---|---|
| **Avulso** | Membros, lista de presença, aviso do VOU, regra da fila | Dois sentidos: tipo de membro e, na fila, "quem espera sozinho" ("Se só há avulsos, saem tantos quanto esperam"). Soa como "de fora" | Manter só para o tipo de membro, com a frase "Avulso: confirma rodada a rodada". Na fila, usar "reservas" |
| **Mensalista** | Criação do grupo, Membros, Como jogamos | A frase da criação é boa ("entram na lista sozinhos toda rodada") e some depois | Repetir a frase em Membros e na folha de opções do membro |
| **Saída parcial** | Chip da rodada, para admin e jogador | Jargão do produto. Ninguém fala assim na quadra | Chip "Sai só quem tem reserva". A frase de Como jogamos ("Só sai do perdedor quem vai ser substituído") aparece ao tocar no chip |
| **Livre / 6x0** | Chips, Como jogamos, personalizar | "6x0" é termo de técnico. Na preparação o botão diz só "Livre" | "Sem rotação marcada" no chip e "Livre" nos botões. Tirar o "6x0" |
| **5x1, 4x2, 6x2** | Como jogamos, rodada, preparação | Quem conhece, entende. Quem não conhece não deve precisar | Uma linha: "Para times com levantador fixo" |
| **Assumir o placar** | Folha "Outro celular está marcando" | Mistura com "assumir a quadra" e "marcando esta quadra" | Uma palavra só: "placar". Botão "Marcar neste celular" |
| **Placar** | Papel do membro, tela, botão | É a pessoa, a tela e o número. "Você é placar" soa estranho | Papel "Marcador" (ou "Mesário"), tela "Placar" |
| **Encerrada** | Rodadas, cartão, selo | Convive com "terminou" (web), "fechou" (web e votação) e "partida encerrada" | "Encerrada" para rodada, "fim da partida" para partida, "fechou" só para a votação |
| **Regra de sobreposição** | Como jogamos | Incompreensível fora do vôlei federado | Sob "Avançado", com "Quem pode ficar na frente de quem na hora do saque" |
| **L / Lí** | Marcadores na quadra | "L" é líbero em qualquer súmula | "Lev" e "L" |
| **Nota** | Membros, sorteio, convidado | "1 nota para confirmar. O sorteio usa a sugestão até lá" pede duas leituras | "Beto sugeriu nota 3 para ele. Confirme ou mude" |

### Mesmo conceito com nomes diferentes

| Conceito | Nomes encontrados | Usar |
|---|---|---|
| Quem organiza | "admin" (rodada, membros), "organizador" (Início), "a organização" (Rodadas), "quem organiza" (web) | "admin" como papel; "quem organiza" nas frases para o jogador |
| Pessoa sem conta | "Convidado sem conta", "Sem conta", "entrou pelo WhatsApp" (print 126) | "Convidado" (e "Convidar" passa a ser "Chamar pro grupo", para não confundir com o membro que entrou pelo link) |
| Quem espera vaga na partida | "reservas", "avulsos", "banco", "fila" | "reservas" para pessoas, "fila" para a ordem, "banco" só com rotação |
| Lista sem vaga | "Lista cheia" (app), "Lotou" (web) | "Lista cheia" |
| Sem rede | "Sem conexão", "Sem internet" | "Sem internet" |
| Regra da fila | "Perde sai" (chip), "quem perde sai" (web e modelo) | "Quem perde sai" |
| Rodada e lista | "rodada", "lista" ("quando o organizador abrir a lista") | "rodada" para o evento, "lista" só para a presença |

### Entendidos sem ajuda

"VOU / Não vou", "na espera", "Sortear times", "Perde sai", "MVP do dia", "Desfazer", "Corrigir", "Sacando / Em recepção", "Set point", "Ver resumo" e "cartinha" funcionam como estão.

## 5. Ordem das telas

A ordem geral segue um racha de verdade: marcar, chamar, confirmar, sortear, jogar, encerrar, resumo. Três desvios:

1. **Convidar vem tarde.** No racha real o grupo existe antes da rodada; no app o convite fica dois níveis abaixo e a criação termina sem ele (achado 15).
2. **Sortear emenda em jogar.** "Confirmar e compartilhar" abre direto a preparação da Partida 1 (passos 21 e 31). Quem sorteia na véspera para mandar os times cai numa tela de jogo. Depois do sorteio, voltar para a rodada, com "Abrir quadra" em destaque.
3. **Encerrar não tem fecho para o jogador.** A rodada acaba e só o admin vê o resumo na hora; o jogador depende de abrir o app (achados 5 e 6).
