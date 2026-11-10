# Modelo de ameaças

STRIDE por componente: **S**poofing, **T**ampering, **R**epudiation, **I**nformation disclosure, **D**enial of service, **E**levation of privilege.

Já têm código a CI (seção 11), o login (E3.1, seção 1), a autorização por grupo (E3.2, partes 1 e 2, seção 2), o gerador puro do Pix (E1.4, seção 6) e o motor da partida (M2, seção 3): em TS, o parser do envelope, o replay, os parsers por tipo, os aplicadores, os comandos e as estatísticas (E2.1 a E2.9 e E2.11), e o porte para C# do leitor, dos parsers e do replay (E2.10, ADR 0033), ainda sem endpoint nem app que os use; os demais componentes não têm código. Fora das seções 1, 2 e 11, "Mitigação" é o que os documentos **decidiram**, não o que já existe; o que está implementado é conferido no [checklist](checklist.md). Sem decisão, consta "a definir na E\<ID\>". Cada tarefa da lista atualiza sua seção.

## 1. Login (Firebase Auth, E3.1)

Implementado na E3.1 ([ADR 0036](../arquitetura/adr/0036-verificacao-do-token-e-usuario.md)): `POST /v1/me` e o esquema de autenticação padrão da API.

| | Ameaça | Mitigação |
|---|---|---|
| S | Token forjado, de outro projeto ou com algoritmo trocado (`none`, HS256 com a chave pública, RS512, PS256, ES256) | ID token validado como JWT pelas chaves da URL documentada do Google, sem FirebaseAdmin: só RS256, `kid` obrigatório e só a chave dele, `aud` igual ao projeto e como string única, `iss` exato, `sub` de 1 a 128 ASCII visíveis. Matriz R1 a R24 com controle positivo, no host de teste |
| S | Chave injetada pelo token (`jwk`, `jku`, `x5u`) | Cabeçalhos ignorados; a única fonte de chave é a URL fixa HTTPS, sem seguir redirecionamento (teste do handler primário e de URL buscada) |
| S | Provedor ligado por engano no console (anônimo, telefone, personalizado) ou tenant | Lista permitida: `password`, `google.com`, `apple.com`; `firebase.tenant` presente é recusado |
| S | Tentativas repetidas de senha | A senha nunca passa pela API: o Firebase bloqueia excesso de tentativas e tem proteção contra enumeração de e-mails. Limite de requisições do `POST /v1/me` na E5.3 |
| S | Conta de e-mail e senha criada com o e-mail de outra pessoa (e-mail não verificado é aceito, D3) | A API nunca usa nem guarda e-mail, e não liga contas por e-mail; a E3.5 reivindica convidado só por link. Com "uma conta por e-mail", o dono entrando com Google torna esse provedor o confiável e remove a senha |
| T | Token alterado (payload trocado depois de assinar) | Assinatura conferida antes de ler qualquer claim (R5) |
| R | Negar uma ação feita com a conta | A definir na E5.2 (quais ações registrar nos logs estruturados) |
| I | Token, UID ou e-mail em logs | Log só com a categoria da recusa (`IdTokenRejection`); mensagem de exceção da biblioteca nunca lida; `ShowPII` e `LogCompleteSecurityArtifact` desligados, com guarda de texto; principal só com o `sub`. Testes L1 a L3 gravam todos os logs e procuram token, segmentos, UID, e-mail e nome. O log de hospedagem do ASP.NET (Information) mostraria a query string: `appsettings.json` o corta em Warning, e a API nunca lê token da query |
| I | Motivo da recusa usado como oráculo | 401 sempre igual (`ProblemDetails` e `WWW-Authenticate: Bearer`, sem `error`) |
| I | Detalhe do erro do Postgres (valores da linha, como o UID) em exceção e log | **Regra para a E5.1:** a string de conexão de produção nunca tem `Include Error Detail=true` (padrão do Npgsql: desligado). A E5.1 confere isso ao mapear o `SACOU_DATABASE_URL`. O 500 já sai sem detalhe (P7) |
| I | Token exposto no celular | A definir na E4.3 |
| D | Busca de chaves forçada por `kid` aleatório | Com chaves em cache, no máximo uma busca a cada 5 min por `kid` desconhecido; uma busca por vez, reaproveitada por quem esperava (K6: 50 simultâneas, 1 busca) |
| D | Google fora do ar, lento ou formato do documento mudou | Cache pelo `max-age` (5 min a 24 h); com falha, as chaves antigas valem até o `NotAfter`, e um `kid` conhecido com certificado vencido responde 503 enquanto o cache está velho (busca falha ou adiada; o app não desloga) e 401 com cache fresco (um token forjado com esse `kid` nunca ganha 503 sem conferir assinatura); sem cache, 503 com `Retry-After` (o app não desloga), e nova busca no máximo a cada 10 s (`MinTimeBetweenColdFetches`): 20 pedidos seguidos geram 1 busca. Documento com entrada inválida é recusado inteiro, inclusive certificado cujo campo de chave diz RSA sobre bytes inválidos (`GetRSAPublicKey` dentro do `try`), e os certificados lidos são descartados; qualquer falha do leitor vira `invalid-document` no fetcher; corpo até 64 KB. **Um prazo único de 5 s cobre envio e leitura do corpo** (corpo que nunca termina não prende a trava da busca), e corpo cortado no meio (`IOException`) é falha de rede, nunca 500. A tentativa conta mesmo se a busca lançar exceção |
| D | Token enorme ou excesso de chamadas de login | Token acima de 8 KB recusado antes de ler; limite de requisições (`decisoes.md:31`), valores na E5.3 |
| E | Token válido por até 1 h depois de exclusão ou bloqueio da conta | Risco aceito (sem `checkRevoked`). A E3.16 mitiga: marca de exclusão do UID, ou recusa de `auth_time` anterior à exclusão, ou `checkRevoked` só no `POST /v1/me` |
| E | Endpoint novo aberto por esquecimento | `FallbackPolicy` exige usuário autenticado; `AllowAnonymous` só em `Program.cs`, com guarda de texto em `Sacou.Architecture.Tests` |
| E | Conta de convidado reivindicada por outra pessoa | Reivindicação por link (`revisao-mvp.md:114`); proteção do link a definir na E3.5 |

