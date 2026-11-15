# Grupos, membros e papéis

Regras do módulo Groups (E3.2). Decisões e motivos no [ADR 0040](../arquitetura/adr/0040-grupos-membros-papeis-e-autorizacao.md); mapeamento de erros no [ADR 0039](../arquitetura/adr/0039-sacou-http-e-contratos-entre-modulos.md). Nomes no [glossário](glossario.md).

## Modelo

- **Grupo** (`Group`): `GroupId` (UUID v7), nome (`GroupName`) e data de criação. Tem os membros dentro.
- **Nome do grupo:** sem espaços nas pontas; de 1 a 60 caracteres como a pessoa os vê (um emoji conta como um), e no máximo 240 pontos de código (60 emojis de família, com 5 pontos cada, não cabem: 48 cabem); sem quebra de linha, caractere de controle, caractere invisível (espaço de largura zero, marca de ordem de bytes) ou de direção (`U+202E`). O *zero-width joiner* só vale entre emojis (👩‍💻). Também recusa: caractere não atribuído, de uso privado ou *surrogate* solto; os preenchimentos que aparecem como espaço (U+115F, U+1160, U+3164, U+FFA0, U+2800); mais de 4 acentos ou marcas empilhados no mesmo caractere; nome sem nenhuma letra, número ou símbolo ("..."). O texto é normalizado para NFC antes de tudo, então "Vôlei" digitado com o acento separado é gravado igual ao composto. Nome já gravado é mostrado como está, mesmo que a regra fique mais estrita. Pode conter nome de pessoa ("Racha do João"): nunca vai para log.
- **Membro** (`GroupMember`): `MemberId` (um por pessoa por grupo, para sempre), conta (`UserId`, vazio só para o convidado da E3.5), papel, tipo, situação, entrada e saída.
- **Convidado** (`Guest`, E3.5, [ADR 0053](../arquitetura/adr/0053-convidado-sem-conta.md)): um membro comum sem conta, sempre Jogador, avulso e ativo, criado pelo admin ou co-admin (tela 21a). O nome (`GuestName`, a regra do apelido: de 1 a 20 caracteres, até 80 pontos de código) e a posição opcional (uma das 5 concretas, nunca "Qualquer uma") ficam em `groups.guests`, nunca em `groups.members`. Não é único no grupo. Conta nos 300 membros ativos. Nunca vira Placar, Co-admin ou Admin (`groups.role-needs-account`) nem mensalista. Removido, a linha do nome é apagada na hora e o histórico mostra "Ex-jogador". Entrar numa rodada é a rota de presença do admin (E3.4), uma segunda chamada.
- **Papéis** (`GroupRole`): Admin, Co-admin, Placar (`Scorekeeper`), Jogador (`Player`). Um por membro. Vários admins são permitidos.
- **Tipo** (`MemberType`): mensalista (`Regular`) ou avulso (`DropIn`). Convidado é sempre avulso.
- **Situação** (`MembershipStatus`): ativo, saiu (`Left`), removido (`Removed`). A linha nunca é apagada; "Ex-jogador" é como o histórico mostra quem apagou a conta (E3.16), não uma situação daqui.

## Ciclo de vida

