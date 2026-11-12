# Inventário de dados pessoais (LGPD)

Registra o que os documentos preveem. Desde a E3.1, a API guarda o UID do Firebase de quem entra, em `identity.users` (linha "Dados de conta guardados na API"); desde a E3.2, o módulo Groups guarda o vínculo pessoa × grupo e o nome do grupo, no schema `groups` (linhas "Vínculo com o grupo", "Nome do grupo" e "Convite") e, desde a E3.3, a configuração do grupo e os modelos salvos (linha "Configuração do grupo e modelos salvos"). No aparelho, o log local da quadra (E4.9, [ADR 0038](../arquitetura/adr/0038-log-local-da-quadra.md)) já grava os eventos (só IDs) e o `deviceId` em SQLite. Os demais dados não são coletados nem guardados ainda; o único outro código que já toca um deles é o gerador puro do Pix (E1.4), que recebe a chave e não a guarda nem registra; o parser do envelope (E2.1), que confere o formato do ID do celular e não o guarda nem registra; e o motor da partida (M2, em TS e no porte C# da E2.10), que lê `MemberId` nos eventos e, com os aplicadores, os comandos e as estatísticas, só o mantém em memória ou o devolve no evento emitido, sem gravar nem registrar. Decisões no [ADR 0012](../arquitetura/adr/0012-personal-data-member-id.md).

**Pendências do Gabriel, em [`perguntas.md`](../estado/perguntas.md):**

- **Retenção e base legal: a definir** (item 2), para todas as linhas abaixo, inclusive backups. Por isso as tabelas não têm essas colunas preenchidas.
- **Encarregado de dados: a definir** (item 3). `produto.md:372` exige o canal, mas não diz quem é nem o contato.
- **Provedor de IA do resumo: a definir** (item 4), só depois do piloto (ADR 0046).
- **Fora do piloto** (ADR 0046): foto e denúncia, resumo com IA, Pix e "já paguei", assinatura dos planos e PostHog. As linhas ficam abaixo para quando voltarem.
- **Região de armazenamento de cada serviço e transferência internacional:** nenhum documento define; a definir na E6.2.

## Conta e perfil

| Dado | Onde fica | Por quê | Fonte | Na exclusão |
|---|---|---|---|---|
| E-mail, senha gerida pelo provedor, identificador Google ou Apple | Firebase Auth | Login | `decisoes.md:19` | Usuário apagado no Firebase (`produto.md:371`) |
| Dados de conta guardados na API: `identity.users` com `id` interno (UUID v7), `firebase_uid` (UID do Firebase: identificador online, pseudônimo, ligado ao e-mail no Firebase) e `created_at`. **Nada mais:** nem e-mail, `email_verified`, nome, foto, provedor, IP, horário do último login ou token. Um teste de modelo trava as 3 colunas. Logs não levam UID, e-mail nem token (só a categoria da recusa) | Postgres (Neon) | Vincular a conta do Firebase ao usuário interno e, na E3.2, aos `MemberId` | `produto.md:250, 259`; [ADR 0036](../arquitetura/adr/0036-verificacao-do-token-e-usuario.md) | A E3.16 apaga a linha e o usuário no Firebase, e impede que um token ainda válido (até 1 h) recrie a conta |
| Apelido. **Perfil único da pessoa, no Identity (E3.17):** não há apelido por grupo, e a E3.2 não guarda nome | Postgres (Neon) | Identificar nas listas e times | `produto.md:63` | Perfil apagado; histórico como "Ex-jogador" (`produto.md:371`) |
| Posições | Postgres (Neon) | Sorteio e escalação | `produto.md:63` | Perfil apagado |
| Nível sugerido pelo jogador (perfil, E3.17) | Postgres (Neon) | Sugestão para o admin; privado | `decisoes.md:16`, ADR 0047 | Perfil apagado |
| Nota do membro definida pelo Admin ou Co-admin, por grupo (E3.17), com quem definiu (`MemberId`) | Postgres (Neon) | Sorteio; **o jogador não vê** (ADR 0047) | `decisoes.md:16`, ADR 0047 | A definir na E3.16 |
| Rating OpenSkill (μ e σ, quadra e areia, E3.9) | Postgres (Neon), projeção | Calibrar o sorteio; **ninguém vê no piloto** (ADR 0047) | `decisoes.md:16` | Projeções de rating a definir na E3.16 |
| Preferência de mostrar nível e foto; consentimento | Postgres (Neon) | Cartinha | `decisoes.md:16`; `produto.md:373` | A definir na E3.16 |
| Foto da cartinha (recorte, WebP sem EXIF) | Cloudflare R2 | Cartinha | `decisoes.md:18` | Foto apagada (`produto.md:371`) |
| Denúncia de foto | A definir na E3.14 | Moderação | `produto.md:374` | A definir na E3.14 |

## Grupo e rodada

| Dado | Onde fica | Por quê | Fonte | Na exclusão |
|---|---|---|---|---|
| Vínculo com o grupo, papel, mensalista ou avulso (`MemberId`): `groups.members` com `id` (o `MemberId`, UUID v7), `group_id`, `user_id` (o `UserId` interno, nunca o UID do Firebase; vazio só para o convidado da E3.5), `role`, `member_type`, `status`, `joined_at` e `left_at`. **Nada mais:** nem nome, apelido, e-mail ou foto; um teste de modelo trava as colunas. Sem FK para `identity.users`. As respostas não levam `userId` nem `sub` (só `hasAccount` e `isMe`), e os logs não levam `userId`, `sub` nem nome. Revela de quais grupos a pessoa participa e desde quando, o que só os membros ativos do grupo veem | Postgres (Neon) | Organização e autorização (E3.2, [ADR 0040](../arquitetura/adr/0040-grupos-membros-papeis-e-autorizacao.md)) | `decisoes.md:10, 28` | **E3.16:** `user_id` vira nulo e `status` fica `left`; o `MemberId` continua nos eventos, exibido como "Ex-jogador" (`decisoes.md:28`); convites criados pela pessoa são revogados |
| Nome do grupo (`groups.groups.name`): texto livre do admin, que pode conter nome de pessoa ("Racha do João"); tratado como potencialmente pessoal. Só membros ativos o veem, e a prévia do convite o mostra a quem tem um link válido (só o nome e o número de membros ativos). Nunca em log (`GroupName.ToString` não o mostra; teste L1) | Postgres (Neon) | Identificar o grupo | E3.2 | A definir na E3.16 (grupo sem admin) e na E6.2 |
| Convite (`groups.invites`): autoria pelo `MemberId` de quem criou (`created_by_member_id`, nunca o `UserId`), criação, validade, revogação e contagem de usos (`use_count`, um número, sem dizer quem entrou). A lista de convites mostra o autor só aos admins e co-admins do grupo. O token é segredo de acesso, não dado pessoal: o banco guarda só o SHA-256, e nem token nem hash vão a log nem a outra resposta além da criação (testes M11, P6 e L1). O log do aceite leva só o resultado e o `inviteId` | Postgres (Neon) | Entrar no grupo pelo link ou QR | E3.2 | Convites da pessoa revogados (E3.16) |
| Configuração do grupo e modelos salvos (`groups.group_settings`, `groups.saved_templates`, E3.3): o documento `jsonb` traz dia fixo, horário e **local** do racha (`schedule.venue`, texto livre que pode identificar alguém ou um endereço), limite de vagas e valores em dinheiro (escolhas do grupo, não de uma pessoa); o **nome do modelo salvo** também é texto livre. Autoria só por `MemberId` (`updated_by_member_id`, `created_by_member_id`), que nenhuma resposta devolve. Só membros ativos veem a configuração; só quem tem `ManageSettings` lista os modelos. Nunca em log (`GroupSettings.ToString`, `SettingsLayer.ToString` e `TemplateName.ToString` não mostram o conteúdo; a linha corrompida no banco é logada só com o `groupId`; testes L1 e P5). Limite de 8 KiB por documento no banco e 4 KB por corpo | Postgres (Neon) | Padrões do grupo para as rodadas (ADR 0041) | E3.3 | A definir na E3.16 (o local e o nome do modelo ficam com o grupo) e na E6.2 |
| Convidado sem conta (nome informado pelo admin) | Postgres (Neon) | Incluir quem não instalou | `produto.md:64, 224` | Sem conta para excluir: pedido e aviso a definir na E3.5 e na E6.2 |
| Cache do servidor no aparelho (`sacou-cache.db`, E4.2): as respostas de `GET /v1/groups`, `GET /v1/groups/{id}` e `GET /v1/groups/{id}/members`, ou seja, nome do grupo, papel e tipo de quem usa o app, número de membros ativos e, por membro, `MemberId`, papel, tipo, `hasAccount`, `isMe` e data de entrada (depois da E3.17, os apelidos). **Nunca:** o ID token nem cabeçalho, `userId` (`["me"]` fica fora), convites e o token de convite, mutações, erros, nível ou rating (lista de permissão, testes P6 e Q5). Sem criptografia, no sandbox do app, com backup desligado (`allowBackup: false`) | expo-sqlite no aparelho, arquivo separado do `sacou.db` da quadra | Uso offline, sobretudo na quadra sem sinal ([ADR 0042](../arquitetura/adr/0042-contrato-openapi-e-cliente.md), Parte 2) | E4.2; pergunta 20 | Validade de 7 dias; descartado em troca de versão do app ou do contrato; apagado no logout e na sessão expirada (`clearSession`, E4.3) e na exclusão de conta (E3.16); um 404 do grupo o remove |
| Presença e lista de espera | Postgres (Neon) | Rodada | `produto.md:64` | Histórico como "Ex-jogador" |
| Eventos da quadra | Postgres (Neon) e expo-sqlite no aparelho | Placar, fila, desfazer. **Objetivo: só IDs, nenhum dado pessoal.** O código já impõe isso para `MatchStarted`, `PointScored`, `SetEnded` e `MatchEnded` (E2.2: esquema fechado, só UUID e valores fixos, com `MemberId` em `teams` e, desde a E2.3, em `rotations.*.lineup`, sempre contido em `teams`; desde a E2.11, a função de líbero também fica associada ao `MemberId`, em `rotations.*.libero` e no `LineupChanged`, só com o ID e os índices das vagas; desde a E2.6, a fila da quadra, em `MatchStarted.queue` e no `QueueChanged`, só com `MemberId` em UUID, sem nome, nível nem horário de chegada: revela quem está na rodada e esperando, o que os times já mostram, e a ordem da fila. A ordem de chegada e o sorteio do critério de saída entram só no comando, nunca no evento, e o nível nunca entra na decisão; desde a E2.8, o autor e o tipo de cada ponto, no `PointAttributed`, só com o `MemberId` do autor, o `eventId` do ponto e um tipo de lista fechada: é dado de desempenho da pessoa, que alimenta estatísticas, resumo e cartinha, e é gravado só quando alguém responde "De quem foi?", com o grupo Pro e a opção ligada (E3.7)). Ressalva: `rulesVersion` é inteiro livre até 2^53−1 no parser, e a E3.7 confere a versão na escrita. Os 8 tipos do M2 têm parser fechado em TS e C#; um `type` desconhecido tem payload aberto e só é recusado no replay, então a E3.7 nunca grava sem simular (lista 3.1, item 3, de `modelo-de-ameacas.md`) | `decisoes.md:26, 28`; `decisoes.md:29` | Eventos ficam; apontam para `MemberId` |
| ID do celular no envelope do evento (`deviceId`): identificador online, tratado como potencialmente pessoal. UUID aleatório por instalação, gerado fora do motor (E4.9, `expo-crypto` `randomUUID`, gravado na tabela `device` do SQLite local), pseudônimo e sem vínculo com o hardware: nunca IMEI, Android ID, `identifierForVendor` ou token de push. Autoria não entra no evento. O backup do aparelho poderia copiá-lo para outro celular (mitigação no `modelo-de-ameacas.md`) | Postgres (Neon) e expo-sqlite | Ordem e sincronização | `decisoes.md:26`; ADR 0022 | A definir na E6.2 (se identifica a pessoa) |
| Estatísticas, MVP e projeções | Postgres (Neon) | Cartinha, ranking e resumo | `revisao-mvp.md:111` | Histórico como "Ex-jogador" |
| Estatísticas por jogador derivadas dos eventos da quadra (E2.9): partidas, vitórias, derrotas, saldo +/− em quadra, sequência de vitórias e pontos por tipo, por `MemberId` | Só em memória: calculadas no motor a partir dos eventos, sem gravar nem registrar; quando a E3.9 as projetar no servidor, valem as linhas acima | Resumo, Story e cartinha. Só `MemberId` e inteiros, sem nome; é dado de desempenho da pessoa, derivado do autor de cada ponto e de quem estava em quadra | `decisoes.md:15`; ADR 0032 | Recalculadas dos eventos, que apontam para `MemberId` |
| Votos do MVP do dia (E3.18): quem votou e em quem, só por `MemberId`; secretos, nem o admin vê (ADR 0048) | Postgres (Neon) | Apurar o MVP | `decisoes.md:15`, ADR 0048 | A definir na E3.16 e na E3.18 |
| Resumo da rodada com IA | A definir na E3.13 | Compartilhar | `produto.md:70` | A definir na E3.13 |

## Pagamentos

| Dado | Onde fica | Por quê | Fonte | Na exclusão |
|---|---|---|---|---|
| Chave Pix do organizador, que pode ser um dado pessoal | Postgres (Neon), criptografada | Gerar o copia e cola (gerador puro na E1.4: não guarda nem registra a chave, e erro só leva código). O código gerado contém a chave: nunca vai para log, evento, telemetria ou URL, e quem o recebe vê a chave, o que é inerente ao Pix e deve constar no aviso de privacidade (E3.10) | `produto.md:65, 375` | A definir na E3.16 |
| "Já paguei", confirmação e quem marcou | Postgres (Neon) | Controle do racha | `produto.md:65` | A definir na E3.16 |
| Assinatura dos planos | RevenueCat e lojas | Cobrança | `decisoes.md:20` | A definir na E3.15 e na E3.16 |

## Serviços externos

| Dado | Onde fica | Por quê | Fonte | Na exclusão |
|---|---|---|---|---|
| Token de push | Expo Push; onde a API guarda: a definir na E3.11 | Notificações | `decisoes.md:25` | A definir na E3.16 |
| E-mail do destinatário e conteúdo | Resend | E-mail transacional | `decisoes.md:31` | A definir na E6.2 |
| Erros e contexto técnico | Sentry | Observabilidade. Logs sem e-mails nem tokens (`produto.md:375`) | `decisoes.md:31` | A definir na E5.2 e na E6.2 |
| Eventos de uso; identificador: a definir na E5.2 | PostHog | Medir o portão da Fase 2 (`revisao-mvp.md:132`) | `decisoes.md:31` | A definir na E5.2 e na E6.2 |
| Dados enviados ao resumo com IA | Provedor a definir (`perguntas.md`, item 4) | Gerar o texto | `produto.md:70` | A definir na E3.13 |
| Cópia do banco | Cloudflare R2 (backup diário) | Restauração | `decisoes.md:31` | A definir na E5.3 e na E6.2 (`perguntas.md`, item 2) |
| IP e logs de acesso | API e Railway, limite de requisições, Firebase Auth, Sentry e o que Cloudflare e R2 registrarem | Segurança e operação | Revisão do M1 | Retenção e conteúdo a definir na E5.2 e na E6.2 (`perguntas.md`, item 2) |
| Autor e e-mail em commits e logs da CI, só de desenvolvedores | GitHub, repositório privado | Histórico e auditoria | Revisão do M1 | Não se aplica a jogadores |

## Direitos do titular

- **Exclusão:** dentro do app; apaga perfil, foto e usuário no Firebase; o histórico fica como "Ex-jogador" (`produto.md:371`, E3.16). O que restar em R2, backups e terceiros é conferido na E6.2.
- **Exportação:** prevista (`decisoes.md:28`); formato a definir na E3.16.
- **Ex-jogador:** o `MemberId` continua nos eventos. Se isso ainda é dado pessoal, e por quanto tempo: a definir na E6.2, com o item 2 de `perguntas.md`.
