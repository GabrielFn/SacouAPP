# Rodadas, recorrência e presença

Regras do módulo Sessions (E3.4). Decisões técnicas no [ADR 0043](../arquitetura/adr/0043-rodadas-presenca-e-espera.md). As rotas e a persistência entram na Parte 2.

## Rodada

Uma ocorrência do racha (`Round`; no glossário, "Rodada"): grupo, série (opcional), data e hora **locais** em `America/Sao_Paulo`, o instante de início, o local (0 a 80 caracteres), a camada de configuração (opcional, só a da rodada; o resto vem do grupo) e a situação (`Scheduled` ou `Canceled`). Cancelar não apaga: as presenças ficam no histórico.

- **Data e hora:** `YYYY-MM-DD` e `HH:mm`, só esses formatos. O admin só cria no futuro e até 365 dias adiante.
- **Editar:** recusado (`sessions.round-closed`) com a rodada cancelada ou já começada.
- **Fim da rodada (E3.18, [ADR 0072](../arquitetura/adr/0072-votacao-do-mvp.md), D1):** "Encerrar rodada" grava `closedAt`; sem toque, a rodada termina sozinha 6 h depois do início. `endsAt` é o menor dos dois (um toque depois do fim automático não adia). Fechar de novo devolve o mesmo `closedAt`; cancelada não fecha (`sessions.round-canceled`); antes do início também não (`sessions.round-not-started`). Eventos da quadra que chegam depois ainda contam. É a âncora da votação do MVP ([mvp.md](mvp.md)).
- **Cartões do Início e da aba Grupos (R97, D3):** cada rodada agendada cai numa janela só, sem sobreposição: **próxima** (`now < startsAt`), **rolando agora** (`startsAt ≤ now < endsAt`, abre a 06, onde o admin sorteia de novo ou abre a quadra) e **recente** ("Ver resumo", de `endsAt` até `endsAt + 24 h`). Encerrar cedo move `endsAt` para o `closedAt`, então a rodada vira recente nesse instante. Cancelada nunca é próxima, rolando agora nem recente. Na aba Grupos, a rodada rolando agora toma o lugar da próxima no cartão ("Editar rodada" continua editando a próxima).
- **Horário de verão:** hora que não existe avança pelo tamanho do pulo (00h30 de 04/11/2018 vira 01h30); hora repetida fica com a primeira (23h30 de 16/02/2019 é a do horário de verão).

## Presença

Uma por membro por rodada.

| Estado | Ocupa vaga | Quando |
|---|---|---|
| `Going` | sim | Confirmou com vaga livre, ou mensalista pré-confirmado |
| `NotGoing` | não | Disse "não vou", desistiu, saiu da espera ou deixou o grupo |
| `Waitlisted` | não | Confirmou com a rodada cheia e a espera ligada |
| `Promoted` | sim | Estava na espera e ganhou a vaga sozinho |

| De \ resposta | vou | não vou |
|---|---|---|
| nenhuma ou `NotGoing` | vaga livre: `Going`; cheia com espera: `Waitlisted`; cheia sem espera: `sessions.round-full` | `NotGoing` |
| `Going` ou `Promoted` | sem mudança | `NotGoing` e o 1º da espera é promovido |
| `Waitlisted` | sem mudança (mantém a posição) | `NotGoing` (sai da espera) |

- **Ordem:** a cada "vou" que muda de estado a presença recebe um número de ordem (`Sequence`) do contador da rodada. A espera é a lista `Waitlisted` por esse número; a posição é calculada e nunca gravada. "Vou" repetido não muda a ordem.
- **Promoção automática:** ao fim de toda escrita, enquanto houver vaga livre e alguém na espera, o 1º da espera vira `Promoted`. Ninguém precisa aceitar.
- **Sem limite de vagas** (`attendance.capacityLimited` desligado): todo "vou" é `Going`; ligar de novo não tira ninguém.
- **Presença desligada** (`attendance.enabled` desligado): respostas recusadas com `sessions.attendance-disabled`.
- **Até quando responde:** o jogador responde até a hora de início (`sessions.round-closed` depois). O admin responde por qualquer membro a qualquer hora, respeitando a vaga e ignorando a janela dos avulsos.
- **Quem saiu do grupo** (saiu ou foi removido) vira `NotGoing` na reconciliação, e a vaga vai para o 1º da espera.

## Mensalista e avulso