- **Criar:** quem cria vira Admin, ativo e avulso. Todo membro novo entra Jogador e avulso; o admin marca mensalista.
- **Sair:** qualquer membro sai (`POST .../leave`); a linha fica, marcada como "saiu", com o papel que tinha, e a pessoa passa a receber o 404 de não membro. Quem saiu e volta pelo link recupera o mesmo `MemberId`, sempre como Jogador e avulso.
- **Remover:** Admin e Co-admin removem Placar e Jogador; só o Admin remove Co-admin ou outro Admin. Ninguém remove a si mesmo (`groups.use-leave`): usa "sair". A linha fica, marcada como "removido". Quem foi removido não volta pelo link (decisão do Gabriel, pergunta 19).
- **Mudar papel:** Admin e Co-admin trocam entre Placar e Jogador quem não é admin; dar ou tirar Admin ou Co-admin é só do Admin (pergunta 16). O Co-admin também não rebaixa a si mesmo; sai, se quiser. O Admin pode se rebaixar se houver outro Admin. Pôr o papel que o membro já tem é sucesso sem mudança.
- **Entrar pelo link:** quem tem um link válido e está registrado entra na hora, sem aprovação (pergunta 18), como Jogador e avulso. Quem já é membro ativo recebe 200 com o mesmo `MemberId` e não conta uso. Quem saiu volta com o mesmo `MemberId`, como Jogador e avulso, com a data de entrada da volta: papel e tipo nunca são restaurados, então um ex-admin nunca volta admin. Quem foi removido não volta pelo link (`groups.member-removed`, pergunta 19). Antes de entrar, a prévia mostra o nome do grupo, quantos membros ativos tem e se a pessoa já está nele.
- **Mensalista × avulso:** Admin e Co-admin mudam o tipo de qualquer membro ativo, inclusive de admins. Convidado sem conta (E3.5) é sempre avulso (`groups.regular-needs-account`).
- **Último admin:** o único Admin ativo não sai nem é rebaixado (`groups.last-admin`); o app pede para promover alguém antes. Nenhuma promoção automática. Co-admin não conta como admin.
- **Excluir a conta (E3.16, [ADR 0056](../arquitetura/adr/0056-conta-exportacao-e-exclusao.md), D3):** bloqueia quando a pessoa é o único Admin ativo de um grupo que tem outro membro ativo **com conta** (Co-admin conta como "outro membro", não como admin). A tela 30b lista esses grupos (`GET /v1/me/deletion-blockers`) e oferece "Escolher outro admin". Sozinha, só com convidados ou só com ex-membros, nada bloqueia. Nenhuma promoção automática.
- **Ordem das conferências** em toda escrita de membro: quem age (ainda ativo? senão, o 404 de não membro), o alvo (ativo neste grupo? senão, `groups.member-not-found`), a permissão para aquele alvo e valor (`groups.forbidden`), o valor (igual ao atual: sucesso sem mudança) e, por último, o último admin. Quem age é julgado pelo que o banco diz **sob a trava do grupo**, não pelo que o filtro leu antes: quem perdeu o papel no meio do caminho recebe 403.

## Permissões

Decisão do Gabriel (pergunta 16, 09/11/2026): o Co-admin faz o dia a dia, mas não mexe em quem é Admin ou Co-admin. Fonte em código: `RolePermissions`; teste com esta tabela escrita à mão (4 papéis × 13 permissões). `ManageSettings` (E3.3) é do Co-admin também, pelo padrão adotado da pergunta 23; ver a configuração é `ViewGroup`, então o jogador vê "25 pontos · 1 set".

| Permissão (`GroupPermission`) | Admin | Co-admin | Placar | Jogador |
|---|---|---|---|---|
| `ViewGroup` (detalhe e lista de membros) | sim | sim | sim | sim |
| `RenameGroup` | sim | sim | não | não |
| `ManageInvites` (criar, listar, revogar) | sim | sim | não | não |
| `ChangeMemberType` (mensalista × avulso) | sim | sim | não | não |
| `AssignBasicRole` (dar ou tirar Placar/Jogador de quem não é admin) | sim | sim | não | não |
| `AssignAdminRole` (promover a Co-admin/Admin, rebaixar Co-admin/Admin) | sim | não | não | não |
| `RemoveMember` (remover Placar ou Jogador) | sim | sim | não | não |
| `RemoveAdmin` (remover Co-admin ou Admin) | sim | não | não | não |
| `Leave` (sair do grupo) | sim* | sim | sim | sim |
| `ManageSettings` (mudar a configuração padrão, aplicar e salvar modelos) | sim | sim | não | não |
| `ManageRounds` (criar, editar e cancelar rodada, parar a série, mexer na lista de presença; E3.4) | sim | sim | não | não |
| `RespondAttendance` (responder "vou" ou "não vou" por si; E3.4) | sim | sim | sim | sim |
| `ManageMemberLevels` (ver e dar a nota de cada membro e ver a sugestão dele; E3.17, [perfil-e-nota.md](perfil-e-nota.md)) | sim | sim | não | não |
| `ManageGuests` (adicionar e corrigir convidado sem conta; E3.5) | sim | sim | não | não |

