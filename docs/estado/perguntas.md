# Perguntas para o Gabriel

## Abertas
1. Preços dos planos (propostos): Pro do Grupo R$ 12,90/mês ou R$ 99/ano; Sacou+ do Jogador R$ 5,90/mês ou R$ 44,90/ano. Confirma? (Não bloqueia até depois do piloto: planos e paywall saíram do piloto, ADR 0046.)
2. Retenção e base legal (LGPD): nenhum documento define por quanto tempo cada dado fica guardado nem a base legal, inclusive em backups. Pede orientação jurídica. Opções: (1) levar ao advogado ou contador na E6.2, com uma proposta minha para revisão; (2) definir antes. **Recomendação: opção 1.** Não bloqueia até o M6; o inventário fica "a definir".
3. Encarregado de dados (LGPD): `docs/produto.md` exige o canal, mas não diz quem é nem qual o contato. Opções: (1) você mesmo, com um e-mail do domínio do Sacou; (2) terceirizar. **Recomendação: opção 1 no piloto.** Não bloqueia até o M6 (E6.1, política de privacidade).
4. Provedor de IA do resumo: nenhum documento nomeia. Envolve conta e gasto. **Não bloqueia até depois do piloto:** o texto da IA saiu do piloto (ADR 0046).
5. Editor de formação do Pro: como a sobreposição é só aviso (ADR 0010), o editor deixa salvar uma formação inválida? Opções: (1) deixa salvar, mostrando o aviso; (2) não deixa. **Recomendação: opção 1**, coerente com "aviso, nunca bloqueio". Não bloqueia até a tarefa do editor.
6. Sets "livre": `produto.md:75` lista "livre, único, md3, md5", mas as telas 08 e 20 só oferecem 1 set, Melhor de 3 e Melhor de 5, e nenhum documento diz o que é "livre". Opções: (1) fora do MVP, como nas telas; (2) partida sem número de sets, que só termina em "Encerrar partida". **Recomendação: opção 1**; entrar depois só acrescenta um valor a `bestOf`. Não bloqueia agora: a E2.2 aceita 1, 3 ou 5.
7. "Encerrar partida" antes do fim (tela 23): nenhum documento diz quem vence com partida incompleta, o que define quem sai na fila. Opções: (1) vence quem lidera em sets e, se empatar, em pontos; empate total fica sem vencedor e ninguém sai; (2) o admin escolhe sempre; (3) a partida é anulada, sem vencedor. **Recomendação: opção 1.** Não bloqueia agora: o `MatchEnded` da E2.2 aceita as três, e a resposta decide só a chamada, nas E2.6 e E4. **Respondida em 17/11/2026: opção 1 (ver o fim do arquivo).**
9. Tema Sol/Noite (E4.1, 07/11/2026): só no modo quadra, como no canvas, ou modo escuro no app todo? **Recomendação e padrão adotado até a resposta: só na quadra.** Fácil de mudar: os temas usam os mesmos papéis.
10. Fundo do Noite (E4.1, 07/11/2026): `#000000` (canvas, tela 10) ou `#0F1B2D` (`produto.md:151`)? **Recomendação e padrão adotado: seguir o canvas.** Muda só um token.
28. Saudação do Início (E4.4, 10/11/2026): "Fala!" sem o nome até existir o perfil (E3.17). **Recomendação e padrão adotado.**
29. Entrada das notificações (E4.4, 10/11/2026): um sino no cabeçalho do Início abre a tela 28; o canvas não tem esse sino. **Recomendação e padrão adotado.**
26. Admin reduz as vagas com a lista cheia (E3.4, 10/11/2026): ninguém sai da lista; a espera só anda quando sobrar vaga. **Recomendação e padrão adotado.**
34. Interruptores da tela 04a (E4.5, 12/11/2026): a tela tem "Placar" e "Jogo", mas o catálogo só tem `scoring.enabled`. **Recomendação e padrão adotado: um bloco só, "Jogo", como na tela 18.**
35. Página do link de convite (E4.5, 12/11/2026): era da E4.16, que saiu do piloto. **Recomendação e padrão adotado: a página web da E3.12 ganha a rota do convite.**
36. Fila, vencedor bate X vitórias com só um time esperando (E2.12): (1) sai o vencedor e o perdedor fica; (2) sai o perdedor, como sempre. **Recomendação e padrão adotado: 1** (com três times na noite, é a única em que o interruptor faz efeito).
37. Fila, "sempre o time inteiro" com só avulsos esperando (E2.12): (1) remonta o time com os avulsos e completa com quem perdeu; (2) ninguém sai; (3) igual ao automático. **Recomendação e padrão adotado: 1.**
38. "Vencedor também sai" em grupo novo (E2.12): (1) desligado, com X = 3 pronto para ligar; (2) ligado, como no exemplo da tela 18. **Recomendação e padrão adotado: 1.**
39. "Não sei" na nota do membro (E3.17): **recomendação e padrão adotado: marca como revisado, sem nota.**
40. Apelido obrigatório? A tela 27 tem "Pular" (E3.17): (1) o app grava o primeiro nome do login, editável, e pede o apelido a quem entrou por e-mail antes de entrar num grupo; (2) "Sem apelido"; (3) obrigatório. **Recomendação e padrão adotado: 1** (a API serve às três; muda só a E4.3).
41. Posições no feminino nas telas 19 e 19b, sem gênero na API (E3.17): **recomendação e padrão adotado: masculino no piloto, ajustar as telas.**
42. A exportação da E3.16 inclui a nota dada pelo admin? (E3.17): **recomendação e padrão adotado: não; a dúvida de LGPD vai para a E6.2.**
43. Texto da tela 21a ("pode criar a conta depois") promete a reivindicação, que ficou para depois do piloto (E3.5): (1) trocar por "Ele entra como avulso nesta rodada"; quem criar a conta começa um histórico novo; (2) manter o texto e juntar à mão; (3) antecipar a reivindicação. **Recomendação e padrão adotado: 1** (muda só o texto na E4.6).
44. Ao remover um convidado (E3.5): (1) o nome é apagado na hora e o histórico mostra "Ex-jogador"; (2) o nome fica enquanto o grupo existir. **Recomendação e padrão adotado: 1** (minimização, igual à exclusão de conta da E3.16).
27. Até quando o jogador responde a presença (E3.4, 10/11/2026): até o horário da rodada; depois, só o admin. **Recomendação e padrão adotado.**
30. Tela de membros antes dos nomes (E4.5, 10/11/2026): (1) mostrar "Você" e "Membro desde 12 out" e esconder "Remover outra pessoa" até haver nome (E3.17); (2) liberar o remover mesmo sem nome; (3) fazer a E3.17 antes. **Recomendação e padrão adotado: opção 1.**
31. Pix antes da E3.10 (E4.5, 10/11/2026): (1) esconder chave e forma até a E3.10; (2) mostrar o campo sem guardar; (3) pôr a E3.10 antes da E4.5. **Recomendação e padrão adotado: opção 1.**
32. Destino de "Criar grupo" (E4.5, 10/11/2026): (1) membros (tela 19), para convidar; (2) "Como jogamos" (tela 18); (3) lista de grupos. **Recomendação e padrão adotado: opção 1** (tela 18 até a Parte 2; tela 06 quando a E4.6 chegar).
33. Endereço do link de convite (E4.5, 10/11/2026): precisa de um domínio (conta, com você). (1) `EXPO_PUBLIC_INVITE_BASE_URL`, cadastrada quando houver domínio; sem ela, os botões de convite somem; (2) esquema do app `sacou://convite#token` até lá (só abre em quem já tem o app). **Recomendação e padrão adotado: opção 1.**