- **Mensalista entra confirmado:** ao criar a rodada, cada mensalista ativo ganha `Going` (origem `Regular`) na ordem de entrada no grupo, se a presença e `attendance.regularsEnabled` estiverem ligados. Quem vira mensalista depois só entra nas próximas.
- **Mais mensalistas que vagas** (padrão da pergunta 24): os que sobram vão para a espera, na mesma ordem, **à frente** de qualquer avulso.
- **Mensalista que disse "não vou" e volta** (pergunta 25): um "vou" como qualquer outro, no fim da espera; sem fura-fila.
- **Reduzir as vagas** (pergunta 26) não tira ninguém: só fecha a porta para os próximos.
- **Janela dos avulsos** (`attendance.dropInWindowEnabled`, `dropInOpensHoursBefore`): antes de `início − horas` o "vou" do avulso é `sessions.drop-in-window-closed`; a contagem é de instante. O "não vou" passa sempre. Mensalista e admin não têm janela. Convidado é avulso.
- **O tipo vem do Groups na hora da resposta**, nunca da presença.

## Recorrência

"Repetir toda semana" cria uma série: dia da semana, hora local e local. A série não guarda configuração; cada ocorrência nasce herdando o grupo.

- **Quando nasce a próxima:** cada série ativa mantém uma ocorrência futura não cancelada. Se a futura foi cancelada ou já começou, nasce a seguinte: a primeira data do dia da semana que começa depois de agora e depois das que a série já tem. Série parada por semanas faz uma rodada à frente, nenhuma no passado.
- **Semanal é a mesma hora local**, não sete dias de instante.
- **Parar a série** não apaga a ocorrência já criada; parar de novo não muda nada.

## Link da rodada (E3.12)

Decisões no [ADR 0070](../arquitetura/adr/0070-pagina-web-da-rodada.md).

- **Código:** cada rodada tem um código de 22 caracteres (Base64url, 128 bits aleatórios) para o link público `{base}/r/{código}`. Nasce com a rodada (criada pelo admin ou pela série); rodada antiga ganha o seu na primeira vez que um Admin ou Co-admin abre o detalhe. Não muda e morre com a rodada.
- **Quem vê o link:** só Admin e Co-admin (`shareUrl` na resposta da rodada), porque o link põe gente no grupo (pergunta 130).
- **Entrar pelo link:** quem não é membro entra no grupo como Jogador e avulso, com as regras do convite: removido não volta (403), quem saiu volta com o mesmo `MemberId` como Jogador e avulso, tetos de 300 membros e 100 grupos por pessoa. Membro ativo fica como está.
- **Quando:** só com a rodada não cancelada e antes do início; no instante do início já fechou (`sessions.round-closed`), e ninguém entra no grupo.
- **Responder pelo link:** as mesmas regras do VOU do app (janela dos avulsos, vagas, espera). Se a resposta for recusada depois da entrada, a pessoa fica no grupo e a recusa diz `joined`.
- **Canal:** cada presença guarda de onde veio a resposta que a mudou por último (`app` ou `web`), para a métrica da E7.2. VOU repetido não muda o canal; promoção da espera também não; a pré-confirmação dos mensalistas é `app`.

## Eventos

`RoundCreated`, `RoundCanceled`, `RoundEnded`, `AttendanceChanged`, `WaitlistPromoted`: só IDs (rodada, grupo, membro), estado e instante.

## Códigos de erro

| Código | Quando |
|---|---|
| `sessions.round-invalid` (400) | Data ou hora fora do formato, no passado, a mais de 365 dias, local fora da regra |
| `sessions.round-date-taken` (409) | `PATCH` moveu uma rodada da série para uma data em que a série já tem rodada |
| `sessions.round-not-found` (404), `sessions.series-not-found` (404), `sessions.member-not-found` (404) | Não existe neste grupo (inexistente, de outro grupo e quem saiu parecem iguais) |
| `sessions.round-closed` (409) | Cancelada, ou jogador depois do início, ou edição de rodada cancelada ou começada |
| `sessions.round-full` (409) | Cheia e sem espera |
| `sessions.round-canceled` (409) | "Encerrar rodada" numa rodada cancelada |
| `sessions.round-not-started` (409) | "Encerrar rodada" antes do início da rodada |
| `sessions.drop-in-window-closed` (409) | Avulso antes da janela |
| `sessions.attendance-disabled` (409) | Presença desligada na rodada |
| `sessions.round-limit`, `sessions.series-limit` (409) | Tetos de 20 rodadas futuras e 7 séries ativas por grupo |
| `sessions.round-link-invalid` (404) | Código do link fora do formato ou de nenhuma rodada (mesma resposta) |

## Permissões