## 2. API e autorização por recurso (E3.2)

A parte 1 da E3.2 tem código ([ADR 0039](../arquitetura/adr/0039-sacou-http-e-contratos-entre-modulos.md), [ADR 0040](../arquitetura/adr/0040-grupos-membros-papeis-e-autorizacao.md)): o mapeamento `Result → ProblemDetails`, as regras de JSON dos corpos, o filtro de acesso por grupo e as rotas de criar, listar, detalhar e renomear grupo e de listar membros. A parte 2 acrescenta mudar papel, mudar mensalista × avulso, remover e sair, sob a trava por grupo. As linhas marcadas "parte 3" são decisões ainda sem código.

| | Ameaça | Mitigação |
|---|---|---|
| S | Convite por link ou QR repassado a estranhos | Parte 3: token de 256 bits, só o hash no banco, revogável, válido até ser revogado (decisão do Gabriel, pergunta 17), sem aprovação (pergunta 18); o admin vê quem entrou e remove, e removido não volta pelo link (pergunta 19) |
| S | Adivinhar ou enumerar convite | Parte 3: 256 bits; mesma resposta para inválido, revogado e expirado; prévia e aceite na lista de rotas a limitar (E5.3) |
| T | Disputa pela última vaga | Concorrência otimista com `xmin` (`produto.md:310`, E3.4) |
| T | Reconfigurar grupo ou rodada sem poder | Renomear exige `RenameGroup` (Admin e Co-admin); a configuração do grupo (E3.3) usa `Groups.Contracts.IGroupMembership`. Matriz M1 da parte 1. **Corrida com rebaixamento:** o `UPDATE` do renomear confere o papel na mesma instrução (`EXISTS`), então quem foi rebaixado depois do filtro recebe 403 e o nome não muda (teste com trava de tabela segurando o `UPDATE`) |
| S | Nome de grupo invisível ou que imita outro (largura zero, preenchimento Hangul ou Braille, *zalgo*) | `GroupName` normaliza para NFC e recusa controle, formatação, direção, não atribuído, uso privado, *surrogate* solto, os preenchimentos U+115F, U+1160, U+3164, U+FFA0 e U+2800, mais de 4 marcas por grafema e nome sem letra, número ou símbolo (ADR 0040, D1). Homóglifos de outro alfabeto (cirílico que imita latino) continuam aceitos: o nome não é identificador, e o app mostra quem administra o grupo |
| T | Atribuição em massa (corpo com `groupId`, `userId`, `role` ou campo a mais) | Campo que o DTO não declara é 400, para todo corpo da API (`ApiJson`, `UnmappedMemberHandling.Disallow`); chave repetida, em qualquer caixa, é 400 (`AllowDuplicateProperties = false`); enum só como texto e com um valor só (vírgula é 400). `groupId` só vem da rota. Testes de integração com campos a mais e corpo malformado; nas rotas de papel e tipo (M8): `groupId`, `memberId`, `userId` ou `status` a mais, `"role": 0`, `"1"`, `"owner"`, `null`, `"admin,player"`, corpo vazio e chave repetida em outra caixa dão 400 e o membro não muda; papel e campo em outra caixa são aceitos. Papel e tipo são obrigatórios (`JsonRequired`): faltar nunca vira o valor padrão (`Admin`) |
| R | Admin nega uma alteração | A definir na E5.2 |
| I | Descobrir se um grupo existe | Não membro, ex-membro e removido recebem o **mesmo 404** de um grupo inexistente, conferido byte a byte sem o `traceId` (M2), em detalhe, renomear e membros. Não membro nunca recebe 403 |
| I | Nível privado lido pela API | Privado garantido na API, não só na tela (`produto.md:373`) |
| I | Dados pessoais em respostas de erro | Erro de regra vira `ProblemDetails` com `type`, `title`, `status`, `code` e `traceId`, sem `detail` nem valor recebido (E3.2, teste canário de nome inválido). Desde a E3.1, 401, 503 e 500 saem em `ProblemDetails` sem detalhe (P7) |
| I | Nome do grupo, `userId` ou `sub` em log ou resposta | A lista de membros não tem `userId`, `sub`, e-mail nem nome (M5); `GroupName.ToString` esconde o nome; teste L1 grava todos os logs da API e procura nomes, `sub` e `userId` |
| I | Token de convite em log ou URL | Parte 3: token só no corpo, nunca na rota ou na query; link público com o token no fragmento (E4.16); log sem token nem hash |
| D | Abuso de requisições | Limite de requisições (`decisoes.md:31`); valores a definir na E5.3 |
| D | Grupos, membros ou convites sem fim | Tetos em `GroupLimits`: 100 grupos ativos por pessoa (conferido numa transação com trava por pessoa, para criações simultâneas não passarem juntas), 300 membros por grupo e 20 convites ativos (parte 3). Corpo das rotas de grupo limitado a 4 KB (metadado aplicado pelo Kestrel): o 413 é testado com o Kestrel de verdade (`WebApplicationFactory.UseKestrel`) em criar, renomear, papel e tipo |
| E | Acessar recurso de outro grupo | `GroupAccessFilter` em toda rota com `{groupId}`: membro **ativo** de `(groupId, userId)` lido do banco a cada requisição; cada rota declara exatamente uma permissão, e um teste percorre todas as rotas da API e reprova rota sem o filtro, sem permissão ou fora da lista fechada (A4) |
| E | IDOR de membro ou convite entre grupos | O alvo é procurado no agregado carregado por `group_id` sob a trava: `memberId` de outro grupo, de quem saiu, de quem foi removido ou inexistente dá o mesmo 404 `groups.member-not-found`, e o membro do outro grupo não muda (M6, conferido no banco). Convite na parte 3 (M10) |
| E | Co-admin ou jogador se promove | Tabela de permissões (decisão do Gabriel, pergunta 16) testada nas 36 combinações. Regra de alvo no agregado: mexer em Admin ou Co-admin, ou dar esses papéis, exige `AssignAdminRole` ou `RemoveAdmin` (só Admin), e a resposta é o mesmo 403 `groups.forbidden` do filtro. Testada nas 64 combinações ator × alvo × papel no domínio (D4) e em 34 linhas sobre a API real (M7), com o papel conferido no banco depois |
| E | Rebaixado age entre o filtro e a escrita | Toda escrita de membro julga quem age pelo agregado carregado **sob a trava**, na mesma transação: o co-admin rebaixado depois do filtro recebe 403 e nada muda (teste que segura a linha do grupo, rebaixa e solta). Sem o `FOR UPDATE`, a escrita não espera e o teste falha |
| E | Grupo sem admin por corrida | Trava por grupo (`SELECT ... FOR UPDATE` na linha de `groups.groups`, numa transação explícita, ADR 0040, D8): as escritas de um grupo rodam uma de cada vez. C1 (dois admins rebaixam um ao outro: um 200 e um 403, porque o perdedor já é jogador), C2 (os dois saem: um 204 e um 409 `groups.last-admin`), C3 (um rebaixa o outro enquanto este sai; e um rebaixa a si mesmo enquanto o outro sai: um 409), 5 rodadas cada, com o número de admins ativos conferido no banco. O último admin não sai nem se rebaixa (409); ninguém se remove por `DELETE` (400 `groups.use-leave`) |
| E | Ex-admin volta admin pelo link | Parte 3: quem volta é sempre `Player` (decisão D1, teste D9) |
| E | Ex-membro com acesso por cache | Papel e situação lidos do banco a cada requisição, nunca de claim ou cache; quem saiu ou foi removido recebe 404 (M1). Removido pela rota, o mesmo token recebe 404 na requisição seguinte (M9) |
| E | Usuário autenticado sem registro age no grupo | Sem linha em `identity.users`, toda rota de grupo dá 403 `identity.user-not-registered` antes de qualquer consulta ao grupo (M1) |
| E | Papel Placar com mais poderes | Placar opera a quadra sem outros poderes (`produto.md:62`): no grupo, só `ViewGroup` e `Leave` |

