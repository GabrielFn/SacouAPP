# Perfil do jogador e nota do admin

Regras da E3.17 ([ADR 0051](../arquitetura/adr/0051-perfil-do-jogador-e-nota-do-admin.md), [ADR 0047](../arquitetura/adr/0047-nota-do-admin-e-rating-openskill.md)). A parte 1 entregou o perfil; a parte 2, a nota do admin.

## Perfil (`PlayerProfile`, Identity)

- **Um por pessoa**, igual em todos os grupos: não há apelido por grupo. Fica em `identity.player_profiles`, ligado ao `UserId`; os outros módulos o leem por `Identity.Contracts.IPlayerProfiles`, nunca pelo schema.
- **Campos:** apelido, posição principal, outras posições e nível sugerido. Nada mais (nem nome completo, e-mail, foto, gênero ou data de nascimento).
- **Quem nunca salvou** não tem perfil: `GET /v1/me/profile` responde 404 `identity.profile-not-found` e o app abre a tela 27. Nas listas, o apelido e a posição principal saem nulos e as outras posições vazias. A API exige o apelido em todo `PUT`, então serve a qualquer resposta da pergunta 40.
- **Escrita:** `PUT /v1/me/profile` cria ou troca o perfil inteiro, numa instrução; o último vence. Não há id na rota nem no corpo: o perfil é sempre o de quem chama.

## Apelido (`Nickname`)

A regra do nome do grupo ([grupos.md](grupos.md)), com outros tetos: sem espaços nas pontas, normalizado para NFC, de 1 a 20 caracteres como a pessoa os vê (cabe na cartinha e no chip do time) e no máximo 80 pontos de código (11 emojis de família cabem, 12 não). Recusa quebra de linha, controle, caractere invisível ou de direção, não atribuído, uso privado, *surrogate* solto, os preenchimentos U+115F, U+1160, U+3164, U+FFA0 e U+2800, *zero-width joiner* fora de emoji, mais de 4 marcas no mesmo caractere e texto sem letra, número ou símbolo ("..."). **Não é único:** dois "João" podem estar no mesmo grupo, e homóglifos são aceitos (o app mostra iniciais e posição). Nunca vai para log. Erro: `identity.nickname-invalid`.

## Posições (`PlayingPosition`)

| Valor no fio | Tela (pt-BR) |
|---|---|
| `setter` | Levantador |
| `outsideHitter` | Ponteiro |
| `opposite` | Oposto |
| `middleBlocker` | Central |
| `libero` | Líbero |
| `any` (só a principal) | Qualquer uma |

- `primaryPosition` é nulo ou um dos seis.
- Com `any` ou nulo, `otherPositions` é vazio.
- Com uma posição concreta, `otherPositions` tem até 4 das cinco concretas, sem repetir e sem a principal.
- As outras posições são gravadas e devolvidas na ordem da tabela acima, qualquer que seja a ordem enviada.
- Valor e nome do campo em qualquer caixa são aceitos (`"Setter"`), como em todo corpo da API (ADR 0039).
- Erro único `identity.profile-invalid`, sem dizer qual campo.

A forma das telas no feminino ("Ponteira", "Levantadora") depende da pergunta 41; a API não guarda gênero.

## Escala do nível (`SkillLevel`)

De 1,0 a 5,0, de meio em meio ponto, guardado em décimos inteiros (10 a 50, de 5 em 5), como o `levelTenths` de [player-card.md](player-card.md). O padrão de quem não tem nota nem sugestão é 3,0. No JSON, é um número: `4`, `4.0`, `4.50` e `45e-1` valem 4,0 ou 4,5; `4.25`, `0.5`, `5.5`, `-0`, `"4.5"` (texto), `true` e `1e400` são recusados com 400 (nunca 500, nunca arredondados). A sugestão do perfil aceita meios pontos, embora a tela 27 só ofereça inteiros. Nível sugerido fora da escala é `identity.profile-invalid`; `null` é "não informado".

## Nota do admin (`MemberLevel`, Groups)