## Respondidas
- **Posições na quadra (13/11/2026, no teste no celular):** cada jogador é um círculo na cor do time com o número da posição, no ponto exato da formação, e o nome pequeno ao lado: embaixo por padrão, e onde não atrapalhar quando os pontos estão perto (nunca sobre outro círculo ou nome). Substitui o chip com nome. Entra no PR #78, antes do merge. ADR 0052. Depois de três rodadas com o nome "no lugar livre mais próximo" (os nomes ficavam entre dois círculos), o Gabriel escolheu a regra fixa: nome sempre logo embaixo do próprio círculo, em cima só sem espaço; e os círculos nunca são afastados, mesmo quase sobrepostos ("se vc afastar os circulos a rotação vai ficar errada"). Aceitou o visual no celular em 13/11/2026.
- **Tamanho da quadra na paisagem (13/11/2026):** placar com cerca de 38% da altura da zona (era 45%) para a meia quadra crescer cerca de 20%; a meia quadra encosta na rede. ADR 0052.
- **Sem trava na quadra (13/11/2026):** o cadeado sai ("ele não vai saber que tem que segurar o cadeado"). O Menu abre com um toque; o voltar do Android continua bloqueado na quadra (padrão do orquestrador), e sair é pelo Menu. Feito na correção da E4.9.
- **Paisagem da E4.17 (13/11/2026):** layout do esboço aprovado, telas filhas da quadra também em paisagem, sem o toast "+1", nomes com primeiro nome + inicial quando repetem, "Inverter lados" só com a quadra aberta, aviso de bateria some com "Entendi" ou no carregador. Detalhes em `docs/estado/tarefas/E4.17.md`, seção 8.
- **Modo quadra em paisagem (13/11/2026, no teste no celular):** a quadra fica sempre em paisagem, travada; o resto do app continua em retrato. Os defeitos de lógica do teste (fim do set, trava, vibração do fim do set) são corrigidos já, na E4.9; os de layout (nomes sobrepostos, faixa cortada) vão para a paisagem, na E4.17, cujo layout o analista propõe e o Gabriel aprova. Testar com nomes longos.
- **Revisão das telas do piloto (12/11/2026, pelo celular):** fila com três modos e "vencedor também sai" (resposta 3-2); votação do MVP só de quem jogou, sem votar em si, 24 h, secreta, empate pelo saldo (4-a); areia rei da quadra com duplas ou quartetos, vencedor fica e ranking do dia (5-1). Telas de `design/mvp/` aprovadas, inclusive 09a, 09b e 09c. ADR 0048.
- **Nota e rating (11/11/2026, pelo celular):** a nota inicial é do admin, e o jogador só sugere; rating OpenSkill por partida, que o jogador não vê e que fica escondido no piloto. ADR 0047.
- **Escopo do piloto (11/11/2026, pelo celular):** saem texto da IA e story, foto da cartinha, placar ao vivo, planos e paywall, Pix, reivindicação do convidado, links que abrem o app e o QR do placar; o Resumo sem IA fica; o Placar assume a quadra; sincronização a cada ponto. ADR 0046.
- **Perguntas 20 a 25 (10/11/2026), todas na opção 1:** 20: fora da quadra sem internet, o app mostra os dados guardados de até 7 dias com a faixa "Sem conexão · atualizado há X" (o Gabriel questionou o valor do offline; o ganho principal são os nomes no placar, E4.7). 21: os modelos prontos ligam o que diz a tabela do D4 de `docs/estado/tarefas/E3.3.md`. 22: "Aplicar modelo" troca os padrões do grupo, sem mexer em dia, horário, local, vagas e valores. 23: o Co-admin edita "Como jogamos", inclusive o dinheiro. 24: mensalistas que sobram vão para a espera, à frente dos avulsos. 25: mensalista que desistiu e volta vai para o fim da espera.
- **Modelo da E3.4 Parte 2 (10/11/2026):** Sonnet, como manda a tabela do `CLAUDE.md` (o analista recomendava Opus).
- **Grupos, perguntas 16 a 19 (09/11/2026):** todas na opção 1, a recomendada. 16: o Co-admin faz tudo do dia a dia, mas não promove, rebaixa nem remove Admin ou Co-admin. 17: o link de convite vale até ser revogado. 18: entrar pelo link não precisa de aprovação. 19: quem foi removido não volta pelo link; só se o admin readmitir pelo menu "⋯" da tela 19.
- **Senha mínima, pergunta 12 (08/11/2026):** 6 caracteres, o padrão do Firebase. Nada a ajustar no console. A E4.3 mostra a regra dos 6 na tela de cadastro.
- **E-mail verificado, pergunta 11 (08/11/2026):** não exigir no login por e-mail e senha. Confirma a decisão da E3.1 (ADR 0036, D3): a API aceita token com `email_verified` falso.
- **Firebase, pergunta 13 (08/11/2026):** ID do projeto Firebase: `sacou-79493` (08/11/2026). Fica em `Firebase:ProjectId`, no `apps/api/src/Sacou.Api/appsettings.json` (E3.1). Pacote Android: `com.sacou.app`.
- **Líbero nas telas 09 e 10, pergunta 14 (08/11/2026):** opção 1: o chip do líbero ocupa o lugar do central que ele cobre, com cores invertidas e selo "Lí"; o "L" segue sendo do levantador. Libera a Parte 4 da E4.9.
- **Build de teste no celular, pergunta 15 (08/11/2026):** Android, APK de teste pelo EAS com conta grátis da Expo, criada pelo Gabriel no fim da Parte 3 da E4.9 (login por `! npx eas login`).
- **Bateria e paisagem (08/11/2026):** os dois entram no M4, como a tarefa nova E4.17. O design não tem a paisagem: o analista da E4.17 propõe o layout para o Gabriel aprovar.
- **Firebase, pergunta 8 (08/11/2026):** o Gabriel criou o projeto no Firebase. Pacote Android e Bundle ID iOS: `com.sacou.app` (definitivo depois da publicação nas lojas). O `google-services.json` e a chave da conta de serviço ficam fora do repositório (`D:\segredos\sacou\`) até a E3.1 definir o formato de `SACOU_FIREBASE_SERVICE_ACCOUNT` e a E4.3 ligar o Firebase no app (`app.json`, `.gitignore` e restrição da chave de API ao pacote). Nada cadastrado no GitHub ainda. A E3.1 está desbloqueada.
- **Reducer pattern no app (07/11/2026):** vira a regra 4 de `docs/padroes/frontend.md`: `useReducer` com ações tipadas e reducer puro para estado com transições; modo quadra só com o reducer do motor; dados do servidor no TanStack Query.
- **Regras do front-end (07/11/2026):** estado com registro único, layout só com unidades relativas e programação orientada a interfaces (`docs/padroes/frontend.md`). Ele concordou com a única exceção: pisos de acessibilidade em dp (toque ≥ 44 e linha fina), que a escala nunca reduz.
- **Estatísticas, E2.9 (03/11/2026):** sequência é vitórias seguidas; partida encerrada sem vencedor quebra a sequência; "time" no Resumo é a cor (lado A/B). Fecha a pendência de `revisao-mvp.md:43`.
- **Ponto individual, E2.8 (03/11/2026):** o app barra combinações impossíveis (Ace só de quem sacou o rali; líbero nunca leva Ace nem Bloqueio); autor só preenchido com a partida aberta; sem apagar autor, só trocar ou DESFAZER.
- **Correções, E2.7 (03/11/2026):** "Trocar sacador" troca só o time que saca, sem girar ninguém, e no 0–0 corrige também quem começou o set; DESFAZER desfaz a última ação, seja ela qual for.
- **Fila, E2.6 (03/11/2026):** todos do time podem sair, inclusive banco e líbero, e quem entra no lugar do líbero vai para o fim do banco; empate em "mais partidas seguidas" desempata por mais partidas na rodada e depois por ordem de chegada; "Nível" fora do MVP; só saída parcial automática no MVP, sem o interruptor, "N fixo" nem "vencedor sai após X vitórias".
- **Líbero, E2.11 (03/11/2026):** entrada e saída calculadas, sem evento (amplia a exceção a `decisoes.md:26`, já anotada); cobre os dois centrais, alternando; só no 5x1 e no 6x2, então o grátis fica sem líbero.
- **Banco, E2.5 (02/11/2026):** só Manual no MVP. "Sai quem saca" não tinha definição nos documentos nem padrão na internet, e foi para `docs/ideias.md`. Isso dispensa as perguntas sobre o momento da troca, o levantador e a exceção a `decisoes.md:26`. A linha "Banco" saiu da tela `AjustesGrupo`.
- **Cópia das formações, E2.4 (02/11/2026):** número `formationsVersion` no evento e catálogo imutável por versão, em vez da cópia completa. Exceção a `decisoes.md:26`, já ajustado; a cópia real entra junto com o editor do Pro.
- **Líbero ligado no MVP (02/11/2026):** entra, contra a recomendação. Vira a tarefa E2.11, no M2 e antes do porte em C#. Faltam o controle em "Avançado" e a tela: `produto.md:94` prevê, mas o design não tem.
- **Toque em dois jogadores na tela 22 (02/11/2026):** troca a ordem oficial (`lineup`), e o alerta trata só de funções, como "Levantadores não estão opostos". O texto "Lia e Ana estão fora de ordem" (`Escalacao.dc.html:91`) muda na E4.8.
- **Rotação do set seguinte, E2.3 (02/11/2026):** opção 1, continua de onde parou. Definitivo. O app só troca o lado do desenho; a escolha está isolada em `chooseNextSetZones` (ADR 0024).
- **Primeiro saque do set decisivo, E2.3 (02/11/2026):** opção 2, sorteio no set decisivo de md3 e md5; nos demais sets, alterna. `confirmSetEnd` aceita `firstServer` de fora, e a interface do sorteio é da E4.10. `rotacoes.md:40` corrigido.
- **Time sem 6 jogadores, E2.3 (02/11/2026):** opção 1, rotação desligada (`rotations.<lado>: null`), e o app mostra só o time que saca. Decide o que as E4.7 e E4.8 mostram.
- **Porta do Ryuk (01/11/2026):** risco aceito por ora, sem mudança na máquina (ADR 0020).
- **Empate lateral (01/11/2026):** seguir a FIVB 2025-28, regra 7.4.3.2 ("level with"): empate lateral é permitido, como o frente/fundo. Corrige `rotacoes.md`, o explorador e o validador na E1.2. O texto de edições anteriores, para o modo Clássico, não foi conferido.
- **Actions no GitHub (01/11/2026):** o orquestrador configurou, com autorização: SHA obrigatório e só as 5 actions usadas hoje.
- **Aviso de CVE (01/11/2026):** só alertas do Dependabot, já ligados. Sem execução agendada: a validade do `zod` continua sendo cobrada só em execução com código.
- **Postgres local na E0.6 (01/11/2026):** Docker Desktop, instalado pelo Gabriel. Recusados os binários da EDB, porque `bin\postgres.exe` não tem assinatura, e o Postgres só na CI.
- **Disco D: (01/11/2026):** "use o disco local D quando precisar". O orquestrador leu isso como autorização para pôr no D: os temporários, os caches e, se o C: ficar abaixo de 2 GB livres, o disco de imagens do Docker. Quem move o disco é o orquestrador.
- **`zod` na E0.9 (01/11/2026):** exceção aceita até 31/01/2027 para GHSA-mrhx-c7xc-m3w5 no `zod` 3.25.76, que vem do `@expo/cli` e não entra no bundle. Análise no ADR 0007; um teste reprova a exceção vencida.
- **`testador.md` (01/11/2026):** autorizada a correção do caminho das formações.
- **Proteção da `main` (30/10/2026):** repositório privado e grátis, sem bloqueio imposto pelo GitHub; o orquestrador só faz merge depois de conferir a CI verde.
- **E0.5 travada (30/10/2026):** enxugar o `docs/backlog.md`: só o mapa de marcos e uma regra curta remetendo ao `CLAUDE.md`, com mais uma revisão.
- **Livre e 6x0 (30/10/2026):** um botão só na interface, "Livre / 6x0".
- **Cadência das sessões:** o plano fala em "4 horas" (linha 10) e "diária" (E0.7), e `docs/decisoes.md` em "quando quiser". O Gabriel decidiu: sessões manuais e E0.7 para depois (`PROMPT-INICIAL.md`). O orquestrador decidiu que o plano só muda quando a E0.7 for retomada.

## Decidido pelo orquestrador
- **CI verde antes da E0.4:** ver [ADR 0003](../arquitetura/adr/0003-local-validation-before-ci.md).

## 14/11/2026: cobrança do GitHub Actions
- **Pergunta:** desde 14/11, madrugada, todo job da CI cai em 2 s com "recent account payments have failed or your spending limit needs to be increased". Sem CI nenhum PR entra (#81 e #82 prontos). **Resposta (14/11):** o Gabriel mudou o plano no GitHub; a CI voltou no mesmo dia.

## 14/11/2026: E4.6 (rodadas no app), padrões adotados, nenhuma trava a Parte 1
Detalhes e opções no fim de `docs/estado/tarefas/E4.6.md`. Os números 43 e 44 são da E3.5 (PR #82).
45. "Publicar e compartilhar no WhatsApp" antes da página da rodada (E3.12): **padrão: publicar e abrir o WhatsApp com o texto da rodada, sem link até a E3.12.**
46. Estados da presença que a tela 26 não desenha (sem resposta, espera, janela fechada, começada, cancelada): **padrão: o mesmo cartão escuro com título e linha da tabela D7.**
47. Ver e tirar alguém da lista na tela 06: **padrão: tocar em "N confirmados" abre a lista, cada linha com "Tirar" e confirmação.**
48. "Criar grupo" leva à tela 20 ("Nova rodada"), não à 06, pois o grupo novo ainda não tem rodada: **padrão adotado.**
49. "Abrir no WhatsApp do grupo" (tela 26): **padrão: esconder no piloto**, ideia do campo de link em `docs/ideias.md`.

## 14/11/2026: respostas do Gabriel ("concordo com as recomendações")
- 43 a 49: valem os padrões adotados (opção 1 em cada uma).
- 50. Círculo colado na rede cai sob a coluna "Desfazer"/"Corrigir": **(1) empurrar o mínimo para fora da coluna, como hoje** (`leaveColumn` em `marker-placement.ts`); é a única exceção à regra "o círculo nunca sai do lugar" (ADR 0052).
- 51. "Inverter lados" fecha o menu sozinho: **sim** (feito no PR #81).
- Nome do sacador escondido sob a faixa da fila com os lados invertidos: **aceito, não corrigir** ("é um problema muito pequeno para perdermos tempo").

## 14/11/2026: E3.6 (sorteio), respostas do Gabriel: todas as recomendações
52. Reservas são os últimos a confirmar. 53. Com menos de dois times completos, dois times de n/2. 54. O sorteio exige internet no piloto. 55. Medidor: ≤ 0,2 "ótimo", ≤ 0,5 "bom", acima "desequilibrado". 56. A API aceita "separados", mas a tela 07 do piloto só tem "Travar dupla"; equilibrar por posição fica para depois. Detalhes em `docs/estado/tarefas/E3.6.md`, seção 7.

## 15/11/2026: E4.3 (login, perfil rápido e conta), perguntas 57 a 62
Detalhes e opções em `docs/estado/tarefas/E4.3.md`, seção "O que precisa do Gabriel". A Parte 1 (código e testes com o falso) e a Parte 2 andam antes das respostas.
57. Acessos no Firebase e no Google Cloud (provedores, SHA-1/SHA-256, `google-services.json`, restrição da chave) e como o build recebe o arquivo: **recomendado: variáveis do EAS e `.env` local apontando para `D:\segredos\sacou\`.**
58. iOS e "Entrar com Apple" no piloto (US$ 99/ano): **recomendado: piloto só no Android.**
59. Exportar dados sem e-mail: **recomendado: gerar o arquivo e abrir a folha de compartilhar.**
60. "Nome" na tela 30: **padrão adotado: trocar por "Apelido".**
61. Folha de e-mail e senha e topo da tela 02 sem canvas: **padrão adotado: os textos do plano.**
62. Termos e Política: **padrão adotado: links por variável; o piloto com jogadores reais só abre com a E6.1 publicada.**
- Também: a E4.3 Parte 3 (telas 30a e 30b) depende da E3.16 (API de exportar e excluir), que é do M6. Para fechar o M3, **recomendado: adiantar a E3.16 para o M3.**
- **Respostas do Gabriel (15/11):** 57: **versionar o `google-services.json`** (contra a recomendação e a pergunta 8; a restrição da chave de API ao pacote `com.sacou.app` e ao SHA-1, passo (d), passa a ser obrigatória antes do commit do arquivo, e o gitleaks precisa de exceção só para esse arquivo, com leitura obrigatória do revisor). 58: **piloto só no Android**. 59: **gerar arquivo e abrir a folha de compartilhar**. E3.16: **adiantada para o M3**. 60 a 62: valem os padrões adotados.

## 15/11/2026: E3.16 (exportar e excluir a conta), perguntas 63 a 65, padrões adotados
Detalhes em `docs/estado/tarefas/E3.16.md`, seção 9. Nenhuma trava a Parte 1. O ADR 0056 fica com a E3.16 e o da E4.3 passa a 0057.
63. Quem apaga a conta no Firebase: **padrão: o app chama `user.delete()` depois do 204; a API guarda o hash do UID e responde 410 a um login posterior.** A alternativa (FirebaseAdmin na API) pediria o segredo `SACOU_FIREBASE_SERVICE_ACCOUNT` e trava a Parte 2.
64. O último membro com conta exclui a conta e o grupo tem convidados sem conta: **padrão: os nomes dos convidados são apagados.**
65. Exportar exige login recente: **padrão: não, só excluir.**

## 15/11/2026: rate limiting na API (pergunta 66)
66. A API não tem limite de requisições por usuário (achado da revisão do PR #91: o sorteio custa até ~0,4 s de CPU por chamada, e qualquer usuário cria um grupo). Opções: (1) limite por usuário no ASP.NET Core (`AddRateLimiter`, janela fixa por `MemberId`/UID) antes do piloto, como tarefa pequena na E5.3; (2) só no proxy do Railway; (3) aceitar o risco no piloto fechado. **Recomendação: 1.** Até a resposta, o risco fica registrado, não aceito, em `modelo-de-ameacas.md`.

## 16/11/2026: cobrança do GitHub Actions de novo
- **Pergunta:** desde 16/11, todo job cai com "recent account payments have failed or your spending limit needs to be increased". Sem CI nenhum PR entra. Prontos esperando a CI: **#100** (E4.6 Parte 3: revisão e testador aprovaram, SHA `31867fe`); **#101** (E3.16 Parte 2: em revisão; o último run com CI, `4b03a43`, só teve 3 testes de integração de preparo errados, corrigidos em `8004762`). Ação do Gabriel: Settings → Billing & plans. Depois, o orquestrador roda de novo (`gh run rerun <id>`).

## 16/11/2026: minutos do GitHub Actions
A cota do plano Free acabou e o Gabriel não quer pagar. Opções: (1) runner no PC dele, (2) repositório público, (3) gastar menos minutos, (4) bateria local como portão. **Resposta do Gabriel (16/11): repositório público**, com o e-mail de autor dos commits visível, risco aceito. Feito no ADR 0058.

## 16/11/2026: fechamento do M3 (relatório em `relatorios/M3.md`)
67. Riscos registrados sem dono, todos pequenos (revisão do M3, M3-B2): o seletor do Google que devolve a mesma conta; `user.delete()` e `signOut` falhando juntos; um 410 antes da primeira resposta do Firebase; duas conexões por aceite de convite ou criação de grupo. **Recomendação: aceitar os três do celular no piloto e resolver o das conexões junto com a pergunta 66.**
68. Teste da E4.3 no celular: precisa dos passos do console do Firebase e da API em `https:`. Opções: (1) primeiro deploy (E5.1) no começo do M4, com o limite de requisições antes; (2) túnel temporário (conta grátis nova); (3) esperar a E5.1 na ordem normal. **Recomendação: 1** (deploy em produção precisa do ok do Gabriel).
- A pergunta 66 (limite de requisições) segue aberta e virou condição da E5.1 na revisão do M3.

## 17/11/2026: respostas do Gabriel ("pode seguir com a recomendação das perguntas")
- 66 (limite de requisições): **opção 1**, limite por usuário no ASP.NET Core (`AddRateLimiter`, janela fixa por UID ou `MemberId`) nas rotas da condição 1 da revisão do M3, como tarefa pequena antes da E5.1. Junto, resolver as duas conexões por aceite de convite (pool).
- 67 (riscos sem dono): os três do celular **aceitos no piloto**; o das duas conexões vai com a 66.
- 68 (teste da E4.3 no celular): resolvida pelo teste local pelo cabo (#112 a #114); falta só o 302.
- 7 ("Encerrar partida" antes do fim): **opção 1**, vence quem lidera em sets e, se empatar, em pontos; empate total fica sem vencedor e ninguém sai.
- **M4 liberado.** O primeiro deploy em produção (E5.1) ainda pede o ok explícito do Gabriel na hora.
- Pendente com o Gabriel antes da loja: conferir os termos do Gemini para uso comercial do ícone (ADR 0059).

## 17/11/2026: M4, perguntas 69 a 73 (padrões adotados; nenhuma trava a Parte 1)
Detalhes em `docs/estado/tarefas/E3.7.md` (69 e 70) e `docs/estado/tarefas/E4.7.md` (71 a 73).
69. E3.7: conferências que dependem de dado que muda durante a rodada (presença, plano da fila, plano Pro; lista 3.1, item 5): (1) não recusar, risco aceito; (2) recusar, com risco de travar a sincronização de um celular honesto. **Recomendação e padrão: 1.** Precisa da resposta antes do merge da E3.7 Parte 2.
70. E3.7: quantas quadras por rodada no piloto: (1) uma, um segundo celular recebe recusa e o app oferece assumir; (2) várias. **Recomendação e padrão: 1.**
71. E4.7: "Confirmar e compartilhar" da tela 07, imagem ou texto: **recomendação e padrão: texto agora, imagem depois.**
72. E4.7: rodada de grupo com o sorteio desligado (padrão do "Do zero"): **recomendação: "Montar times" à mão**; até a resposta, só um aviso, e esses grupos não chegam à quadra.
73. E4.7: líbero no início da partida: **recomendação e padrão: fica para a tela 22 (E4.8).**
- **Respostas do Gabriel (17/11):** 69, 70, 71 e 73: valem as recomendações (não recusar, com o risco aceito; uma quadra por rodada; texto no compartilhar; líbero na tela 22). 72: **opção 1, "Montar times" à mão** quando o sorteio do grupo está desligado; vira a Parte 3 da E4.7.
