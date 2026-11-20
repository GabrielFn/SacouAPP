# Votação do MVP

A galera escolhe o MVP do dia depois da rodada (ADR 0048, item 2). É opção do grupo e da rodada: `mvp.voting`, que só vale com `mvp.enabled` ligado ([configuracao.md](configuracao.md)). Decisões em [ADR 0072](../arquitetura/adr/0072-votacao-do-mvp.md); o MVP pelos dados (fórmula da pergunta 97) está em [estatisticas.md](estatisticas.md), regra 11.

## Janela

- A rodada **termina** no "Encerrar rodada" (`closedAt`) ou, sem toque, 6 h depois do início; vale o que vier primeiro ([rodadas.md](rodadas.md)).
- A votação **abre** quando a rodada termina e **fecha 24 h depois**. No instante exato do fechamento já está fechada.
- A conta é em instantes: a noite da virada de horário não muda as 24 h. Nada roda no fechamento; o estado é calculado em cada leitura.
- Exemplo: início às 20h30, "Encerrar rodada" às 22h → vota até 22h do dia seguinte. Sem toque → abre às 02h30 e fecha às 02h30 do dia seguinte. Um toque às 03h (depois do fim automático) não adia: continua 02h30.

## Quem vota e em quem

- **Jogou** quem tem pelo menos uma partida **terminada** na rodada (`matchesPlayed ≥ 1` no resumo). Quem só estava na presença, ficou na fila ou só esteve numa partida ainda aberta não jogou.
- Só vota quem jogou; o candidato também tem de ter jogado; ninguém vota em si.
- Convidado (sem conta) pode receber voto, mas não vota.
- Um voto por pessoa e rodada, **final**: não dá para trocar (pergunta 145).
- Rodada cancelada não tem votação.

## Validade e apuração

- O voto vale se o candidato **ainda** jogou quando a apuração é feita: uma correção que o tira de todas as partidas descarta o voto (o segundo colocado pode vencer).
- Quem votou foi conferido no voto: uma correção que o tira depois, ou a saída dele do grupo, não anula o voto.
- **Vence** quem tem mais votos. Empate → mais **saldo** no placar (`plusMinus`, saldo negativo também: −2 vence −11). Empate de novo → mais **vitórias**. Persistindo → **MVP dividido** entre os empatados (pergunta 141).
- Ninguém votou (ou nenhum voto válido) → sem MVP pela votação; o Resumo mostra o MVP pelos dados, se estiver ligado (pergunta 142).
- "Quantos votaram" conta todos os votos da rodada, inclusive os descartados por correção.
- Partidas sincronizadas depois do fim da janela não reabrem a votação; quem só aparece nelas não votou.
- **A apuração congela** na primeira leitura depois do fechamento (resultado, Resumo, perfil ou exportação), com quem jogou e o saldo daquele momento. Uma correção do placar depois disso muda os números do Resumo, nunca o vencedor nem quantos votaram. Uma correção entre o fechamento e essa primeira leitura ainda entra (risco aceito, ADR 0072, D12).