- **Uma por membro, por grupo** (`groups.member_levels`): um `MemberId` já é de uma pessoa num grupo. Não separa quadra e areia: o grupo já dá o contexto, e a separação é do rating calculado (E3.9).
- **Quem dá:** Admin e Co-admin (`ManageMemberLevels`), a **qualquer membro ativo**, inclusive admins e a si mesmo (ADR 0047: "de cada membro"; a tela 19 mostra a nota do João, que é o admin). A nota não dá poder no grupo, então não segue a regra de alvo dos papéis.
- **Escala:** a do `SkillLevel`, ou `null` para **"Não sei"**. A linha existe quando o admin revisou o membro: sem linha é "pendente" (`reviewed: false`, a tela 19 conta "N notas para confirmar"); linha com nota nula é "Não sei" (`reviewed: true`, `adminLevel: null`).
- **Escrita:** uma (`PUT .../member-levels/{memberId}`) ou em lote (`PUT .../member-levels`, de 1 a 50, sem repetir membro, **tudo ou nada**). O último vence; a mesma nota de novo é sucesso e renova a hora. Alvo de outro grupo, que saiu, removido ou inexistente: o mesmo 404 `groups.member-not-found`.
- **Quem saiu e volta:** a linha fica; quem volta pelo link tem o mesmo `MemberId` e a mesma nota.
- **Nunca** na resposta: quem deu a nota nem quando.

## Resolução para o sorteio (`MemberLevelResolver`)

A nota do admin; senão, a sugestão do perfil; senão, 3,0. "Não sei" e "pendente" caem na sugestão ou em 3,0. A origem (`Admin`, `Suggested`, `Default`) acompanha o valor, para o σ do rating (E3.9). Só no servidor, pelo contrato `Groups.Contracts.IMemberLevels`, sem rota HTTP própria (o resultado resolvido sai só no sorteio, abaixo). O sorteio que usa o valor está em [sorteio.md](sorteio.md) (E3.6, ADR 0055).

| Nota do admin | Sugestão | Resultado | Origem |
|---|---|---|---|
| 3,5 | 4,0 | 3,5 | Admin |
| "Não sei" ou pendente | 4,5 | 4,5 | Suggested |
| "Não sei" ou pendente | nenhuma (ou convidado sem conta) | 3,0 | Default |

## Quem vê o quê

A privacidade é pela rota, nunca por campo condicional.

| Dado | Própria pessoa (`/me/profile`) | Qualquer membro ativo (`.../members`) | Admin e Co-admin (`.../member-levels`) | Placar e Jogador |
|---|---|---|---|---|
| Apelido, posições | sim | sim | sim (via `members`) | sim (via `members`) |
| Sugestão do próprio nível | sim (a sua) | **nunca** | sim, de cada membro | **nunca** (403 na rota de notas) |
| Nota do admin | **nunca** | **nunca** | sim | **nunca** (403) |

A lista de membros tem o mesmo corpo para todos os papéis e nunca tem campo de nível. A rota de notas nunca entra no cache do app (E4.5).

O sorteio (`POST .../rounds/{roundId}/draw`, E3.6) também devolve, só a Admin e Co-admin e com `no-store`, o nível **já resolvido** de cada confirmado, sem a origem: o admin não sabe por ali se o valor é a sua nota, a sugestão ou 3,0 ([sorteio.md](sorteio.md#rota)).

## Erros

| Código | Status | Quando |
|---|---|---|
| `identity.nickname-invalid` | 400 | Apelido faltando, nulo, vazio ou fora da regra |
| `identity.profile-invalid` | 400 | Posições ou nível sugerido fora da regra |
| `identity.profile-not-found` | 404 | A pessoa nunca salvou o perfil |
| `identity.user-not-registered` | 403 | Login válido, mas `POST /v1/me` nunca rodou |
| `groups.level-invalid` | 400 | Nota fora da escala, lote vazio, com mais de 50 itens ou com membro repetido |
| `groups.member-not-found` | 404 | Alvo da nota que não é membro ativo deste grupo |
| `groups.forbidden` | 403 | Placar ou Jogador na rota de notas |