\* Recusado se for o último Admin ativo. O Placar não ganha poder nenhum no grupo: o que ele faz na quadra é da E3.7 e da E3.8.

**Quem não é membro** (nunca entrou, saiu ou foi removido) recebe sempre o mesmo 404 de um grupo que não existe, em toda rota do grupo. Membro sem a permissão recebe 403.

## Limites

| Limite | Valor | Erro |
|---|---|---|
| Membros ativos por grupo | 300 | `groups.member-limit` |
| Grupos ativos por pessoa | 100 | `groups.membership-limit` |
| Convites válidos por grupo (revogado e expirado não contam) | 20 | `groups.invite-limit` |
| Modelos salvos por grupo (teto técnico; o limite do plano grátis é da E3.15) | 20 | `groups.template-limit` |

## Rotas

| Rota | Permissão | Sucesso |
|---|---|---|
| `POST /v1/groups` `{ name, templateKey? }` | Usuário registrado | 201 `{ groupId, memberId }`; sem `templateKey`, o grupo nasce `do-zero` |
| `GET /v1/groups` | Usuário registrado | 200 `[{ groupId, name, role, memberType }]`, só ativos, na ordem de entrada |
| `GET /v1/groups/{groupId}` | `ViewGroup` | 200 `{ groupId, name, memberId, role, memberType, activeMembers }` |
| `PATCH /v1/groups/{groupId}` `{ name }` | `RenameGroup` | 200 `{ groupId, name }` |
| `GET /v1/groups/{groupId}/members` | `ViewGroup` | 200 `[{ memberId, role, memberType, hasAccount, isMe, joinedAt, nickname, primaryPosition, otherPositions }]`, só ativos; sem perfil, `nickname` e `primaryPosition` nulos e `otherPositions` `[]` (E3.17); o convidado vem com `hasAccount: false`, o nome em `nickname` e a posição dele (E3.5). `Cache-Control: no-store` |
| `PUT /v1/groups/{groupId}/members/{memberId}/role` `{ role }` | `AssignBasicRole` no filtro; `AssignAdminRole` no agregado quando o alvo ou o papel novo é Admin ou Co-admin | 200 `{ memberId, role }` |
| `PUT /v1/groups/{groupId}/members/{memberId}/type` `{ memberType }` | `ChangeMemberType` | 200 `{ memberId, memberType }` |
| `DELETE /v1/groups/{groupId}/members/{memberId}` | `RemoveMember` no filtro; `RemoveAdmin` no agregado quando o alvo é Admin ou Co-admin | 204; com um convidado, a linha do nome é apagada na mesma transação |
| `POST /v1/groups/{groupId}/guests` `{ requestId, name, primaryPosition?, level? }` | `ManageGuests` (e `ManageMemberLevels` com `level`) | 201 `{ memberId }`; o mesmo `requestId` no mesmo grupo dá 200 com o mesmo `memberId`, sem mudar nada |
| `PUT /v1/groups/{groupId}/guests/{memberId}` `{ name, primaryPosition }` | `ManageGuests` | 200 `{ memberId, name, primaryPosition }`, com `Cache-Control: no-store`; os dois campos são obrigatórios e `primaryPosition: null` limpa a posição |
| `POST /v1/groups/{groupId}/leave` | `Leave` | 204 |
| `POST /v1/groups/{groupId}/invites` | `ManageInvites` | 201 `{ inviteId, token, expiresAt }`, a única vez que o token sai |
| `GET /v1/groups/{groupId}/invites` | `ManageInvites` | 200 `[{ inviteId, createdAt, createdBy, expiresAt, useCount }]`, só os válidos, do mais antigo ao mais novo |
| `DELETE /v1/groups/{groupId}/invites/{inviteId}` | `ManageInvites` | 204, também para um link já revogado ou expirado |
| `GET /v1/groups/{groupId}/settings` | `ViewGroup` | 200 `{ schemaVersion, settings, templateKey, savedTemplateId, updatedAt }` |
| `PATCH /v1/groups/{groupId}/settings` `{ settings }` | `ManageSettings` | 200, o mesmo corpo. `settings` é uma camada parcial (com `schemaVersion`); `null` numa folha é 400 |
| `POST /v1/groups/{groupId}/settings/apply-template` `{ templateKey }` ou `{ savedTemplateId }` | `ManageSettings` | 200, o mesmo corpo; os dois ids, ou nenhum, é 400 |
| `GET /v1/groups/{groupId}/templates` | `ManageSettings` | 200 `[{ templateId, name, createdAt }]`, do mais antigo ao mais novo |
| `POST /v1/groups/{groupId}/templates` `{ name }` | `ManageSettings` | 201 `{ templateId, name, createdAt }`, o retrato dos campos que não são fato |
| `DELETE /v1/groups/{groupId}/templates/{templateId}` | `ManageSettings` | 204; a segunda vez e o modelo de outro grupo dão 404 |
| `GET /v1/groups/{groupId}/member-levels` | `ManageMemberLevels` | 200 `[{ memberId, adminLevel, reviewed, suggestedLevel }]`, um por membro ativo, na ordem de entrada (E3.17) |
| `PUT /v1/groups/{groupId}/member-levels/{memberId}` `{ level }` | `ManageMemberLevels` | 200 `{ memberId, adminLevel, reviewed: true }`; `level` nulo é "Não sei" |
| `PUT /v1/groups/{groupId}/member-levels` `{ levels: [{ memberId, level }] }` | `ManageMemberLevels` | 200 `[{ memberId, adminLevel, reviewed: true }]`, na ordem do pedido; de 1 a 50 itens, tudo ou nada |
| `POST /v1/invites/preview` `{ token }` | Usuário registrado | 200 `{ groupName, activeMembers, alreadyMember }` |
| `POST /v1/invites/accept` `{ token }` | Usuário registrado | 201 `{ groupId, memberId }` (entrou ou voltou) ou 200 (já era membro ativo) |

