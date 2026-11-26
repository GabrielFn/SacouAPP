RASCUNHO PARA REVISÃO JURÍDICA. Não é a versão final. Escrito pelo analista na E6.1 (24/11/2026) a partir do inventário `docs/seguranca/dados-pessoais.md`.

Como este arquivo é publicado (plano `docs/estado/tarefas/E6.1.md`): só o trecho entre os marcadores `publicar:inicio` e `publicar:fim` vai para `/privacidade`. Dentro dele, as linhas que começam com `>` são notas de revisão e **nunca** são publicadas. No trecho publicado valem só títulos (`#`, `##`, `###`), parágrafos e itens `- `, sem negrito, links, tabelas nem HTML. Onde falta uma decisão do Gabriel, o texto publicado já traz o padrão recomendado, e a nota `>` logo abaixo diz qual é a lacuna e a pergunta.

<!-- publicar:inicio -->

# Política de Privacidade do Sacou

Versão: 0.3 (rascunho)

Atualizada em: 25/11/2026

Este texto é um rascunho, ainda sem revisão jurídica. Alguns pontos, como quem responde pelos dados e o canal de contato, ainda podem mudar antes da versão 1.0.

## Resumo

- O Sacou usa o mínimo de dados para organizar o racha: sua conta de login, o apelido e as posições que você escolhe, os grupos de que participa, sua presença nas rodadas e o que acontece nas partidas.
- Não pedimos nome completo, telefone, documento, data de nascimento, endereço nem localização do celular. O app não lê seus contatos nem suas fotos.
- Seu apelido aparece para os membros dos seus grupos e na lista de uma rodada para quem tiver o link dessa rodada.
- A nota de nível que o organizador do grupo dá para montar times equilibrados não aparece para ninguém além dos organizadores do grupo.
- Seus dados ficam em servidores nos Estados Unidos.
- Você pode baixar seus dados e excluir sua conta pelo próprio app, a qualquer momento.

## 1. Quem cuida dos seus dados

O Sacou é um projeto pessoal, mantido por Gabriel, pessoa física, no Brasil (dado provisório deste rascunho), que decide como os dados são usados e responde por eles (controlador, na Lei Geral de Proteção de Dados, Lei 13.709/2018).

> LACUNA (pergunta 198): identificação do controlador. Padrão adotado: Gabriel, pessoa física, só com o primeiro nome. A LGPD (art. 9º, III) pede a identificação do controlador; o advogado deve dizer se basta o primeiro nome ou se é preciso nome completo, CPF ou CNPJ (MEI). Atenção: o repositório é público, e este arquivo também.

O canal para falar sobre privacidade está na seção 13.

## 2. Quais dados usamos e para quê

### Conta

Para entrar, você usa uma conta Google ou um e-mail e senha. O login é feito pelo Firebase Authentication, do Google, que guarda seu e-mail, seu nome e o endereço da foto da conta Google, o identificador da conta Google e a senha protegida. A tela Conta do app mostra seu nome e e-mail, e a sessão fica guardada no próprio aparelho até você sair. O Sacou nunca vê sua senha. No nosso banco de dados guardamos só um identificador interno, o identificador da sua conta no Firebase e a data de criação.

### Perfil

Você escolhe um apelido, sua posição principal, outras posições e, se quiser, o nível em que você se vê (de 1 a 5). Quando você entra com o Google, o app sugere seu primeiro nome como apelido, mas ele só é salvo se você confirmar.

### Grupos e rodadas

Guardamos de quais grupos você participa, seu papel em cada um (administrador, co-administrador, placar ou jogador), se você é mensalista ou avulso e desde quando. Em cada rodada, guardamos sua resposta (vou, não vou), a ordem de chegada na lista e na lista de espera e quando você respondeu. O nome do grupo, o local e o horário da rodada são escritos pelo organizador.

### Partidas e estatísticas

Durante a partida, o celular que marca o placar registra os pontos, quem está em cada time, a rotação e a fila. Se o grupo usar a marcação de quem fez cada ponto, também registramos o autor e o tipo do ponto. A partir disso calculamos suas estatísticas: partidas, vitórias, derrotas, saldo de pontos, sequência de vitórias e vezes em que você foi o destaque do dia. Elas aparecem na sua cartinha e no resumo da rodada.