## 3. Sincronização de eventos (E3.7)

| | Ameaça | Mitigação |
|---|---|---|
| S | Celular se passar por outro no envelope | O ID do celular não autentica. Quem pode escrever: a definir na E3.7, com o token de placar da seção 4 |
| T | Evento inconsistente ou forjado: o servidor aplica o resultado sem reimplementar a lógica (`decisoes.md:26`) | Validação do que chega a definir na E3.7. **O evento prova formato, não verdade (E2.2):** `SetEnded` falso passa no replay, e `MemberId` em UUID válido pode não ser do grupo. **Forjar evento vai além de marcar ponto:** marcar pontos não permite vencedor contrário ao placar, trocar `teams` nem baixar `scoring`, mas o replay aceita `MatchEnded` `sets-won` com `winner` contrário aos sets, e fila e estatísticas dependem desses campos. A E3.7 precisa simular o replay e conferir `teams` contra a escalação da rodada, `scoring` contra a configuração resolvida, `SetEnded` contra o placar, `nextSet.targetPoints` contra `scoring` e `MatchEnded` pela regra, com as funções portadas (ADR 0023). Conferir só o `MatchEnded` não basta: `SetEnded` com vencedor em 0–0, duas vezes, seguido de `MatchEnded` `sets-won`, é aceito com sets 2–0. O `winner` de `manual` não é verificável pela regra e precisa de regra própria de autoria ou permissão. O módulo Stats não confia no evento sem isso. **Saque e rotação (E2.3, ADR 0024):** `rotations`, `firstServer`, `nextSet.firstServer` e `nextSet.setterZones` passam no replay mesmo falsos e mudam quem saca. A E3.7 confere `rotations` contra a escalação, `nextSet.firstServer` contra a regra ou um sorteio autorizado e `setterZones` contra o estado. O `firstServer` do sorteio vem de fora do motor: a E3.7 define como autorizá-lo. Marcar ponto não define a rotação diretamente, porque o side-out é derivado do estado; mas o replay aceita ponto além do placar decidido, e pontos alternados levam o time a qualquer zona, ao custo de alterar o placar. A E3.7 recusa ponto em set já decidido na simulação. **Sistema e catálogo (E2.4, ADR 0026):** `rotations.*.system` forjado passa no replay e permitiria usar sistema Pro (4x2, 5x1, 6x2) em grupo grátis, sem vantagem em quadra, mas burlando o plano: a E3.7 confere `system` contra `IGroupPlan` na escrita. `formationsVersion` forjado só faz as posições sumirem para quem assiste àquela partida, porque versão desconhecida dá `null`: a E3.7 confere o número na escrita. **Banco e escalação (E2.5, ADR 0027):** um `LineupChanged` forjado escolhe quem está em quadra, quem saca e, por `setterZone`, a rotação, com efeito em saldo e rating; `rotations.*.bench` forjado no `MatchStarted` também define quem começa no banco. O replay só prova que é uma partição de `teams`. A E3.7 autoriza `LineupChanged` por papel e sessão, confere `MatchStarted.bench` contra a escalação e conta eventos por partida. **Líbero (E2.11, ADR 0028):** um `libero` forjado no `MatchStarted` ou no `LineupChanged` muda quem está em quadra a cada ponto, com efeito em saldo e rating, e um `system` forjado poderia ligá-lo em grupo grátis. O replay só prova a partição, o sistema e a vaga. A E3.7 confere `libero` contra a escalação e `system` contra o plano. **Fila (E2.6, ADR 0029):** um `QueueChanged` ou um `MatchStarted.queue` forjado decide quem joga a próxima e quem sai na saída parcial, com efeito em saldo e rating; o replay só prova o formato e que ninguém da fila está em quadra. A escolha de quem sai é calculada no comando e não é gravada, então o servidor não a reproduz. A E3.7 confere a fila contra a presença da rodada, autoriza `QueueChanged` por papel e sessão, como nos ADR 0027 e 0028, e pode recalcular o plano com `planNextMatch` quando o critério não for sorteio nem manual. **Correções (E2.7, ADR 0030):** um `ServingTeamChanged` forjado decide quem saca e, pela fase, onde está o líbero, com efeito em saldo e rating; o replay só prova o formato e que há partida e set abertos com aqueles números, e aceita `firstServer` contrário ao placar. Um `RevertedTo` de quem recebeu o QR pode tirar da linha do tempo pontos que o admin marcou antes da entrega, e girar é um `LineupChanged` como os outros. O motor não autoriza quem corrige. A E3.7 autoriza `ServingTeamChanged` e `RevertedTo` por papel e sessão, decide se o Placar pode voltar antes do próprio lote e conta eventos por partida. **Ponto individual (E2.8, ADR 0031):** um `PointAttributed` forjado dá aces, bloqueios e ataques a quem não fez, com efeito no resumo, nas estatísticas e na cartinha; o replay só prova o formato, que a partida está aberta e que o autor é da partida, e o resolvedor, que o alvo é ponto ativo daquela partida e o autor é do time que pontuou. Não confere a quadra do rali nem as combinações impossíveis (Ace só do sacador; líbero sem Ace nem Bloqueio), que ficam só no comando `attributePoint`. Um preenchimento órfão ou de autor de fora do time é ignorado em silêncio e ocupa o log sem efeito, e preencher o mesmo ponto várias vezes não tem limite no motor. A E3.7 autoriza por papel e sessão, confere o plano Pro e a opção do grupo pelas configurações congeladas, roda o comando no servidor antes de gravar e conta eventos por partida |
| T | Envelope malformado ou entrada não confiável, inclusive `__proto__` e `NaN` | Parser do envelope com esquema fechado e falha fechada (E2.1), portado para o C# com o mesmo resultado nos golden e chave repetida recusada (E2.10, ADR 0033); a E3.7 usa no servidor. `replayEvents` confia em quem chama: só aceita saída do parser. Parser estrito por tipo para `MatchStarted`, `PointScored`, `SetEnded` e `MatchEnded`, com esquema fechado em todos os níveis (E2.2, ADR 0023). Todos os tipos do M2 têm parser estrito (E2.3 a E2.11). **Lacuna:** o envelope continua aceitando `type` livre de até 64 caracteres, e o que não tem aplicador só é `unknown-event-type` no replay: a E3.7 recusa tipo fora da lista antes de gravar (lista 3.1, item 3) |
| T | Reenvio duplicar pontos | Idempotência com ID gerado no celular (`produto.md:309`) |
| R | Negar uma correção | Desfazer é evento e nunca apaga (`decisoes.md:26`): o `RevertedTo` e o `ServingTeamChanged` ficam no log, e os eventos desfeitos continuam lá, inativos (E2.7). Autoria a definir na E3.7 |
| I | Dado pessoal gravado no stream | Eventos só com IDs (`decisoes.md:28`). Esquema fechado do envelope com teste de nomes proibidos (E2.1, achado A4). Os 4 tipos do placar têm esquema fechado em todos os níveis, com teste de nomes proibidos por tipo e nível (E2.2), inclusive nos níveis novos `rotations`, `rotations.a`, `rotations.b` e `nextSet.setterZones` (E2.3). `rotations.*.system` só aceita a lista `FORMATION_SYSTEMS`, e `formationsVersion` só inteiro ≥ 1, com erro que não ecoa o valor (E2.4). `rotations.*.lineup` só aceita `MemberId` em UUID contido em `teams` do próprio lado. `LineupChanged` tem esquema fechado, com teste de nomes proibidos, e `lineup` e `bench`, nele e no `MatchStarted`, só levam `MemberId` em UUID da partição de `teams`, com erro que não ecoa o valor; sem dado pessoal novo (E2.5). `libero` tem esquema fechado nos níveis `rotations.*.libero` e `libero`, com teste de nomes proibidos, só `MemberId` em UUID e índices inteiros de 0 a 5, com erro que não ecoa o valor (E2.11). `queue` e `QueueChanged` têm esquema fechado nos níveis `queue` e em cada time de `queue.teams` (lista de objetos, conferida também), com teste de nomes proibidos, só `MemberId` em UUID, e erro que não ecoa o valor; o nível nunca entra no evento nem na decisão (E2.6). `PointAttributed` tem esquema fechado, com teste de nomes proibidos, só `matchId`, `pointEventId` e `author` em UUID minúsculo (`author` ou `null`) e `kind` por lista permitida, sem texto livre, 4 valores fixos e erro que não ecoa o valor; o autor por ponto é dado de desempenho ligado ao `MemberId` ([inventário](dados-pessoais.md), E2.8). **Lacuna:** um `type` desconhecido tem payload aberto até o replay o recusar, então nunca é gravado sem a simulação (lista 3.1, item 3). **C# (E2.10, ADR 0033):** os 8 parsers portados, com teste de reflexão sobre propriedades, campos e parâmetros de construtor de `CourtSessions` e record de cada payload igual ao esquema |
| I | Valor recebido devolvido em erro | Erro só com `code` e `eventId` ou `field`; nome de campo desconhecido não volta; teste canário (E2.1) |
| I | ID do celular rastreável | UUID aleatório por instalação (`expo-crypto`), gerado na primeira abertura e gravado em `device`, nunca de hardware (E4.9, ADR 0038); autoria fora do evento ([inventário](dados-pessoais.md)) |
| I | Log de eventos no aparelho (expo-sqlite): o arquivo `sacou.db` guarda só IDs e números, sem nome (teste sobre as colunas), e não é criptografado | Decisão do ADR 0038 (E4.9): nada pessoal para proteger além do `deviceId` e dos `MemberId`; os nomes ficam no cache do servidor. SQL só com parâmetros. Log adulterado num aparelho com root falha fechado (`corrupted-log` ou `replay-failed`), sem apagar nada e sem ecoar o valor. **Backup:** o backup automático do Android (e a restauração do iPhone num aparelho novo) copiaria o `deviceId` para outro celular; mitigação `android.allowBackup: false` no `app.json` (E4.9, parte 3), e o servidor detecta dois aparelhos com o mesmo `deviceId` pelo `sequence-conflict` (E3.7) |
| D | Lote grande ou volume alto de eventos | Limite de requisições (`decisoes.md:31`); tamanho do lote a definir na E3.7. O parser limita o payload a 32 níveis e 4096 valores, com referência repetida contada a cada visita, e o `type` a 64 caracteres (E2.1). `LineupChanged` só permuta membros: não aumenta o estado, e o payload tem no máximo 30 valores (E2.5), mais o líbero, com 1 `MemberId` e no máximo 2 índices (E2.11). A fila (E2.6) é trocada, nunca acumulada: o estado não cresce por evento, e `queue` tem no máximo 96 `MemberId` (`MAX_QUEUE_MEMBERS`) e 96 times, abaixo de 300 valores, cerca de 4,1 KB por `QueueChanged` com envelope; com a fila máxima, 64 mil `QueueChanged` dão 262 MB de log, 2,6 s de parse, 5,1 s de replay e 488 MB retidos, e o processo cai com heap de 256 MB já ao montar o log (Node, E2.6). É o evento mais caro por byte: a E3.7 dimensiona lote e stream por bytes com ele e conta `QueueChanged` por partida; o aplicador aceita `QueueChanged` igual ao estado, e só o comando recusa; a E3.7 conta `QueueChanged` por partida, como o `LineupChanged`. `getConsecutiveMatches` varre até 200 partidas a cada plano: custo baixo, a medir na E4.9. `ServingTeamChanged` (E2.7) troca dois campos fixos e tem 4 valores: o estado não cresce. `PointAttributed` (E2.8) não muda o estado e tem 4 valores; `resolvePointAttributions` é linear na linha do tempo, e `getRecentPoints` o roda uma vez por chamada. `replayTimeline` guarda uma referência por evento ativo, sem copiar estado (64 mil pontos: cerca de 0,25 s de replay e 19,2 MB retidos, sem piora em relação à E2.2; cadeia de `RevertedTo` linear; um `RevertedTo` com alvo inexistente percorre a linha inteira antes de falhar, o que soma ao custo de simular o stream a cada lote na E3.7), e a tela 24 refaz o replay a cada abertura: a E4.9 mede no celular. Era o evento mais caro por byte antes do `QueueChanged` (E2.6): com 24 membros por time, 64 mil eventos dão 81 MB de log, 7,6 s de replay e 55,6 MB de timeline (869 B por evento), e com heap de 256 MB, 64 mil passam e 96 mil derrubam o processo (Node 22). A E3.7 dimensiona com esse caso, não com o de side-out, e limita lote e stream por bytes ou conta `LineupChanged` por partida. O aplicador também aceita o evento entre um `SetEnded` sem próximo set e o `MatchEnded`, o que muda a escalação final gravada: a E3.7 recusa isso na simulação, ou o Stats usa só a escalação de cada ponto. O estado para de crescer em 200 partidas terminadas (`MAX_FINISHED_MATCHES`, E2.2): novo `MatchStarted` é `event-rejected`, o que barra o crescimento quadrático de memória e tempo. **Lacunas:** o parser não limita o tamanho dos textos nem o total do payload, nem o número de eventos, a cargo do servidor (E3.7). **C# (E2.10, ADR 0033, .NET 10, Release, medianas de 5):** 64 mil pontos simples: 18,8 MB de log, 0,73 s de parse, 0,37 s de replay, 68,9 MB retidos com o log; com rotação, 24 por time e side-out em todo ponto: 0,74 s, 0,40 s, 74,7 MB; 64 mil `LineupChanged` com 24 por time: 78,2 MB de log, 1,75 s, 1,60 s, 293,5 MB; 64 mil `QueueChanged` com fila de 96: 251,8 MB de log, 10,32 s, 6,83 s, 926,7 MB; 200 partidas terminadas: 0,14 s de replay, sem custo de cópia visível. Com heap de 256 MB, os dois cenários de ponto e as 200 partidas passam, e `LineupChanged` e `QueueChanged` dão `OutOfMemoryException`, que no .NET pode derrubar a requisição ou o processo; a defesa é o limite por bytes. O `RawValueReader` monta a árvore inteira antes do orçamento de 4096 nós do parser, cerca de 32 vezes o tamanho do corpo (corpo de 2 MB aloca 72,9 MB; de 8 MB, 253,8 MB): a E3.7 limita os bytes de cada envelope antes do leitor (16 a 64 KB cabem um `QueueChanged` máximo), além do corpo e do lote, ou usa um leitor com orçamento de nós. A E3.7 nunca registra `JsonException.Message` em log, porque ela ecoa o byte e a posição inválidos. A falta de memória continua possível de forma linear, que o `try/catch` não pega: cerca de 78 MB de log derrubam o parser com heap de 256 MB. Simular o stream inteiro a cada lote soma custo: a E3.7 limita o lote por bytes e por eventos e dimensiona o limite de requisições, ou usa snapshot. Com 64 mil eventos, parser e replay levaram cerca de 1 s no caso barato, só de pontos; o pior caso medido tem 4,2 vezes mais bytes e leva cerca de 5 vezes mais tempo. Com rotação ligada, 24 membros por time e side-out em todo ponto (E2.3, Node 22, sem Hermes), 64 mil eventos somam 18,9 MB de log e retêm 22,7 MB (372 B por evento, contra 292 B sem side-out); a mediana do replay sobe cerca de 30%, de 1,2 s para 1,57 s, em máquina ocupada, e o crescimento segue linear. Com heap de 256 MB, 192 mil eventos passam e 256 mil derrubam o processo. Quem tem token de placar pode gastar a cota de partidas com 400 eventos válidos (cerca de 160 KB), e novas partidas ficam recusadas até um `RevertedTo`: a E3.7 cobre isso com limite de requisições e as conferências acima |
| D | Evento ruim gravado trava a quadra, porque a falha fechada impede recalcular o stream. Inclui ponto de set já encerrado e, com a ordem por `batch`, evento anterior ao `MatchStarted` (E2.2) | A E3.7 simula o replay antes de persistir e rejeita ali. **No log local isso já vale (E4.9, ADR 0038):** o controlador monta os envelopes pelo parser, faz o `replayTimeline` do log com os eventos novos e só grava o que faz replay, com `SetEnded` e `MatchEnded` na mesma transação |
| E | Escrever em stream de outra quadra | Token de placar só daquele stream (`produto.md:357`); autorização do admin por recurso (`decisoes.md:27`) |