As escritas de membro (papel, tipo, remover, sair) rodam numa transação que trava a linha do grupo (`FOR UPDATE`), carrega o grupo inteiro e aplica a regra: duas escritas no mesmo grupo nunca passam juntas pela regra do último admin (ADR 0040, D8). `role` e `memberType` são obrigatórios no corpo; faltar, `null`, número, valor desconhecido ou dois valores com vírgula dão 400.

A configuração (E3.3, [ADR 0041](../arquitetura/adr/0041-configuracao-herdada-e-modelos.md)) mora em `groups.group_settings` (uma linha por grupo, `jsonb` com `schemaVersion`) e os modelos salvos em `groups.saved_templates`. Toda escrita de configuração ou de modelo roda numa transação que trava a linha de `group_settings` (`FOR UPDATE`, criada antes para um grupo antigo que não tenha), confere sob a trava que quem age ainda é membro ativo com `ManageSettings` e só então aplica a mudança: o `PATCH` é parcial e mesclado sob a trava, então dois admins mexendo em blocos diferentes não perdem a mudança um do outro, e o teto de 20 modelos não estoura por corrida. O modelo salvo é sempre buscado por `(group_id, id)`. A resposta nunca traz quem mudou nem quem criou.

## Convite por link e QR

O QR do grupo (tela 19) é o mesmo link do convite, desenhado no app (E4.5); a API não gera imagem. O link vale até ser revogado (pergunta 17) e serve para muitas pessoas. O token tem 43 caracteres e só aparece na resposta que cria o convite: o app guarda o link que gerou; noutro aparelho, gera outro. A prévia e o aceite recebem o token no corpo, nunca no endereço; o link público leva o token depois do `#` (E4.16). Revogado, expirado, inexistente ou malformado dão a mesma resposta (`groups.invite-invalid`). Quando quem criou o link sai, é removido ou vira Placar ou Jogador, os links dele morrem na mesma hora; o Admin que vira Co-admin mantém os seus. Revogação, aceite e mudanças de membros passam pela mesma trava do grupo: um aceite nunca conta uso depois da revogação.