### Votação do destaque do dia

Depois da rodada, quem jogou pode votar no destaque do dia. O voto é secreto: ninguém, nem o organizador, vê em quem você votou. Só você vê o próprio voto.

### Nível e sorteio dos times

Para sortear times equilibrados, o administrador e o co-administrador do grupo podem dar uma nota de nível a cada membro. Você não vê a nota que recebeu, e os outros jogadores também não. Se o organizador não der nota, o sorteio usa o nível que você mesmo sugeriu no perfil, que os organizadores dos seus grupos podem ver. O Sacou também calcula, a partir dos resultados das partidas, uma estimativa de nível de cada jogador, que no piloto não aparece para ninguém e não decide nada.

> NOTA (E6.2, pergunta 219): a nota do organizador e a estimativa de nível não entram na exportação dos seus dados (pergunta 42); quem pedir acesso a elas é atendido pelo canal da seção 13. O advogado confirma se isso basta para o direito de acesso (LGPD, art. 18, II).

### Convidados sem conta

O organizador pode incluir no grupo uma pessoa que não tem o app, digitando um nome ou apelido e, se quiser, a posição. Esse nome aparece para os membros do grupo e, na página pública da rodada, só o primeiro nome. O convidado pode pedir ao organizador ou ao nosso canal (seção 13) para corrigir ou remover o nome.

### Denúncias

Qualquer membro pode denunciar, dentro do app, o apelido de outro membro ou o nome e o local do grupo, escolhendo um de quatro motivos. Guardamos só quem denunciou, quem ou qual grupo foi denunciado, o motivo e a data, sem nenhum texto e sem cópia do nome. Ninguém do grupo fica sabendo quem denunciou. Usamos a denúncia só para analisar o caso e, se for preciso, mudar o nome ofensivo ou remover a conta, como dizem os Termos de Uso.

### Página da rodada e convite pelo navegador

O organizador pode compartilhar o link de uma rodada. Qualquer pessoa com esse link vê o nome do grupo, a data, o horário, o local, as vagas e os apelidos de quem vai jogar (dos convidados, só o primeiro nome). A prévia que aparece no WhatsApp não mostra apelidos. Quem entra pela página do navegador faz login pelo Firebase, e a sessão fica guardada no próprio navegador até você tocar em Sair.

### Notificações

Se você permitir, o app recebe notificações, por exemplo quando você sai da lista de espera e ganha a vaga. Para isso guardamos o código de notificação do seu celular e a plataforma (Android ou iOS). A notificação leva o nome do grupo, o dia e o horário, sem o local nem nomes de pessoas.

### No seu celular

O app guarda no celular uma cópia dos dados dos seus grupos para funcionar sem internet na quadra, por até 7 dias. Essa cópia é apagada quando você sai da conta. Os pontos marcados na quadra ficam no celular até serem enviados ao servidor, mesmo depois de sair da conta, para não se perderem. O app não faz cópia de segurança desses dados na nuvem do celular.

### Registros técnicos e segurança

Quando o app ou o navegador acessa nossos servidores, o Google Cloud registra o endereço IP, o tipo de navegador ou aparelho e o endereço da página acessada. Usamos isso para manter o serviço funcionando e para evitar abuso. Para limitar abusos, também usamos versões embaralhadas e irreversíveis do seu identificador e do seu IP, só na memória do servidor, por no máximo 1 hora. Os pontos enviados por cada celular são ligados a um código aleatório da instalação do app, que não é o número do aparelho. O servidor guarda esse código ligado a você enquanto a partida existir, e o organizador, o co-organizador e quem marca o placar do grupo conseguem ver de qual aparelho veio cada ponto.

Quando acontece um erro nos nossos servidores ou no app, o Sentry recebe um relatório técnico do erro (do app, também a versão do app e o modelo e o sistema do celular), sem seu identificador, seu IP, seu e-mail ou seu apelido. Esse relatório é apagado em 90 dias.