**Limite do parser (E2.1):** `MAX_PAYLOAD_NODES` conta nós, não bytes. O corpo da requisição precisa de limite de tamanho antes do parser (E3.7).

### 3.1 O que a E3.7 e a E3.8 precisam fazer

Lista única, consolidada na [revisão do M2](revisoes/M2-2026-11-03.md) a partir da tabela acima, dos ADRs 0022 a 0033 e das pendências de `progresso.md`. Não cria regra nova: em dúvida, vale a tabela. Cada item é critério de aceite da tarefa indicada e é conferido pelo `revisor-seguranca` dela.

1. **Bytes antes do leitor (E3.7):** limite do corpo da requisição, do lote (bytes e número de eventos) e de cada envelope antes do `RawValueReader` (16 a 64 KB, acima do `QueueChanged` máximo, de cerca de 4,1 KB), ou leitor com orçamento de nós. O orçamento de 4096 nós não basta: o leitor monta a árvore antes, cerca de 32 vezes o corpo.
2. **Contagem por partida e por stream (E3.7):** teto de eventos por partida para `LineupChanged`, `QueueChanged`, `ServingTeamChanged`, `RevertedTo` e `PointAttributed` (inclusive preenchimentos repetidos do mesmo ponto), e teto de bytes do stream, dimensionados pelo `QueueChanged`, o pior caso medido. Recusar `QueueChanged` igual ao estado. O limite de requisições cobre o gasto da cota de 200 partidas.
3. **Simular antes de gravar (E3.7; E4.9 no aparelho):** nada entra no stream sem o parser estrito e o replay do stream com o lote. Recusa tipo desconhecido, ponto em set decidido, evento entre `SetEnded` sem próximo set e `MatchEnded`, `PointAttributed` órfão ou de autor de fora e `RevertedTo` sem alvo. Custo: snapshot ou os limites dos itens 1 e 2.
4. **Autorização por papel e sessão (E3.7 e E3.8):** quem pode enviar cada tipo. `LineupChanged`, `QueueChanged`, `ServingTeamChanged`, `RevertedTo`, `PointAttributed` e o `winner` de `manual` exigem papel; o `firstServer` do sorteio precisa de origem autorizada. O ID do celular não autentica.
5. **Evento prova formato, não verdade (E3.7):** `teams`, `rotations`, `bench` e `libero` contra a escalação da rodada; `queue` contra a presença; `scoring` e `nextSet.targetPoints` contra a configuração congelada; `SetEnded` e `MatchEnded` contra o placar e a regra; `nextSet.firstServer` e `setterZones` contra a regra e o estado; `system` contra `IGroupPlan`; `ServingTeamChanged` e `PointAttributed` pelo comando rodado no servidor (plausibilidade de `attributePoint`, plano Pro e opção do grupo).
6. **`RevertedTo` pelo QR (E3.8):** o escopo do token decide se o Placar pode voltar antes do próprio lote. Recomendação da revisão do M2: não pode; só o admin.
7. **Versões (E3.7):** `schemaVersion`, `rulesVersion` e `formationsVersion` contra listas de versões suportadas, não só a atual, por causa do app antigo offline. Como side-out, giro e líbero são calculados e não gravados (exceção a `decisoes.md:26`), mudar essas regras exige subir `rulesVersion` e manter a regra antiga no replay dos logs antigos.
8. **Erros e logs (E3.7):** nunca registrar `JsonException.Message` (ecoa byte e posição) nem o corpo recebido; a resposta leva só `code` e `eventId` ou `field`.
9. **Token do placar (E3.8):** uso único, validade, formato e tamanho, revogação quando o admin retoma, escopo só daquele stream e fora dos logs (seção 4).
10. **Identificadores (E3.7):** projeções e Stats por `(courtSessionId, matchId)`; UUID sem conferência de versão é opaco, nunca carrega dado.

