# ADR 0056 · Conta: exportação dos dados e exclusão

**Status:** aceito em parte (15/11/2026, parte 1: exportação e bloqueios da exclusão, decisões D1, D3, D6, D9 a D12). A parte 2 (exclusão, login recente e marca de exclusão: D2, D4, D5, D7 e D8) completa este ADR. **Tarefa:** E3.16. **Plano:** [`docs/estado/tarefas/E3.16.md`](../../estado/tarefas/E3.16.md).

## Contexto

A LGPD dá à pessoa o direito de acessar os próprios dados e de apagá-los. As telas 30a (exportar) e 30b (excluir) da E4.3 precisam de três rotas: a exportação, a prévia do que impede a exclusão e a exclusão. Os dados da pessoa estão espalhados por módulos (Identity, Groups, Sessions e, depois do piloto, Matches, Stats e Payments), e o ADR 0037 proíbe um módulo de ler a tabela de outro. O Gabriel decidiu em 15/11 que a exportação é um JSON montado na hora, que o app entrega à folha de compartilhar do sistema (sem e-mail e sem arquivo guardado no servidor), e que exportar não exige login recente (pergunta 65).

## Decisões da parte 1

**D1 · "Ex-jogador".** É a linha de `groups.members` com `user_id` nulo, sem linha em `groups.guests` e `status` diferente de `active`. O `MemberId` fica para sempre (ADR 0012), com as presenças, a autoria e os eventos. Não há apelido anonimizado a gravar: o apelido mora só em `identity.player_profiles`, que a exclusão apaga. A parte 2 grava esse estado; o app mostra "Ex-jogador" para um `MemberId` sem membro ativo resolvido (E4.3, E4.10).

**D3 · O que bloqueia a exclusão.** Ser o **único Admin ativo** de um grupo que tem **outro membro ativo com conta**. Co-admin não conta como admin (`grupos.md`), então um grupo com o Admin e um Co-admin bloqueia. Sozinho, só com convidados ou só com ex-membros, nada bloqueia (pergunta 64). O bloqueio é um passo resolvível pela própria pessoa (promover alguém pela tela 19, botão "Escolher outro admin" da 30b), nunca uma recusa sem saída, e não há promoção automática. Regra pura `Groups.Domain.Members.DeletionRules.IsDeletionBlocker(Group, MemberId)`, testada nos casos U2 do plano.

**D6 · Portas do Identity, implementadas pelos módulos.** O Groups e o Sessions já dependem do Identity, e o Identity não pode depender deles. Então `Identity.Contracts` define as portas e cada módulo as implementa e registra na injeção:

- `IAccountExportSection` (`Name`, `Order`, `ExportAsync(userId)` → o valor da seção ou `null`): Identity (`account`, `profile`), Groups (`groups`), Sessions (`attendances`). Os nomes e a ordem ficam em `AccountExportSections`, para a seção nova (partidas, estatísticas, votos do MVP) entrar sem colidir.
- `IAccountDeletionBlockers` (`FindAsync(userId)` → `DeletionBlocker(GroupId, GroupName, Kind)`): Groups.
- O Sessions acha os `MemberId` da pessoa pelo contrato do Groups, `IGroupMembership.ListMemberIdsOfUserAsync(userId)` (todos os status, para incluir as presenças em grupos de que ela saiu), e lê as presenças pelo índice novo `ix_attendances_member`. Nenhum módulo lê tabela de outro; os testes de arquitetura continuam valendo.

A documentação XML das portas proíbe devolver dado de outra pessoa, a nota do admin e chaves internas.

**D9 · Exportação: `GET /v1/me/export`.** Monta o documento na hora: `format` (`sacou-personal-data`), `version` (1), `generatedAt` e as seções em `Order`, cada uma serializada com as regras JSON da API (enums em camelCase, como no resto do contrato; datas ISO 8601 em UTC). Duas seções com o mesmo nome falham alto, em vez de uma esconder a outra.