Casos (golden só C#, em `apps/api/tests/Sacou.Modules.Stats.Tests/MvpVoting/mvp-tally-cases.json`):

| Caso | Votos e números | MVP |
|---|---|---|
| G1 | Bia 3, Gabi 2 | Bia |
| G2 | Bia 2 (+34), Gabi 2 (+21) | Bia, pelo saldo |
| G3 | empate de votos e saldo; Bia 4 vitórias, Gabi 3 | Bia |
| G4 | empate em tudo | Bia e Gabi (dividido) |
| G5 | nenhum voto | ninguém, 0 votantes |
| G6 | Bia 3, Gabi 2, e uma correção tira a Bia das partidas | Gabi |
| G7 | quem votou é tirado por correção depois | o voto conta |
| G8 | empate de votos, saldos −2 e −11 | o de −2 |

## MVP mostrado (perguntas 142 e 143)

| Configuração da rodada | Votação aberta (ou ainda não abriu) | Fechada com voto válido | Fechada sem voto válido |
|---|---|---|---|
| Só pelos dados | MVP pelos dados (`source: "stats"`), sem aviso | igual | igual |
| Pelos dados e votação | MVP pelos dados, com o aviso de votação (`mvpVoting`) | MVP da votação (`source: "votes"`, "Escolhido pela galera") | MVP pelos dados |
| Só votação | Sem MVP, com o aviso | MVP da votação | Sem MVP |
| MVP desligado | Sem MVP e sem aviso | igual | igual |

- MVP dividido: todos os vencedores aparecem e cada um ganha 1 em "vezes MVP" do perfil.
- Na areia, o MVP da votação é uma ou mais pessoas, não a dupla do ranking.
- O perfil (`mvpCount`) e a exportação ("foi MVP") usam o MVP mostrado.

## Sigilo

- Ninguém vê em quem cada um votou, nem o admin. Não existe rota de admin para votos.
- Com a votação aberta, cada pessoa vê só o próprio voto e o prazo, sem contagem parcial nem lista de quem já votou.
- Fechada, aparecem só os vencedores e quantos votaram. O Resumo mostra só o MVP, sem o número de votantes.
- A exportação dos dados de cada pessoa traz só os votos que ela deu ("seu voto"), nunca os recebidos.
- Os logs do voto têm só a rodada e o resultado; nunca o votante nem o candidato.

## Rotas (E3.18)

Sob `/v1/groups/{groupId}`, com o filtro do Stats (mesmas respostas dos outros filtros) e `Cache-Control: no-store`.

| Rota | Capacidade | Sucesso |
|---|---|---|
| `GET /rounds/{roundId}/mvp-voting` | `ViewGroup` | 200 `{ state, opensAt, closesAt, canVote, reason, myVote, candidates }`; `state` ∈ `notOpen`, `open`, `closed`; `reason` ∈ `notOpen`, `closed`, `notPlayed`, `alreadyVoted`; `candidates` com `memberId`, `matchesPlayed`, `plusMinus`, `wins` e `mainSide` (`a`/`b`, o app põe a cor), sem a própria pessoa. Limite `court-sync` |
| `POST /rounds/{roundId}/mvp-voting/vote` `{ candidateMemberId }` | `ViewGroup` e as regras acima | 201 `{ candidateMemberId, castAt }` |
| `GET /rounds/{roundId}/mvp-voting/result` | `ViewGroup` | 200 `{ state, closesAt, winners, voters }`; `winners` e `voters` `null` antes de fechar; fechada, os vencedores (vazio sem voto válido) e quantos votaram. Limite `court-sync` |
| `GET /rounds/{roundId}/summary` (E3.9) | `ViewGroup` | ganha `mvp.source` (`stats`/`votes`) e `mvpVoting` (`null` ou `{ state, opensAt, closesAt }`) |

## Códigos de erro

| Código | Quando |
|---|---|
| `sessions.round-not-found` (404) | Rodada inexistente, de outro grupo ou cancelada (mesma resposta) |
| `stats.mvp-voting-off` (404) | `mvp.enabled` ou `mvp.voting` desligado na rodada |
| `stats.mvp-vote-invalid` (400) | Corpo vazio, ou `candidateMemberId` que não é um id (o valor não volta) |
| `stats.mvp-voting-not-open` (422) | A rodada ainda não terminou |
| `stats.mvp-voting-closed` (422) | Já passaram as 24 h |
| `stats.mvp-voter-not-eligible` (403) | Quem vota não jogou |
| `stats.mvp-self-vote` (422) | Voto em si mesmo |
| `stats.mvp-candidate-invalid` (422) | Candidato que não jogou, não é do grupo ou não existe (um código só) |
| `stats.mvp-already-voted` (409) | Já votou nesta rodada |