## 4. QR do placar (E3.8)

Ver também a seção 3 e a lista 3.1 (itens 4, 6 e 9): um `RevertedTo` de quem recebeu o QR pode apagar pontos marcados pelo admin antes da entrega (E2.7). A E3.8 decide o escopo do token, inclusive se o placar pode voltar antes do próprio lote.

Sessão daquela quadra, conforme `decisoes.md:21` e [ADR 0013](../arquitetura/adr/0013-scorekeeper-qr-token.md).

| | Ameaça | Mitigação |
|---|---|---|
| S | QR fotografado ou repassado | Código de uso único (`produto.md:357`); validade a definir na E3.8 |
| S | Adivinhar o código | Formato e tamanho a definir na E3.8; limite de requisições (`decisoes.md:31`) |
| T | Dois celulares escrevendo | Um celular escreve por vez (`decisoes.md:21`); celular antigo é recusado após a entrega (aceite da E3.8) |
| R | Identificar quem marcou com a sessão temporária | A definir na E3.8 |
| I | Token de placar em logs | Logs sem tokens (`produto.md:375`) |
| D | Admin perde o controle da quadra | O admin pode retomar (`decisoes.md:21`) |
| E | Token usado em outro stream ou outra ação | Válido só para aquele stream, sem outros poderes (`produto.md:121, 357`) |
| E | Token continua válido depois da sessão | Validade e revogação a definir na E3.8 |