- **Entra:** criação da conta; o perfil (apelido, posições e o nível que a própria pessoa sugeriu), ou `null` se nunca salvou; os vínculos com todos os grupos, em todos os status, do mais antigo para o mais novo (`groupId`, `groupName`, `memberId`, `role`, `memberType`, `status`, `joinedAt`, `leftAt`); as presenças da pessoa em todas as rodadas desses vínculos, da rodada mais cedo para a mais tarde (`roundId`, `groupId`, `memberId`, `localDate`, `localTime`, `timeZone`, `status`, `source`, `respondedAt`, `promotedAt`).
- **Não entra:** a nota do admin (pergunta 42); `userId` e `firebase_uid` (chaves internas; e-mail e provedor estão no Firebase, e o app os mostra na tela 30); dado de outro membro (apelido, nota, presença); o local da rodada; convites e modelos; e o nome de um grupo de que a pessoa saiu ou foi removida (`groupName: null`: é dado do grupo, que ela já não vê e que pode ter mudado).
- **Partidas e estatísticas** (tela 30a) ainda não existem no servidor: a E3.7, a E3.9 e a E3.18 registram cada uma a sua seção. O `version` sobe quando uma seção muda de forma, não quando entra uma nova.
- **Cabeçalhos:** `Content-Type: application/json; charset=utf-8`, `Content-Disposition: attachment; filename="sacou-meus-dados-AAAA-MM-DD.json"` (dia em UTC, sem nome da pessoa) e `Cache-Control: no-store` por metadado da rota (`WithNoStore()`, middleware `UseNoStore` do ADR 0055), também no 401 da autenticação, no 403 e no 500; o `Content-Disposition` só no 200 (recusa não vira arquivo).
- **Sem limite de tamanho:** o direito de acesso é ao todo. O volume cresce com o tempo: os tetos que existem (100 grupos ativos, 20 rodadas futuras por grupo) não limitam as rodadas passadas nem os grupos de que a pessoa saiu; o teste E7 mede 100 grupos × 20 rodadas. Rota cara, sem limite de requisições até a E5.3.
- **Presenças em grupo de que a pessoa saiu:** levam `localDate`, `localTime` e `timeZone` da rodada (dado do grupo, como o nome omitido), porque estão ligadas à resposta da própria pessoa.
- **Contrato OpenAPI:** a resposta é um `JsonObject` aberto (`additionalProperties: {}`, transformador `OpenObjectSchemaTransformer`), porque as seções vêm de vários módulos; o app trata o corpo como texto a compartilhar.

**D10 · Prévia dos bloqueios: `GET /v1/me/deletion-blockers`.** `200 { "blockers": [ { "groupId", "groupName", "kind": "lastAdmin" } ] }`, lista vazia quando nada bloqueia, ordenada pelo nome e depois pelo id, com `Cache-Control: no-store`. O nome vai porque a pessoa é Admin ativa do grupo e já o vê; assim o app não depende do cache para montar a frase da 30b. É só uma prévia, sem trava: o `DELETE` da parte 2 decide de novo sob as travas dos grupos.

**D11 (parte 1) · Logs.** `Account export generated.` e `Deletion blockers listed: {n} groups.`, em Information, sem `userId`, `sub`, `MemberId`, `groupId` nem nome. Teste L1 com o apelido, o UID, os ids e os nomes dos grupos como textos proibidos.

**D12 · Rotas fora do filtro de grupo.** As duas rotas não têm `{groupId}`: entram na lista fechada do teste de guarda de rotas (ADR 0040, D4) e no contrato OpenAPI (ADR 0042), com os tipos do app regenerados. Nenhuma exige login recente.

## Consequências

- O plano da E4.3 (D9) previa `{ soleAdminGroupIds: uuid[] }` para a prévia; o contrato adotado traz também o nome e o tipo do bloqueio, e o app usa `groupId` como antes.
- Cada módulo novo que guarda dado pessoal acrescenta a sua `IAccountExportSection` (e, na parte 2, o seu passo de exclusão) sem tocar no Identity além de um nome em `AccountExportSections`.
- A exportação é cara para quem tem muitos grupos; a E5.3 decide o limite de requisições.
