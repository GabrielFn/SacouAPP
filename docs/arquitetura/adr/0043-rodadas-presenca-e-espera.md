# ADR 0043 · Rodadas, recorrência, presença e lista de espera

**Status:** aceito (10/11/2026) para a Parte 1 (domínio e contratos do Groups, sem rota). A Parte 2 (persistência, trava, materialização e rotas) acrescenta a sua seção no fim. **Tarefa:** E3.4. Plano: [`E3.4.md`](../../estado/tarefas/E3.4.md). Regras de produto em [`docs/dominio/rodadas.md`](../../dominio/rodadas.md). Segue o padrão de módulos do [ADR 0039](0039-sacou-http-e-contratos-entre-modulos.md), a autorização do [ADR 0040](0040-grupos-membros-papeis-e-autorizacao.md) e a configuração herdada do [ADR 0041](0041-configuracao-herdada-e-modelos.md).

## Contexto

A rodada é o centro do uso: o admin cria (ou uma série cria), os jogadores respondem "vou" ou "não vou", as vagas acabam e a espera anda sozinha. Falta decidir o modelo, as regras de mensalista e avulso, a recorrência, o fuso e como o domínio fala com o Groups sem conhecer o seu domínio.

## Decisões (Parte 1)

**D1 · Módulo Sessions, agregado `Round`.** O glossário chama a rodada de `Session`; no código o agregado é `Round`, para não confundir com `CourtSession` (Matches) nem com a sessão de login. A presença (`Attendance`) vive dentro do agregado, uma por membro. A série (`RoundSeries`) é um agregado à parte. Records imutáveis, `Result` para recusa de regra, nenhuma dependência de EF ou ASP.NET no domínio.

**D2 · Estados e transições como função pura.** `AttendanceStatus`: `Going`, `NotGoing`, `Waitlisted`, `Promoted`. `Going` e `Promoted` ocupam vaga; `Promoted` existe para o app dizer "Você entrou da espera" e para o push da E3.11. `AttendanceRules.Respond(round, rules, respondent, response, actor, now)` é o reducer: devolve um `RoundChange` (a rodada nova, as presenças a gravar e os eventos) ou um erro. O relógio entra como `now`. O que a regra recusa, em ordem: rodada cancelada (`sessions.round-closed`), presença desligada (`sessions.attendance-disabled`), jogador depois do início (`sessions.round-closed`), avulso antes da janela (`sessions.drop-in-window-closed`), cheia sem espera (`sessions.round-full`).

**D3 · Ordem por `Sequence`, posição calculada.** Cada "vou" que muda de estado recebe `Sequence = round.NextSequence`, e o contador sobe. A espera é a lista `Waitlisted` por `Sequence`; a posição nunca é gravada, então ninguém é renumerado quando alguém sai. O relógio não ordena: dois pedidos no mesmo milissegundo têm sequências diferentes (a trava que o garante é da Parte 2). "Vou" repetido não muda a sequência; "não vou" mantém a sequência da presença; volta de quem disse "não vou" ganha uma nova (fim da fila).

**D4 · `RoundReconciliation`.** `PromoteFromWaitlist` promove, em ordem, tantos da espera quantas vagas livres houver (`PromotedAt = now`, evento `WaitlistPromoted`); `Reconcile` primeiro põe em `NotGoing` quem não é mais membro ativo e depois promove; `SeedRegulars` confirma os mensalistas de uma rodada nova. Rodada cancelada ou presença desligada não se mexe. Nunca rebaixa ninguém.

**D5 · Respostas às perguntas 24 a 27 (padrão adotado, a confirmar com o Gabriel).** (24) Mensalistas que passam da vaga entram na espera, na ordem de entrada no grupo, à frente de qualquer avulso, porque a sequência deles é a primeira. (25) Mensalista que disse "não vou" e volta vai para o fim da espera. (26) Reduzir as vagas não tira ninguém: só fecha a porta para os próximos. (27) O jogador responde até `StartsAt` (depois dele, `sessions.round-closed`); o admin responde por qualquer um mesmo depois, respeitando a vaga e ignorando a janela. Cada resposta é uma linha de `AttendanceRules` ou de `RoundReconciliation`; trocar uma é uma mudança de poucas linhas e de um teste.

**D6 · O tipo do membro vem na hora.** `Respondent(MemberId, MemberKind)`: o tipo (mensalista ou avulso) é lido do Groups em cada resposta e nunca copiado para a presença. A janela dos avulsos olha o tipo de quem responde agora. `AttendanceSource` (`Self`, `Admin`, `Regular`) guarda só de onde veio a linha, para a "posição entre os mensalistas" da tela 26.

**D7 · Janela dos avulsos em instante.** `DropInOpensAt = StartsAt − horas`, aritmética de instante, não de relógio local: atravessar uma troca de horário não move a abertura. O "não vou" sempre passa; mensalista e admin não têm janela.

**D8 · Recorrência semanal, fuso fixo.** `RoundSeries` guarda o dia da semana, a hora local, o local e o fuso. A série não guarda configuração: cada ocorrência nasce herdando o grupo. `RoundSchedule.NextOccurrence(series, occurrences, now)` é pura e devolve a próxima data local (ou nada, se a série parou ou já tem uma ocorrência futura não cancelada): a primeira data do dia da semana que começa depois de `now` e depois de todas as ocorrências que a série já tem; uma série parada por semanas faz uma rodada à frente, nunca uma no passado. Semanal é a mesma hora local, não "+7 dias" de instante. Quem insere (leitura idempotente, sem Hangfire) é da Parte 2.