## 5. Upload de foto (E3.14)

| | Ameaça | Mitigação |
|---|---|---|
| S | Enviar foto para o perfil de outra pessoa | A definir na E3.14 |
| T | Arquivo que não é imagem, ou fora do formato | Validação a definir na E3.14 |
| R | Negar o envio de foto imprópria | A definir na E3.14 |
| I | Localização ou aparelho nos metadados | WebP sem EXIF, só o recorte (`decisoes.md:18`) |
| I | Foto mostrada sem consentimento | Consentimento na cartinha (`produto.md:373`) |
| I | Foto acessível por URL depois da exclusão | Exclusão apaga a foto (`produto.md:371`); acesso aos arquivos no R2 a definir na E3.14 |
| I | Foto imprópria de terceiro | Denúncia, bloqueio e remoção (`produto.md:374`) |
| D | Arquivos enormes gerando custo | Limite de tamanho a definir na E3.14 |
| E | Credencial do R2 exposta no app | Como o app envia o arquivo: a definir na E3.14 |

## 6. Pix copia e cola (E3.10)

| | Ameaça | Mitigação |
|---|---|---|
| S | Jogador marca pagamento que não fez | "Já paguei" exige confirmação do admin (`produto.md:65`) |
| T | Troca da chave Pix do organizador por outra | Autorização por recurso (`decisoes.md:27`); registro da alteração a definir na E3.10 |
| T | Código copia e cola adulterado | CRC16 detecta erro, mas não prova origem (E1.4); proteção contra adulteração a definir na E3.10 |
| R | Disputa sobre quem confirmou | Exibido como "pago (marcado por Fulano)" (`produto.md:65`) |
| I | Chave Pix vazada do banco | Criptografada no banco (`produto.md:375`); algoritmo e gestão da chave a definir na E3.10 |
| T | Campo forjado no código por entrada que não é string (array passa na regex por coerção) | Gerador rejeita o que não é string (E1.4). A E3.10 valida o tipo também na fronteira |
| T | Chave com formato certo, mas CPF ou CNPJ inexistente | O gerador só confere formato (E1.4). A E3.10 confere o dígito verificador de CPF e CNPJ |
| I | Chave Pix vazada por log, evento, telemetria ou URL | Gerador puro, sem log (E1.4): erro só com `code`. O teste canário cobre só o resultado do erro, **não log**. O código gerado contém a chave; a E3.10 não pode enviá-lo a esses destinos e precisa cobrir isso com teste próprio |
| I | Pagador vê a chave do organizador no código | Inerente ao Pix; deve constar no aviso de privacidade (E3.10) |
| I | Exposição de devedores | Lembrete neutro, nunca lista pública (`produto.md:65`) |
| D | Geração abusiva de códigos | Limite de requisições (`decisoes.md:31`) |
| E | Não admin confirma pagamento | Confirmação do admin (`produto.md:65`) com autorização por recurso (`decisoes.md:27`) |

