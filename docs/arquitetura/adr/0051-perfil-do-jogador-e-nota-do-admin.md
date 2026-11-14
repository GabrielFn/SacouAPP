# ADR 0051 · Perfil do jogador e nota do membro definida pelo admin

**Status:** aceito (12/11/2026, parte 1: perfil e apelido na lista de membros; 13/11/2026, parte 2: nota do admin, decisões D2, D3 e D8 a D10). **Tarefa:** E3.17. **Plano:** [`docs/estado/tarefas/E3.17.md`](../../estado/tarefas/E3.17.md).

## Contexto

O ADR 0047 tirou o nível autodeclarado do papel de nota definitiva: o jogador sugere, o admin define, e ninguém além dos admins vê a nota. O app precisa do apelido e das posições nas listas (telas 06, 19, 20, 21, 26), do perfil rápido (tela 27) e, para o sorteio (E3.6), da nota de cada membro. A E3.2 deixou a lista de membros sem nome, esperando o perfil.

## Decisões da parte 1

**D1 · O perfil mora no Identity, por pessoa.** Tabela própria `identity.player_profiles` (não colunas em `identity.users`, que é a linha do login e tem as 3 colunas travadas): `user_id` (chave e FK para `identity.users` com `ON DELETE CASCADE`, permitida porque é o mesmo módulo), `nickname`, `primary_position`, `other_positions` (`text[]`), `suggested_level_tenths` (`smallint`) e `updated_at`. `CHECK`s com as listas fechadas de posições (escritas à mão em `ProfileColumnValues`), a escala, até 4 outras posições e até 80 pontos de código no apelido. Um teste de modelo trava as 6 colunas. A linha do banco usa o `UserId` com a mesma conversão de `identity.users`, para o EF ligar a FK.

**D4 · `SkillLevel` em `Sacou.Shared.Levels`.** Value object com décimos inteiros (10 a 50, de 5 em 5), constantes `MinTenths`, `MaxTenths`, `StepTenths`, `DefaultTenths` (30). Dois domínios o usam (a sugestão no Identity, a nota no Groups), o que cumpre a regra do ADR 0005 para um namespace público novo do `Shared`; a lista fechada de `RealAssemblyTests` ganhou `Sacou.Shared.Levels`. `FromDecimal` confere a faixa antes de multiplicar (um `decimal` enorme não estoura) e recusa o que não é décimo inteiro (4,25 nunca é arredondado). O erro `level.out-of-scale` nunca chega ao HTTP: cada módulo responde o próprio código. No fio, o nível é número JSON lido como `decimal`, com `JsonNumberHandling.Strict` na propriedade, porque os padrões web do ASP.NET aceitariam `"4.5"` como texto.

**D5 · O apelido chega à lista de membros por contrato.** `Identity.Contracts.IPlayerProfiles.FindManyAsync(userIds)` devolve `PlayerProfileView` (`UserId`, `Nickname`, `PrimaryPosition?`, `OtherPositions`, `SuggestedLevelTenths?`) numa consulta (`WHERE user_id = ANY(...)`, sem rastreamento). Os enums públicos `PlayingPosition` e `PrimaryPosition` espelham os do domínio, convertidos à mão (como `GroupRole`). O Groups já dependia de `Identity.Contracts`; o Identity continua sem conhecer o Groups. A sugestão viaja no contrato porque a rota de notas e o sorteio vão precisar dela; a lista de membros a ignora.

**D6 · Posições.** `setter`, `outsideHitter`, `opposite`, `middleBlocker`, `libero` (nome `PlayingPosition`, para não colidir com `RotationSlot` nem `CourtPoint`); a principal aceita também `any`. Regras e ordem canônica em [perfil-e-nota.md](../../dominio/perfil-e-nota.md). Um erro só, `identity.profile-invalid`, sem dizer qual campo.