> NOTA (E6.2): o Sentry está ativo na API (`Sentry.AspNetCore`, E5.2 Parte 1) e no app (`@sentry/react-native`, E5.2 Parte 2), ADR 0080. O Resend (e-mail) não é usado no piloto. O PostHog, a foto da cartinha, o Pix, o resumo com IA e a assinatura ficaram fora do piloto e não entram nesta versão.

## 3. O que não coletamos

- Nome completo, CPF, telefone, endereço, data de nascimento, gênero ou foto.
- Localização do celular.
- Contatos, fotos ou arquivos do celular. Quando você salva a sua cartinha na galeria, o app só grava a imagem, sem ler suas fotos.
- Dados de pagamento. O Sacou não intermedeia dinheiro entre os jogadores.

## 4. Quem vê o quê

- Membros ativos do grupo: o nome do grupo, a configuração e o local das rodadas, quem é membro, apelidos, posições, papéis, presença nas rodadas, placares e estatísticas.
- Qualquer pessoa com o link de uma rodada: os dados da rodada e os apelidos de quem vai jogar, como na seção 2.
- Administradores e co-administradores do grupo: também as notas de nível e o nível que cada membro sugeriu.
- Ninguém: seus votos no destaque do dia, sua senha e a estimativa de nível calculada pelo Sacou.
- Quando você compartilha a sua cartinha ou a lista dos times, ela vai só para o aplicativo que você escolher, como o WhatsApp.

## 5. Com quem compartilhamos

Não vendemos seus dados e não os usamos para publicidade. Usamos prestadores de serviço que tratam os dados só para fazer o Sacou funcionar:

- Google (Firebase Authentication e Google Cloud): login, servidores e registros técnicos.
- Google Cloud Storage, nos Estados Unidos: cópia diária de segurança do banco de dados, guardada por 30 dias.
- Neon, com servidores da Amazon Web Services: banco de dados.
- Sentry, nos Estados Unidos: relatórios de erro dos servidores e do app, sem dados que identifiquem você.
- Expo e Google Firebase Cloud Messaging: entrega das notificações.

> NOTA (E6.2): a cópia diária vai para o Google Cloud Storage em `us-east1` (ADR 0082), não para o Cloudflare R2, que não é usado no piloto. O Resend não é usado no piloto. Lista dos operadores com a fonte da região: seção 4 de `docs/seguranca/lgpd-checklist.md`.

Também podemos fornecer dados quando a lei ou uma ordem judicial exigir.

## 6. Onde seus dados ficam

Nossos servidores e o banco de dados ficam nos Estados Unidos (Google Cloud na região da Virgínia do Norte e Neon na Amazon Web Services, também na Virgínia do Norte). Os prestadores de login e de notificações também podem tratar dados fora do Brasil. Por isso há transferência internacional de dados, que fazemos com prestadores que adotam medidas de segurança e proteção de dados.

> LACUNA (E6.2, sem pergunta nova): hipótese do art. 33 da LGPD para a transferência internacional. A transferência foi aceita no piloto (resposta 91). O advogado indica a base (cláusulas-padrão da ANPD, Resolução CD/ANPD 19/2024, ou outra) e o texto final desta seção. Região do Firebase Authentication e do Expo: EUA, definida por cada provedor (E6.2, seção 4 de `docs/seguranca/lgpd-checklist.md`).

## 7. Por quanto tempo guardamos