## 7. Webhooks da RevenueCat (E3.15)

Nenhum documento descreve como a API recebe o estado da assinatura; o webhook é uma hipótese a confirmar na E3.15. No piloto o Pro é liberado de graça (`decisoes.md:20`).

| | Ameaça | Mitigação |
|---|---|---|
| S | Chamada forjada liberando o Pro | A definir na E3.15 |
| T | Conteúdo alterado | A definir na E3.15 |
| R | Disputa sobre o estado da assinatura | A definir na E3.15 |
| I | Dados pessoais vindos da RevenueCat | A definir na E3.15 |
| D | Repetição ou excesso de chamadas | Limite de requisições (`decisoes.md:31`); idempotência a definir na E3.15 |
| E | Plano aplicado a outro grupo | Ligação da assinatura ao grupo a definir na E3.15 |

## 8. Página web da rodada (E3.12)

| | Ameaça | Mitigação |
|---|---|---|
| S | Sessão roubada na página | Login na própria página (`decisoes.md:7`); sessão a definir na E3.12 |
| S | Confirmar presença por outra pessoa | VOU exige login (`produto.md:115`) |
| T | Conteúdo malicioso em apelidos ou textos | A definir na E3.12 |
| T | Ação disparada por outro site | A definir na E3.12 |
| R | Negar a confirmação | A definir na E3.12 |
| I | Prévia no WhatsApp ou página aberta mostrando demais: a prévia traz título e contagem (`produto.md:115`) | O que aparece sem login: a definir na E3.12. Nível nunca (`decisoes.md:16`) |
| D | Abuso da página pública | Limite de requisições (`decisoes.md:31`) |
| E | Ação de admin pela página | Autorização por recurso (`decisoes.md:27`) |

