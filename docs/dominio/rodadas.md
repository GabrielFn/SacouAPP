# Rodadas, recorrência e presença

Regras do módulo Sessions (E3.4). Decisões técnicas no [ADR 0043](../arquitetura/adr/0043-rodadas-presenca-e-espera.md). As rotas e a persistência entram na Parte 2.

## Rodada

Uma ocorrência do racha (`Round`; no glossário, "Rodada"): grupo, série (opcional), data e hora **locais** em `America/Sao_Paulo`, o instante de início, o local (0 a 80 caracteres), a camada de configuração (opcional, só a da rodada; o resto vem do grupo) e a situação (`Scheduled` ou `Canceled`). Cancelar não apaga: as presenças ficam no histórico.

- **Data e hora:** `YYYY-MM-DD` e `HH:mm`, só esses formatos. O admin só cria no futuro e até 365 dias adiante.
- **Editar:** recusado (`sessions.round-closed`) com a rodada cancelada ou já começada.
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

## Eventos

`RoundCreated`, `RoundCanceled`, `AttendanceChanged`, `WaitlistPromoted`: só IDs (rodada, grupo, membro), estado e instante.

## Códigos de erro

| Código | Quando |
|---|---|
| `sessions.round-invalid` (400) | Data ou hora fora do formato, no passado, a mais de 365 dias, local fora da regra |
| `sessions.round-not-found` (404), `sessions.series-not-found` (404), `sessions.member-not-found` (404) | Não existe neste grupo (inexistente, de outro grupo e quem saiu parecem iguais) |
| `sessions.round-closed` (409) | Cancelada, ou jogador depois do início, ou edição de rodada cancelada ou começada |
| `sessions.round-full` (409) | Cheia e sem espera |
| `sessions.drop-in-window-closed` (409) | Avulso antes da janela |
| `sessions.attendance-disabled` (409) | Presença desligada na rodada |
| `sessions.round-limit`, `sessions.series-limit` (409) | Tetos de 20 rodadas futuras e 7 séries ativas por grupo |

## Permissões

`ManageRounds` (criar, editar, cancelar, parar a série, mexer na lista): Admin e Co-admin. `RespondAttendance` (responder por si): os quatro papéis. Ver a rodada é `ViewGroup`. Tabela completa em [grupos.md](grupos.md).

## Rotas (E3.4, Parte 2)

Todas sob `/v1/groups/{groupId}`, com o filtro do Sessions (mesmas respostas do Groups). Corpos fechados e de até 4 KB; datas `YYYY-MM-DD`, horas `HH:mm`.

| Rota | Capacidade | Sucesso |
|---|---|---|
| `POST /rounds` | `ManageRounds` | 201, mensalistas já confirmados; `repeatWeekly` cria a série |
| `GET /rounds` | `ViewGroup` | 200, futuras e últimas 24 h; materializa as séries |
| `GET /rounds/{roundId}` | `ViewGroup` | 200, repara se preciso |
| `PATCH /rounds/{roundId}` | `ManageRounds` | 200; `settings` substitui a camada (`{}` a limpa) |
| `POST /rounds/{roundId}/cancel` | `ManageRounds` | 200 (de novo, sem efeito) |
| `PUT /rounds/{roundId}/attendance/me` | `RespondAttendance` | 200 `{ status, position }` |
| `PUT /rounds/{roundId}/attendance/{memberId}` | `ManageRounds` | 200; ignora janela e horário, respeita a vaga |
| `POST /series/{seriesId}/stop` | `ManageRounds` | 204 (de novo, 204) |

Notas de comportamento: `Sequence` pode ter buracos (um "não vou" sem linha anterior grava a linha e gasta um número, porque a linha precisa de um); `Source` guarda a origem da **última** mudança (quem desistiu ou foi tirado deixa de ser `Regular`); a posição na espera é calculada, nunca gravada.
