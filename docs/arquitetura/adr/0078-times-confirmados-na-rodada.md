# ADR 0078 — Times confirmados na rodada (R100)

Status: aceita (23/11/2026). Emenda a ADR 0055 (D2) e a ADR 0061 (D2 e D3): o sorteio continua sem estado; o que grava
é o "Confirmar e compartilhar". Perguntas 179 a 182 com o padrão recomendado (opção 1 em todas).

## Contexto

Os times confirmados na tela 07 viviam só na memória do aparelho de quem sorteou e, depois, no `MatchStarted` da
quadra. O jogador não tinha como ler o sorteio no app (achado 6 de `docs/operacao/percurso-m5/analise-ux.md`): dependia
do texto no WhatsApp. Com o placar desligado nem havia `MatchStarted`.

## Decisão

1. **Grava no "Confirmar", não no "Sortear".** `POST .../draw` segue sem gravar nada; `PUT /v1/groups/{groupId}/rounds/{roundId}/teams`
   `{ teams: [[memberId…]…], reserves: [memberId…] }` grava. "Sortear de novo", "Trocar" e "Travar dupla" sem confirmar
   não mudam nada para os outros.
2. **`PUT` que substitui por inteiro**, idempotente. Sem "apagar times": cancelar a rodada já os esconde.
3. **Capacidades:** `DrawTeams` (Admin e Co-admin) grava; `ViewGroup` (todo membro ativo) lê. Nenhuma capacidade nova.
   A capacidade é conferida de novo sob a trava da rodada (`RoundWriter`, ADR 0043, D5).
4. **Times dentro da rodada.** `RoundResponse.teams` = `{ confirmedAt, teams: [{ number, memberIds }], reserves }`, `null`
   sem times e na rodada cancelada. Vem em toda resposta que devolve a rodada; **não** entra na lista de rodadas, na
   página web `/r/…` nem no cartão do Início (pergunta 179). Sem rota de leitura própria: as telas 26 e 06 já leem a rodada.
5. **Regra do servidor** (`RoundTeams.Create`, erro `sessions.round-teams-invalid`, 400): pelo menos 2 times, todos do
   mesmo tamanho, de 2 até o time da modalidade (6, 4, 2); ninguém repetido; todos (reservas incluídas) confirmados na
   rodada (`Going`/`Promoted`) e ativos no grupo. Teto de 160 ids por confirmação (o corpo de 5 KB da rota já cabe
   menos). Rodada cancelada ou encerrada (`EndsAt <= agora`): `sessions.round-closed` (409); depois do início aceita,
   pois o sorteio acontece na quadra. Vale com o sorteio ligado ou desligado ("Montar times").
6. **Persistência:** tabela `sessions.round_teams` (`round_id`, `member_id`, `team_number` nulo na reserva, `position`),
   chave `(round_id, member_id)` (ninguém em dois lugares), `ON DELETE CASCADE` com a rodada, índice por `member_id`;
   coluna `rounds.teams_confirmed_at`. Escolhida em vez de uma coluna `jsonb` pela chave que barra repetido no banco e
   pelo índice por membro (exportação e exclusão de conta). Linhas apagadas e regravadas na mesma transação da trava.
7. **Sem autoria.** Não se grava quem confirmou (o plano previa `ConfirmedBy`): nada no produto usa, e o inventário de
   dados pessoais da rodada já diz "nada de autoria". O evento `RoundTeamsConfirmed(RoundId, GroupId)` leva só ids e não
   vai para o Outbox; é o gancho do push "os times saíram" (resposta 113), que fica para depois.
8. **No app**, "Confirmar e compartilhar" chama o `PUT` **antes** de abrir a folha de compartilhar, sem esperar a
   resposta; fechar a folha sem compartilhar não desfaz nada. A mutação usa a mesma fila do sorteio (`draw:<roundId>`),
   então nunca cruza um "Sortear de novo". O corpo sai de `arrangement.teams` e `arrangement.reserves`, nunca de `levels`.
   A resposta (a rodada) vai direto para o cache da rodada.
9. **Falha ao gravar** (sem rede, 5xx): o fluxo segue (folha e 08) e a 07 mostra "Os times não chegaram ao app dos
   jogadores. Eles recebem pelo WhatsApp." (pergunta 182). O aviso é o `isError` da mutação, sem estado no reducer.
10. **O bloco "Times"** (26 e 06) é a foto do sorteio, com a hora ("Saíram 19h42"); não acompanha a quadra. Linha
    "Você está no Laranja / no Azul / no Time 3", "Você está na reserva · Nº da fila", ou "Você confirmou depois dos
    times. Fale com quem organiza."; sem linha para quem não confirmou. Quem saiu da rodada fica no time com "(saiu)";
    na 06 quem sorteia lê "A lista mudou depois dos times. Sorteie de novo." ("Monte de novo." com o sorteio desligado).
    Nada muda sozinho no servidor (pergunta 180). Na rodada encerrada o bloco fica, só leitura (pergunta 181); na
    cancelada some. Do time 3 em diante, "Time 3" neutro, como a 07.

## Consequências

- Todo membro passa a ver quem joga com quem. É o mesmo que o texto do WhatsApp já mostra (ADR 0061, D11); nota, média,
  diferença, semente e medidor continuam só com Admin e Co-admin. Risco de inferência aceito em
  `docs/seguranca/modelo-de-ameacas.md`.
- O cache persistido do app (7 dias) guarda a composição dos times por `MemberId` (`docs/seguranca/dados-pessoais.md`).
- Remover um membro ou excluir a conta não apaga a linha dos times, como as presenças: o `MemberId` fica (Ex-jogador).
- Alternativas descartadas: gravar no "Sortear" (publicaria rascunhos); rota de leitura própria (consulta e cache a
  mais); apagar os times quando a lista muda (sumiria informação na véspera por um desistente).