## 9. SignalR, placar ao vivo (E3.7)

| | Ameaça | Mitigação |
|---|---|---|
| S | Espectador sem permissão | Quem pode assistir: a definir na E3.7 |
| T | Cliente envia pontos pelo canal ao vivo | A definir na E3.7 |
| R | Sem registro do que foi transmitido | Stream é a fonte (`decisoes.md:26`) |
| I | Dado pessoal no canal | Eventos só com IDs (`decisoes.md:28`); o que mais é enviado: a definir na E3.7 |
| D | Excesso de conexões | A definir na E3.7 |
| E | Entrar no canal de outra quadra | A definir na E3.7 |

## 10. Outras superfícies em aberto

| Superfície | Ameaça | Mitigação |
|---|---|---|
| Resumo com IA (E3.13) | I: dados enviados ao provedor | Provedor ainda não definido ([`perguntas.md`](../estado/perguntas.md), item 4); dados enviados a definir na E3.13 |
| Resumo com IA (E3.13) | T: texto de usuário alterando o resumo | A definir na E3.13. Falha usa texto padrão (aceite da E3.13) |
| Resumo com IA (E3.13) | D: custo por uso abusivo | Cota por grupo (`revisao-mvp.md:116`) |
| Sentry, PostHog e logs (E5.2) | I: dado pessoal enviado a terceiros | Logs sem e-mails nem tokens (`produto.md:375`); o que vai para Sentry e PostHog a definir na E5.2 |
| Backups no R2 (E5.3) | I: cópia do banco exposta | Criptografia e acesso a definir na E5.3; retenção em `perguntas.md`, item 2 |
| CI e repositório | I: segredo em commit | Varredura de segurança na CI (`varredura-ci.md`) |

## 11. CI e cadeia de suprimentos (E0.4, E0.6, E0.9)

Revisado em 01/11/2026 ([parecer](revisoes/M1-2026-11-01.md)). Aqui, "Mitigação" é o que já existe.

| Ameaça | Mitigação | Lacuna |
|---|---|---|
| T: action comprometida ou movida | SHA obrigatório e lista de actions na configuração do repositório | Nenhuma: a configuração não muda por PR |
| T: dependência npm maliciosa | Lockfile congelado, `allowBuilds` e `tarball:` só de `registry.npmjs.org` (`test:tooling`) | `resolution` do tipo `git` não é checada |
| T: dependência NuGet alterada | Auditoria, `packages.lock.json` com `RestoreLockedMode` na CI e `nuget.config` com fonte única mapeada | Atualizar o lockfile localmente aceita o que a fonte entregar; a barreira é a leitura do diff |
| T: binário do gitleaks trocado | SHA-256 fixado | Nenhuma |
| T: imagem do `docker.io` trocada (E0.6) | Postgres e Ryuk fixados por digest; a CI confere o digest do Ryuk | Atualizar é decisão manual |
| E: Ryuk privilegiado com acesso ao socket do Docker (E0.6) | Imagem fixada pelo pacote `Testcontainers` `[4.16.0]`; só em teste | Risco aceito |
| T, D: porta do Ryuk sem autenticação, em todas as interfaces (E0.6) | Container dura só a execução | Risco aceito pelo Gabriel em 01/11/2026 |
| T: árvore NuGet do Testcontainers com acesso ao Docker (E0.6) | Versão exata, auditoria do projeto, lockfile e mapeamento de fontes (SEC-M1) | A árvore segue acessando o Docker em teste |
| T, E: PR edita a própria barreira ou adiciona workflow | Leitura do revisor e `contents: read`, sem segredos | Sem proteção de branch |
| I: vazamento pelo log da CI | `--redact`, sem artefato | O e-mail do autor aparece no achado |
| I: valor preso em `refs/pull` | Revogar o segredo; a sonda usa valor fictício | Nenhuma |
| D: abuso de minutos ou cache | Timeouts, cancelamento em PR e cache isolado por ref | Nenhuma com um único colaborador |
| R: exceção eterna do audit | `test:tooling` cobra a validade | Formas que escapam da política (SEC-M1) e cobrança só em execução com código |
| T: fonte do app adulterada (E4.1) | TTF versionados no repositório, de repositórios oficiais, com SHA-256 no ADR 0034; sem download em execução | Conferir o hash exige comparar com a fonte oficial |