Papéis e tipos saem como texto: `admin`, `coAdmin`, `scorekeeper`, `player`; `regular`, `dropIn`. Desde a E3.17, a lista de membros tem o apelido e as posições do perfil da pessoa, lidos do Identity numa consulta só (`Identity.Contracts.IPlayerProfiles`), e nunca nível de nenhum tipo, para nenhum papel ([perfil-e-nota.md](perfil-e-nota.md)).

## Códigos de erro

Todo erro sai em `ProblemDetails` com a extensão `code`; o app mostra o texto pt-BR por código.

| Código | Status | Quando |
|---|---|---|
| `identity.user-not-registered` | 403 | Login válido, mas a pessoa nunca chamou `POST /v1/me` |
| `groups.name-invalid` | 400 | Nome fora da regra |
| `groups.group-not-found` | 404 | Grupo inexistente ou de quem não é membro ativo |
| `groups.forbidden` | 403 | Membro sem a permissão |
| `groups.membership-limit` | 409 | A pessoa já está em 100 grupos ativos |
| `groups.member-limit` | 409 | O grupo já tem 300 membros ativos |
| `groups.member-not-found` | 404 | O alvo não é membro ativo deste grupo: inexistente, de outro grupo, saiu ou foi removido, todos iguais; na correção de convidado, também um membro com conta |
| `groups.last-admin` | 409 | A mudança deixaria o grupo sem Admin ativo |
| `groups.use-leave` | 400 | Remover a si mesmo; o caminho é "sair" |
| `groups.regular-needs-account` | 400 | Mensalista sem conta (convidado, E3.5) |
| `groups.invite-limit` | 409 | O grupo já tem 20 convites válidos |
| `groups.invite-not-found` | 404 | O convite a revogar não é deste grupo: de outro grupo e inexistente são iguais |
| `groups.invite-invalid` | 404 | Link revogado, expirado, inexistente ou malformado, todos iguais |
| `groups.member-removed` | 403 | Quem foi removido tenta voltar pelo link |
| `groups.settings-invalid` | 400 | Camada ou corpo fora do catálogo (folha desconhecida, tipo ou faixa errada, `null`, texto inválido, JSON malformado); a resposta não diz o caminho |
| `groups.template-not-found` | 400 / 404 | Criar grupo com chave desconhecida (400); aplicar ou apagar modelo inexistente ou de outro grupo (404) |
| `groups.template-name-invalid` | 400 | Nome do modelo fora de 1 a 40 caracteres visíveis |
| `groups.template-limit` | 409 | O grupo já tem 20 modelos salvos |
| `groups.level-invalid` | 400 | Nota fora da escala (1,0 a 5,0 de meio em meio ponto), lote vazio, com mais de 50 itens ou com membro repetido (E3.17) |
| `groups.guest-name-invalid` | 400 | Nome do convidado fora da regra do apelido (E3.5) |
| `groups.guest-invalid` | 400 | Posição do convidado fora das 5, ou `requestId` zerado (E3.5) |
| `groups.role-needs-account` | 400 | Papel diferente de Jogador para um convidado sem conta (E3.5) |