**D7 · Privacidade pela rota.** A lista de membros tem o mesmo corpo para todos os papéis e nenhum campo de nível; a sugestão do próprio nível só volta à própria pessoa em `GET /v1/me/profile`; a nota e a sugestão de cada membro só sairão da rota de notas (parte 2). Assim, um `if` errado não vaza nada, e o cache do app (E4.2, que proíbe nível) não precisa filtrar campo. Testes: valor marcador lido por todos os papéis e teste de tipos (`MemberResponse` com 9 campos, nenhuma resposta do Groups com propriedade `Level`).

**D10 (perfil) · Concorrência.** `INSERT ... ON CONFLICT (user_id) DO UPDATE` numa instrução parametrizada; o último vence, sem trava (o padrão idempotente do ADR 0037, D6). Teste: 16 primeiros `PUT` simultâneos, dezesseis 200, uma linha.

**D11 · Apelido.** A regra do `GroupName` (`DisplayText.IsWellFormed` e `IsAllowedName`), com 20 grafemas e 80 pontos de código. O teto de 4 marcas por caractere foi promovido a `DisplayText.MaxMarksPerCharacter`, usado pelo apelido e pelo nome do grupo. Não é único no grupo. `ToString()` não mostra o texto, e o apelido nunca vai a log.

**D12 · Eventos.** A tarefa não emite evento. Os eventos da quadra seguem com esquema fechado só de IDs (E2.2), e o teste `CourtSessions_HaveNoPersonalDataNames` continua valendo para os namespaces de eventos.

**Rotas.** `GET` e `PUT /v1/me/profile`, fora do filtro de grupo e na lista fechada do teste de guarda das rotas (ADR 0040, D4), com o limite de corpo de 4 KB, `ApiJson` e `ProblemDetails` com `code`. As 4 chaves do `PUT` são obrigatórias (`JsonRequired`); `primaryPosition` e `suggestedLevel` podem ser nulos. Códigos novos: `identity.nickname-invalid`, `identity.profile-invalid`, `identity.profile-not-found`. A lista de membros ganhou `nickname`, `primaryPosition` e `otherPositions`, acréscimos compatíveis na `/v1` (ADR 0042).

## Decisões da parte 2

**D2 · A nota do admin mora no Groups, por membro.** Tabela própria `groups.member_levels`: `member_id` (chave), `group_id`, `level_tenths` (`smallint`, nulo para "Não sei"), `set_by_member_id` e `set_at`, com `CHECK` da escala e índice `ix_member_levels_group`. FKs só dentro do módulo (para `groups.members` e `groups.groups`, `RESTRICT`), nenhuma para o Identity. Não em `groups.members`: as colunas da lista de membros ficam travadas e nenhuma leitura dela alcança a nota. A linha existe quando o admin revisou o membro e fica quando ele sai. Um teste de modelo trava as 5 colunas.

**D3 · Uma nota por grupo, sem separar quadra e areia.** O grupo dá o contexto; a separação é do rating (E3.9). Mudar depois é acrescentar `modality` à chave.

**D8 · Permissão `ManageMemberLevels`.** Admin e Co-admin; lê e grava. Alvo: qualquer membro ativo, admins e o próprio ator inclusive, porque a nota não dá poder no grupo. Tabela de permissões em 4 × 13, testada à mão; matriz HTTP de 30 linhas, também à mão.

**D9 · Contrato `Groups.Contracts.IMemberLevels.ResolveAsync(groupId, memberIds)`.** Devolve `ResolvedLevel(MemberId, LevelTenths, LevelSource)` para cada id que é membro do grupo (qualquer situação), na ordem de entrada; id de outro grupo fica de fora, e grupo inexistente dá lista vazia. A regra pura `MemberLevelResolver` (nota, senão sugestão, senão 30) tem a tabela golden só em C#, porque não há lado TS; se o sorteio rodar no app, a E3.6 exporta a tabela. Duas consultas ao banco e uma chamada a `IPlayerProfiles`, nunca uma por membro.

