# ADR 0053 · Convidado sem conta, que entra como avulso

**Status:** aceito (14/11/2026). **Tarefa:** E3.5. **Plano:** [`docs/estado/tarefas/E3.5.md`](../../estado/tarefas/E3.5.md). **Tarefa sensível:** dado pessoal de um terceiro sem conta.

## Contexto

O admin precisa pôr na rodada quem não tem o app (tela 21a, "Adicionar convidado"). O ADR 0040 (D1) já previa `GroupMember.UserId` nulo para esse caso, e o ADR 0046 deixou a reivindicação do convidado por link para depois do piloto. O aceite é "Convidado joga e aparece nas estatísticas da rodada"; as estatísticas são indexadas por `MemberId` (E3.7 e E3.13), então o convidado entra nelas sem caso especial.

## Decisões

**D1 · O convidado é um `GroupMember` comum.** `UserId` nulo, `Player`, `DropIn`, `Active` (`GroupMember.Guest`), com um `MemberId` UUID v7 para sempre. A reivindicação depois do piloto vira um merge de `MemberId` (ADR 0012), sem migrar histórico. Ele vale para as rodadas seguintes.

**D2 · O nome mora em `groups.guests`, nunca em `groups.members`.** Colunas: `member_id` (chave e FK para `groups.members`), `group_id` (FK para `groups.groups`), `name` (`CHECK char_length(name) BETWEEN 1 AND 80`), `primary_position` (nula ou uma das 5 posições concretas, com `CHECK`), `request_id` (`UNIQUE (group_id, request_id)`) e `created_at`. Sem autoria, por minimização. As duas FKs são `ON DELETE CASCADE`: a linha segue o membro e o grupo, e uma exclusão futura do grupo (E3.16) nunca para nessa tabela. As colunas de `groups.members` continuam travadas pelo teste de modelo.

**D3 · `GuestName` usa a regra do apelido, sem cópia.** A regra (NFC, 1 a 20 grafemas, até 80 pontos de código, nada invisível, até 4 marcas por caractere) subiu do `Nickname` para `Sacou.Shared.Text.PersonName`, usada pelos dois. O teste do apelido e o do convidado rodam a mesma tabela de entradas (`tests/TestSupport/PersonNameCases.cs`), com os limites escritos como literais. `ToString` não mostra o nome. Erro: `groups.guest-name-invalid`.

**D4 · Duas chamadas, duas travas, nunca uma dentro da outra.** `POST /guests` cria o membro sob a trava do grupo (`FOR UPDATE`, ADR 0040 D8); o app chama em seguida `PUT /rounds/{r}/attendance/{memberId}` (E3.4), sob a trava da rodada. Respeita a ordem de travas do ADR 0043. Se a segunda falhar, o convidado fica no grupo e aparece na tela 21.

**D5 · Idempotência pelo `requestId`.** O app gera um UUID por abertura da tela 21a. O mesmo `requestId` no mesmo grupo devolve 200 com o mesmo `memberId`, sem mudar nada, mesmo com outro nome. A busca acontece sob a trava do grupo, e o `UNIQUE (group_id, request_id)` é a segunda barreira. Um reenvio acha o convidado mesmo com o grupo cheio. Depois que o convidado é removido, a linha some e o mesmo `requestId` criaria outro. Comportamento aceito, risco baixo: o app gera um UUID novo a cada abertura da tela, então não há caso real.

**D6 · A nota entra no mesmo pedido.** Com `level` (número JSON na escala, `JsonNumberHandling.Strict`), a linha de `groups.member_levels` é gravada na mesma transação, com o admin como autor. Sem `level`, a nota fica pendente e o sorteio usa 3,0. A tela 21a não tem "Não sei", então `level: null` é o mesmo que não mandar. Criar com nota exige também `ManageMemberLevels` no agregado (hoje os mesmos papéis). A resposta nunca devolve a nota.

**D7 · Permissão `ManageGuests`.** Admin e Co-admin; adiciona e corrige convidado. A tabela de permissões passa a 4 × 14. Remover usa o `DELETE` de membro (`RemoveMember`).

**D8 · O que o convidado nunca é.** Só `Player`: outro papel dá `groups.role-needs-account` (400). Nunca mensalista (`groups.regular-needs-account`). Não sai do grupo, não casa com um aceite de convite (o aceite busca por `UserId`) e não responde por si.

**D9 · Corrigir e apagar.** `PUT /guests/{memberId}` `{ name, primaryPosition }` substitui o perfil inteiro (direito de retificação); os dois campos são obrigatórios, e `primaryPosition: null` limpa a posição. Foi `PUT`, e não o `PATCH` do plano, porque o leitor JSON não distingue campo ausente de `null` sem um tipo próprio, e a tela de edição manda os dois campos. Alvo com conta, removido ou de outro grupo: o mesmo 404 `groups.member-not-found`. Na remoção, a linha de `groups.guests` é apagada na mesma transação e o membro fica `Removed`; o histórico continua por `MemberId` e aparece como "Ex-jogador" (pergunta 44).

**D10 · Lista de membros.** O convidado sai com `hasAccount: false`, `nickname` = nome, `primaryPosition` = a posição e `otherPositions: []`, lidos de `groups.guests` na mesma consulta (`ListActiveRosterAsync`, junção à esquerda). A lista e a correção levam `Cache-Control: no-store`, porque trazem nomes. `IGroupMembership.ListActiveAsync` já devolve o convidado como `DropIn`, e `IMemberLevels` dá 3,0 `Default` sem nota. O Sessions não muda.

**D11 · Limites.** O convidado conta nos 300 membros ativos (`groups.member-limit`, julgado sob a trava). Não há teto separado no piloto.

**D12 · Logs e eventos.** Nenhum log novo; nenhum log, resposta ou evento leva o nome ou o `requestId`. Não há evento novo, e o `AttendanceChanged` continua só com IDs.

## Consequências

- As estatísticas (E3.7, E3.13) contam o convidado pelo `MemberId`; o golden `a17` de `attributions-events.json` mostra o `MemberId` de um convidado num time e num `PointAttributed`, com o replay igual em TS e C#.
- Retenção de convidado que nunca mais jogou: item 2 de `perguntas.md`, reavaliar na E6.2.
- Pergunta 43 (padrão 1): no piloto, quem cria a conta depois começa um `MemberId` novo; o texto da tela 21a muda na E4.6.