- Conta, perfil e notas de nível sobre você: enquanto sua conta existir. Ao excluir a conta, são apagados na hora.
- Histórico das rodadas e partidas, estatísticas e votos: enquanto o grupo existir. Depois que você exclui a conta, esse histórico deixa de mostrar seu apelido e aparece como Ex-jogador.
- Nome de convidado sem conta: até o organizador removê-lo, ou até o grupo ficar sem nenhum membro com conta. Quem nunca mais jogou continua no histórico enquanto o grupo existir.
- Página da rodada no navegador: por enquanto, os apelidos ficam visíveis para quem tem o link enquanto a rodada existir. Passarão a ser escondidos 7 dias depois da rodada.
- Notificações: 30 dias.
- Denúncias: 180 dias. Ao excluir a conta, as denúncias que você fez e as feitas sobre você são apagadas na hora.
- Registros técnicos de acesso: 30 dias.
- Relatórios de erro: 90 dias.
- Cópia no celular: até 7 dias, e é apagada quando você sai da conta. Os pontos marcados que ainda não foram enviados ficam no celular até o envio, mesmo se você excluir a conta. Passarão a ser apagados junto com a conta, no celular que marcou o placar.
- Cópias de segurança do banco: uma cópia por dia, guardada por 30 dias, além de um histórico de restauração de 6 horas. Uma conta excluída depois de uma cópia voltaria se essa cópia fosse restaurada; por isso, até termos como excluí-la de novo, não restauramos cópias com dados de jogadores.
- Depois da exclusão, guardamos só um código irreversível, sem e-mail nem nome, que impede que a conta seja recriada por engano. Por enquanto esse código fica sem prazo; passará a ser apagado 60 dias depois da exclusão.

> LACUNA (E6.2, perguntas 222 a 225): os itens acima dizem o que o código faz hoje e, com "passará a", o prazo decidido, que só vale depois das tarefas E6.3 (reexclusão depois de restaurar a cópia), E6.5 (60 dias do código de exclusão), E6.7 (apelidos escondidos 7 dias depois da rodada) e E6.8 (pontos pendentes apagados na exclusão). A versão 1.0 só é publicada depois delas. Fica para o advogado (pergunta 200): se o Marco Civil da Internet (art. 15, guarda de registros por 6 meses) se aplica a um projeto de pessoa física sem fins econômicos; e o prazo do grupo abandonado, que no piloto fica enquanto existir.

## 8. Por que podemos usar seus dados

- Para prestar o serviço que você pediu ao criar a conta e entrar nos grupos (execução de contrato, art. 7º, V, da LGPD): conta, perfil, grupos, rodadas, partidas, estatísticas, votação, notificações e a página da rodada.
- Por interesse legítimo, nosso e dos grupos (art. 7º, IX): segurança e prevenção de abuso, registros técnicos, notas de nível e estimativa de nível para equilibrar os times, e o nome de convidados sem conta, incluídos pelo organizador para que possam jogar.
- Para cumprir obrigações legais e nos defender em processos, quando for o caso (art. 7º, II e VI).

> LACUNA (pergunta 201): base legal de cada tratamento. Padrão adotado: o acima, sem consentimento como base (por isso o aceite da tela 02 não precisa ser registrado). Pontos para o advogado: nível sugerido e nota do organizador como dado de perfil; o nome do convidado, que é de um terceiro que não aceitou nada; o apelido aberto a quem tem o link da rodada (resposta 126).

## 9. Seus direitos

Você pode, a qualquer momento:

- Ver e corrigir seu apelido, posições e nível sugerido, no seu perfil.
- Baixar seus dados, em Conta, Baixar meus dados.
- Excluir sua conta, em Conta, Excluir conta. A exclusão apaga sua conta, seu perfil e as notas sobre você, e o histórico do grupo passa a mostrar Ex-jogador.
- Sair de um grupo.
- Desligar as notificações nas configurações do celular.
- Pedir informações, revisão de uma decisão, correção ou eliminação de dados, ou reclamar, pelo canal da seção 13. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).

Respondemos aos pedidos em até 15 dias, assim que o canal de contato da seção 13 estiver publicado.

## 10. Segurança

Usamos conexão criptografada, login por um provedor especializado, acesso restrito por grupo e por papel, limites contra abuso e registros sem e-mails, senhas ou códigos de acesso. Nenhum sistema é totalmente seguro: se houver um incidente que possa trazer risco a você, avisaremos você e a ANPD, como manda a lei.

## 11. Idade mínima

O Sacou é para maiores de 18 anos. Se você souber que um menor de idade criou uma conta, avise pelo canal da seção 13.

> LACUNA (pergunta 202): idade mínima. Padrão adotado: 18 anos no piloto, para evitar o art. 14 da LGPD (crianças e adolescentes). O app não pede idade; a regra é declarada nos Termos.

## 12. Mudanças nesta política

Quando esta política mudar, atualizamos a versão e a data no topo. Se a mudança for importante, avisaremos no app antes de ela valer.