**D10 (nota) · Concorrência.** Toda escrita de nota abre uma transação explícita, trava a linha de `groups.groups` (`FOR UPDATE`, a mesma trava das escritas de membro do ADR 0040, D8), lê só os membros do grupo e julga quem age e cada alvo na regra pura `MemberLevels.Set`; depois grava cada nota com `INSERT ... ON CONFLICT (member_id) DO UPDATE ... WHERE member_levels.group_id = EXCLUDED.group_id`. Um rebaixamento ou uma remoção que entra depois do filtro vence (testes C1 e C2); escritas simultâneas no mesmo alvo ou lote e individual juntos deixam uma linha por membro (C3 e C4). Nenhuma família nova de trava.

**Linha fora da escala.** O `CHECK` garante a escala, mas, diferente do perfil (que confia nele e usa `.Value`), o store da nota não lança com uma linha corrompida: pula a linha e registra um aviso sem id nem valor. O membro aparece como pendente, o que é seguro (o admin vê e revisa de novo), em vez de derrubar a lista ou o sorteio com 500.

**D12 · Eventos (complemento).** Um teste de arquitetura reprova tipo dos namespaces de eventos (`CourtSessions` e `CourtSessionJson`) que dependa do módulo Identity, de `Sacou.Shared.Levels` ou de tipo de fora chamado `Nickname`, `PlayerProfile` ou `MemberLevel`; um caso plantado (`UsesSkillLevel`) prova que a regra reprova.

**Rotas da parte 2.** `GET .../member-levels`, `PUT .../member-levels/{memberId}` `{ level }` e `PUT .../member-levels` `{ levels }`, no filtro de grupo, com o limite de corpo de 4 KB, `ApiJson` e `JsonNumberHandling.Strict` no nível. As respostas nunca trazem quem deu a nota nem quando. Código novo: `groups.level-invalid` (400). O teste de tipos aceita `AdminLevel` só nas duas respostas de nota, e `SuggestedLevel` só nelas e na do próprio perfil.

## Consequências

- O app (E4.3) lê e grava o perfil; a lista de membros (E4.5, E4.6) mostra o apelido sem outra chamada.
- O Identity passa a depender de `Sacou.Http` (como o Groups), para o `ToHttpResult` e o `ProblemDetails`.
- Risco aceito: a sugestão é única por pessoa, então o admin de um grupo novo vê a autoavaliação feita para outro (a tela 27 avisa).
- Risco aceito: o "Confirmar todas" de mais de 50 pendentes vira várias chamadas, sem atomicidade entre elas (E4.5).
- Risco aceito: apelidos repetidos e homóglifos no mesmo grupo.

## Alternativas descartadas

- **Colunas em `identity.users`:** misturaria o login com o perfil e quebraria a trava de 3 colunas.
- **Apelido por grupo:** a pendência herdada da E3.2 e `dados-pessoais.md` pedem perfil único.
- **O Groups ler `identity.player_profiles` direto:** quebraria a fronteira de módulos (ADR 0039).
- **Nível como texto ou inteiro de 1 a 5:** a tela 19b mostra meios pontos; décimos inteiros evitam ponto flutuante e conversão.

## Notas da implementação (Parte 1)

- **Contrato `/v1`:** o gerador do OpenAPI deixava vazio o enum anulável (`PrimaryPosition?`) e sem `items` a lista de enums (`otherPositions`). O `EnumAsTextSchemaTransformer` (ADR 0042, D1) passa a desembrulhar o `Nullable<T>` e a descrever cada item da lista de enums em linha, com os valores do fio; teste `Position_lists_carry_the_wire_values_of_each_item`.
- **Textos do app:** o mapa de erros do app é exaustivo sobre os códigos gerados, então os três códigos novos (`identity.nickname-invalid`, `identity.profile-invalid`, `identity.profile-not-found`) já ganham texto pt-BR em `api-errors.pt-BR.ts`; a E4.3 pode ajustá-los.
