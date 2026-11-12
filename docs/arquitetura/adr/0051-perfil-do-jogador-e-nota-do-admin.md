# ADR 0051 · Perfil do jogador e nota do membro definida pelo admin

**Status:** aceito em parte (12/11/2026): a parte 1 da E3.17 (perfil e apelido na lista de membros). A parte 2 (nota do admin) completa as decisões D2, D3 e D8 a D10 deste registro. **Tarefa:** E3.17. **Plano:** [`docs/estado/tarefas/E3.17.md`](../../estado/tarefas/E3.17.md).

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

## Consequências

- O app (E4.3) lê e grava o perfil; a lista de membros (E4.5, E4.6) mostra o apelido sem outra chamada.
- O Identity passa a depender de `Sacou.Http` (como o Groups), para o `ToHttpResult` e o `ProblemDetails`.
- Risco aceito: a sugestão é única por pessoa, então o admin de um grupo novo verá a autoavaliação feita para outro (parte 2; a tela 27 avisa).
- Risco aceito: apelidos repetidos e homóglifos no mesmo grupo.

## Alternativas descartadas

- **Colunas em `identity.users`:** misturaria o login com o perfil e quebraria a trava de 3 colunas.
- **Apelido por grupo:** a pendência herdada da E3.2 e `dados-pessoais.md` pedem perfil único.
- **O Groups ler `identity.player_profiles` direto:** quebraria a fronteira de módulos (ADR 0039).
- **Nível como texto ou inteiro de 1 a 5:** a tela 19b mostra meios pontos; décimos inteiros evitam ponto flutuante e conversão.