`ManageRounds` (criar, editar, cancelar, parar a série, mexer na lista): Admin e Co-admin. `WriteCourt` (encerrar a rodada, como quem marca a quadra): Admin, Co-admin e Placar. `RespondAttendance` (responder por si): os quatro papéis. Ver a rodada é `ViewGroup`. Tabela completa em [grupos.md](grupos.md).

## Rotas (E3.4, Parte 2)

Todas sob `/v1/groups/{groupId}`, com o filtro do Sessions (mesmas respostas do Groups). Corpos fechados e de até 4 KB; datas `YYYY-MM-DD`, horas `HH:mm`.

| Rota | Capacidade | Sucesso |
|---|---|---|
| `POST /rounds` | `ManageRounds` | 201, mensalistas já confirmados; `repeatWeekly` cria a série |
| `GET /rounds` | `ViewGroup` | 200, futuras e últimas 24 h; materializa as séries |
| `GET /rounds/{roundId}` | `ViewGroup` | 200, repara se preciso |
| `PATCH /rounds/{roundId}` | `ManageRounds` | 200; `settings` substitui a camada (`{}` a limpa) |
| `POST /rounds/{roundId}/cancel` | `ManageRounds` | 200 (de novo, sem efeito) |
| `POST /rounds/{roundId}/close` | `WriteCourt` | 200 `{ closedAt, endsAt }` (de novo, o mesmo `closedAt`), `Cache-Control: no-store` |
| `PUT /rounds/{roundId}/attendance/me` | `RespondAttendance` | 200 `{ status, position }` |
| `PUT /rounds/{roundId}/attendance/{memberId}` | `ManageRounds` | 200; ignora janela e horário, respeita a vaga |
| `POST /series/{seriesId}/stop` | `ManageRounds` | 204 (de novo, 204) |
| `POST /rounds/{roundId}/draw` | `DrawTeams` | 200 com os times e as notas, `Cache-Control: no-store` ([sorteio.md](sorteio.md)) |

Rotas do link (E3.12), **sem** `{groupId}`, com o código no corpo e `Cache-Control: no-store`:

| Rota | Quem | Sucesso |
|---|---|---|
| `POST /v1/round-links/resolve` `{ code }` | logado e registrado | 200 `{ isOpen, groupId, roundId, isMember }`; IDs nulos com a rodada cancelada ou começada |
| `POST /v1/round-links/attendance` `{ code, response }` | logado e registrado | 200 `{ groupId, roundId, memberId, joined, status, position }`; entra como avulso se preciso |

Notas de comportamento: `Sequence` pode ter buracos (um "não vou" sem linha anterior grava a linha com o valor atual do contador, sem gastá-lo: só entra na ordem quem fica com vaga ou na espera, e o índice único de `(round_id, sequence)` ignora linhas `not_going`); `Source` guarda de onde a linha **veio** e não muda quando a pessoa desiste ou é tirada (ADR 0043, D6); a posição na espera é calculada, nunca gravada.

## Tela de rodadas do grupo (R97 Parte 2, ADR 0075)

Rota `groups/[groupId]/rounds`; lê só `GET /rounds` (a API não mudou) e o papel em `GET /groups`.

- **Estados** (a partir de `status`, `startsAt` e `endsAt`, no relógio do aparelho): `canceled`; `live` (`startsAt ≤ agora < endsAt`); `ended` (`endsAt ≤ agora`); `open` (antes do início). O texto de cada um: "Aberta", "Rolando agora", "Encerrada · Ver resumo", "Cancelada".
- **Seções:** "Próximas" = `open`, `live` e canceladas que ainda não começaram, da mais cedo para a mais tarde (a "Rolando agora" fica em primeiro). "Recentes" = `ended` e canceladas que já começaram, da mais nova para a mais velha; some quando vazia.
- **Destino do toque:** a rodada encerrada abre o resumo (12); as outras abrem a 06 (que escolhe a visão de admin ou de jogador).
- **Janela de "Recentes":** só o que a API devolve, ou seja, até 24 h depois do fim (a mesma do cartão "Ver resumo" do Início). Histórico maior pede `?pastDays` na API (pergunta P4).
- **"Nova rodada":** só admin e co-admin veem o botão; a API é quem recusa. A 20 sugere o próximo dia fixo do grupo que ainda não tem rodada `scheduled`; dois rachas no mesmo dia continuam válidos.
- **Início:** um cartão por rodada futura dos próximos 7 dias (janela móvel de agora até agora + 7 dias, sem corte de semana, R98), de todos os grupos, por horário; sem rodada na janela, a próxima.
- **"Nova rodada" hoje:** o seletor de data começa em hoje e oferece 14 dias; um horário de hoje que já passou continua recusado (`timePast`). A data sugerida segue sendo o próximo dia do grupo.