**D9 · Fuso `America/Sao_Paulo`, constante única.** `SessionsTime.TimeZoneId` é gravado em cada série e rodada, para um fuso por grupo no futuro não exigir migração. Sem NodaTime: `TimeZoneInfo` com id IANA (funciona em Linux e em Windows com ICU, .NET 10). `LocalTimeConverter.ToMoment` decide as duas bordas do horário de verão: hora que **não existe** (00h30 em 04/11/2018) avança pelo tamanho do pulo (01h30, e a hora local da rodada passa a ser essa); hora **ambígua** (23h30 em 16/02/2019) fica com a primeira ocorrência (horário de verão). O Brasil não tem horário de verão desde 2019, mas o tzdb pode voltar a ter. A verdade guardada é a hora local ("terça 20h30"); o instante é recalculado quando a data ou a hora mudam.

**D10 · Janela de criação e limites.** Rodada pedida por admin: no futuro (`StartsAt > now`) e com data local até 365 dias adiante (`sessions.round-invalid` fora disso). Data e hora só nos formatos `YYYY-MM-DD` e `HH:mm`. Local: 0 a 80 caracteres, aparado, em NFC, sem texto invisível (regra do `DisplayText` compartilhado; difere da do `schedule.venue` só na contagem de famílias de emoji, que aqui são grafemas). Os tetos (20 rodadas futuras e 7 séries ativas por grupo) estão em `SessionLimits`; quem os confere é a Parte 2.

**D11 · Eventos só com IDs.** `RoundCreated`, `RoundCanceled`, `AttendanceChanged` e `WaitlistPromoted` carregam `RoundId`, `GroupId`, `MemberId`, estado e instante. Sem nome, e-mail nem `UserId`. Sem Outbox nesta tarefa (é da E3.11): os eventos saem do domínio em `RoundChange.Events`.

**D12 · Contratos do Groups.** `IGroupSettingsReader` (`GetAsync` devolve um `GroupSettingsSnapshot` opaco; `ResolveRound` valida a camada no nível `round`, normaliza contra o grupo, resolve e tipa as `AttendanceRules`), `GroupCapability` (`ViewGroup`, `ManageRounds`, `RespondAttendance`) e, em `IGroupMembership`, `ListActiveAsync` (ordem de entrada) e `Allows(role, capability)` (lê `RolePermissions`, sem tabela duplicada). Recusa de camada é `groups.settings-invalid`, sem o caminho. O Sessions só referencia `Groups.Contracts`, e os tipos públicos são simples (`Guid`, `bool`, `int`, `string`). O domínio do Sessions tem o seu próprio `AttendanceSettings`, mapeado do contrato na camada de aplicação, e o reducer se chama `AttendanceRules`, por isso o nome do contrato (`AttendanceRules`, do plano) fica só no Groups.

**D13 · Permissões.** `ManageRounds` (Admin e Co-admin) e `RespondAttendance` (os quatro papéis; o Placar também joga) entram em `GroupPermission` e `RolePermissions`; a tabela do teste passa de 4 × 10 para 4 × 12. Ver a rodada é `ViewGroup`.

**D14 · `MemberId` e `DisplayText` vão para `Sacou.Shared`.** Dois módulos passam a usar `MemberId` (ADR 0040 D2 já previa a promoção) e `DisplayText` (regra do local, ADR 0005: dois consumidores). `MemberId` é público em `Sacou.Shared.Members`; o contrato do Groups continua com `Guid`. Mudança mecânica: só namespace e visibilidade. A lista fechada de namespaces públicos do Shared (teste de arquitetura) ganhou `Sacou.Shared.Members` e `Sacou.Shared.Text`; o `DisplayText` usa `HashSet`, para a lista de assemblies da BCL continuar a mesma.

## Alternativas descartadas

- **Posição gravada na presença:** exigiria renumerar a espera a cada saída; a lista por `Sequence` dá a posição de graça e sem corrida.
- **Ordenar por hora da resposta:** dois pedidos no mesmo milissegundo ficam sem ordem; o contador sob a trava resolve.
- **Fuso do servidor ou UTC fixo:** "terça 20h30" mudaria de hora local ao atravessar uma troca de horário.
- **`DateTimeOffset` + 7 dias para a recorrência:** o mesmo problema.
- **Reuso do `AttendanceRules` do contrato no domínio do Sessions:** acoplaria o domínio ao Groups.

## Consequências e riscos

- As respostas das perguntas 24 a 27 podem mudar o que o jogador vê na lista; cada uma está numa regra pura, com teste.
- A hora local de uma rodada que cai num pulo de horário muda (00h30 vira 01h30); só ocorre se o Brasil voltar ao horário de verão.
- O mapeamento do contrato para `AttendanceSettings` é uma linha de código a mais na Parte 2, em troca de um domínio sem dependência do Groups.

## Persistência, concorrência e rotas (Parte 2)

A preencher pela Parte 2: trava pessimista por rodada (`SELECT … FOR UPDATE`), materialização idempotente na leitura, leitura que repara, filtro de autorização do Sessions e as rotas.
