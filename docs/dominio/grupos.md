# Grupos, membros e papéis

Regras do módulo Groups (E3.2). Decisões e motivos no [ADR 0040](../arquitetura/adr/0040-grupos-membros-papeis-e-autorizacao.md); mapeamento de erros no [ADR 0039](../arquitetura/adr/0039-sacou-http-e-contratos-entre-modulos.md). Nomes no [glossário](glossario.md).

## Modelo

- **Grupo** (`Group`): `GroupId` (UUID v7), nome (`GroupName`) e data de criação. Tem os membros dentro.
- **Nome do grupo:** sem espaços nas pontas; de 1 a 60 caracteres como a pessoa os vê (um emoji conta como um), e no máximo 240 pontos de código (60 emojis de família, com 5 pontos cada, não cabem: 48 cabem); sem quebra de linha, caractere de controle, caractere invisível (espaço de largura zero, marca de ordem de bytes) ou de direção (`U+202E`). O *zero-width joiner* só vale entre emojis (👩‍💻). Também recusa: caractere não atribuído, de uso privado ou *surrogate* solto; os preenchimentos que aparecem como espaço (U+115F, U+1160, U+3164, U+FFA0, U+2800); mais de 4 acentos ou marcas empilhados no mesmo caractere; nome sem nenhuma letra, número ou símbolo ("..."). O texto é normalizado para NFC antes de tudo, então "Vôlei" digitado com o acento separado é gravado igual ao composto. Nome já gravado é mostrado como está, mesmo que a regra fique mais estrita. Pode conter nome de pessoa ("Racha do João"): nunca vai para log.
- **Membro** (`GroupMember`): `MemberId` (um por pessoa por grupo, para sempre), conta (`UserId`, vazio só para o convidado da E3.5), papel, tipo, situação, entrada e saída.
- **Papéis** (`GroupRole`): Admin, Co-admin, Placar (`Scorekeeper`), Jogador (`Player`). Um por membro. Vários admins são permitidos.
- **Tipo** (`MemberType`): mensalista (`Regular`) ou avulso (`DropIn`). Convidado é sempre avulso.
- **Situação** (`MembershipStatus`): ativo, saiu (`Left`), removido (`Removed`). A linha nunca é apagada; "Ex-jogador" é como o histórico mostra quem apagou a conta (E3.16), não uma situação daqui.

## Ciclo de vida

- **Criar:** quem cria vira Admin, ativo e avulso. Todo membro novo entra Jogador e avulso; o admin marca mensalista.
- **Sair e voltar** (parte 2 e 3): quem saiu e volta pelo link recupera o mesmo `MemberId`, sempre como Jogador. Quem foi removido não volta pelo link (decisão do Gabriel, pergunta 19).
- **Último admin** (parte 2): o único Admin ativo não sai nem é rebaixado; o app pede para promover alguém antes.

## Permissões

Decisão do Gabriel (pergunta 16, 09/11/2026): o Co-admin faz o dia a dia, mas não mexe em quem é Admin ou Co-admin. Fonte em código: `RolePermissions`; teste com esta tabela escrita à mão.

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

\* Recusado se for o último Admin ativo. O Placar não ganha poder nenhum no grupo: o que ele faz na quadra é da E3.7 e da E3.8.

**Quem não é membro** (nunca entrou, saiu ou foi removido) recebe sempre o mesmo 404 de um grupo que não existe, em toda rota do grupo. Membro sem a permissão recebe 403.

## Limites

| Limite | Valor | Erro |
|---|---|---|
| Membros ativos por grupo | 300 | `groups.member-limit` |
| Grupos ativos por pessoa | 100 | `groups.membership-limit` |
| Convites ativos por grupo | 20 | `groups.invite-limit` (parte 3) |

## Rotas da parte 1

| Rota | Permissão | Sucesso |
|---|---|---|
| `POST /v1/groups` `{ name }` | Usuário registrado | 201 `{ groupId, memberId }` |
| `GET /v1/groups` | Usuário registrado | 200 `[{ groupId, name, role, memberType }]`, só ativos, na ordem de entrada |
| `GET /v1/groups/{groupId}` | `ViewGroup` | 200 `{ groupId, name, memberId, role, memberType, activeMembers }` |
| `PATCH /v1/groups/{groupId}` `{ name }` | `RenameGroup` | 200 `{ groupId, name }` |
| `GET /v1/groups/{groupId}/members` | `ViewGroup` | 200 `[{ memberId, role, memberType, hasAccount, isMe, joinedAt }]`, só ativos |

Papéis e tipos saem como texto: `admin`, `coAdmin`, `scorekeeper`, `player`; `regular`, `dropIn`. A lista de membros não tem nome (o perfil é da E3.17).

## Códigos de erro

Todo erro sai em `ProblemDetails` com a extensão `code`; o app mostra o texto pt-BR por código.

| Código | Status | Quando |
|---|---|---|
| `identity.user-not-registered` | 403 | Login válido, mas a pessoa nunca chamou `POST /v1/me` |
| `groups.name-invalid` | 400 | Nome fora da regra |
| `groups.group-not-found` | 404 | Grupo inexistente ou de quem não é membro ativo |
| `groups.forbidden` | 403 | Membro sem a permissão |
| `groups.membership-limit` | 409 | A pessoa já está em 100 grupos ativos |
| `groups.member-limit` | 409 | O grupo já tem 300 membros ativos (parte 3) |

As partes 2 e 3 acrescentam `groups.member-not-found`, `groups.last-admin`, `groups.use-leave`, `groups.regular-needs-account`, `groups.invite-limit`, `groups.invite-not-found`, `groups.invite-invalid` e `groups.member-removed`.