## 13. Contato e encarregado

Para qualquer assunto de privacidade, escreva para o encarregado de dados do Sacou: Gabriel, pelo e-mail (endereço a definir antes da versão 1.0). Enquanto o endereço não estiver aqui, o canal de contato ainda não existe.

> LACUNA (pergunta 199): canal do encarregado. Sem domínio no piloto (resposta 125), não existe e-mail `@sacou.com.br`. Padrão recomendado: um e-mail dedicado em provedor gratuito, criado pelo Gabriel (conta nova é decisão dele). A Resolução CD/ANPD 2/2022 dispensa agente de pequeno porte de indicar encarregado, mas exige um canal de comunicação; o advogado confirma se o Sacou se enquadra.

<!-- publicar:fim -->

## Notas de revisão (não publicar)

### Rastreio: cada afirmação e a linha do inventário

Conferir antes do merge da E6.1 e a cada mudança de `docs/seguranca/dados-pessoais.md`.

| Seção da política | Linhas do inventário |
|---|---|
| 2 Conta | "E-mail, senha...", "Dados de conta guardados na API" |
| 2 Perfil | "Perfil do jogador", "Perfil no app" (o primeiro nome só sai se a pessoa confirmar, pergunta 40) |
| 2 Grupos e rodadas | "Vínculo com o grupo", "Nome do grupo", "Configuração do grupo", "Presença, lista de espera e rodada" |
| 2 Partidas e estatísticas | "Eventos da quadra", "Stream da quadra", "Estatísticas, MVP e projeções", "Estatísticas por jogador" |
| 2 Votação | "Votos do MVP do dia", "Cédula do MVP no aparelho" |
| 2 Nível e sorteio | "Nível sugerido", "Nota do membro", "Rating OpenSkill", "Sorteio no aparelho" |
| 2 Convidados | "Convidado sem conta" |
| 2 Denúncias | "Denúncia de conteúdo" (E6.6) |
| 2 Página da rodada e convite | "Perfil do jogador" (resposta 126), "Código do link", "Sessão da página web", "Endereço IP de quem abre a página" |
| 2 Notificações | "Aparelhos do push", "No app (E3.11)", "Notificações e entregas", "Token de push" (serviços externos) |
| 2 No seu celular | "Cache do servidor no aparelho", "Conta dona da sessão da quadra", "Imagem da cartinha" |
| 2 Registros técnicos | "Chave do limite de requisições", "IP, user agent, caminho", "ID do celular no envelope", "Escritor de cada lote", "Erros da API" e "Erros e travamentos do app" (Sentry) |
| 3 O que não coletamos | Colunas travadas por teste de modelo em `identity.users` e `player_profiles`; "Imagem da cartinha" (só escrita na galeria) |
| 5 e 6 Operadores e região | "Região de armazenamento" (topo), "Todos os dados do banco", "Token de push", "Erros da API" e "Erros e travamentos do app" (Sentry), "Cópia do banco" (Google Cloud Storage); seção 4 de `lgpd-checklist.md` |
| 7 Retenção | Coluna "Retenção" de cada linha (E6.2); "Na exclusão"; ADR 0056; 30 dias do Cloud Logging; 30 e 7 dias das notificações; 180 dias das denúncias (E6.6); 90 dias do Sentry; 30 dias da "Cópia do banco"; 60 dias da "Marca de exclusão"; 6 h do Neon |
| 9 Direitos | "Direitos do titular" (exclusão, exportação, Ex-jogador) |

### Pontos que o advogado deve olhar

1. Identificação do controlador (pergunta 198).
2. Canal e encarregado (pergunta 199).
3. Prazos de retenção e Marco Civil (pergunta 200).
4. Bases legais e o convidado sem conta (pergunta 201).
5. Idade mínima (pergunta 202).
6. Transferência internacional, art. 33.
7. Nota do organizador e estimativa de nível fora da exportação (direito de acesso).
8. Prazo de 15 dias para responder (art. 19, II, fala em 15 dias para a declaração completa).
9. Promessa de avisar antes de mudança importante (seção 12): hoje não existe aviso no app; manter a promessa exige uma tarefa nova.
