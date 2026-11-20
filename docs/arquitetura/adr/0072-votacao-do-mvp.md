# ADR 0072 · Votação do MVP

**Status:** aceito em parte (20/11/2026): a Parte 1 da E3.18 (fim da rodada, domínio, voto e cédula). A Parte 2 (resultado, Resumo, perfil e exportação) completa os itens D6, D10 e D11 nas rotas. **Tarefa:** E3.18. Plano em [`docs/estado/tarefas/E3.18.md`](../../estado/tarefas/E3.18.md). Regras em [`mvp.md`](../../dominio/mvp.md). Estende o [ADR 0048](0048-modos-de-fila-votacao-e-areia.md) (item 2) e lê as projeções do [ADR 0071](0071-projecoes-de-estatisticas-mvp-e-rating.md).

## Contexto

O ADR 0048 decidiu a votação da galera: só vota quem jogou, ninguém vota em si, abre quando a rodada termina e fecha 24 h depois, voto secreto, empate pelo saldo. Faltava no servidor o fim da rodada (`RoundStatus` só tinha `Scheduled` e `Canceled`), a apuração e o sigilo nas rotas. As perguntas 140 a 146 tiveram resposta pela recomendação (19/11/2026).

## Decisões

**D1 · Fim da rodada (pergunta 140).** A rodada ganha `closed_at` (nulo) em `sessions.rounds`. Ela termina no menor entre `closedAt` e `startsAt + 6 h` (`SessionLimits.RoundAutoEndHours`, regra em `RoundEnd`). Rota `POST /v1/groups/{groupId}/rounds/{roundId}/close`, com `WriteCourt` (Admin, Co-admin e Placar), decidida sob a trava da rodada (ADR 0043): fechar de novo devolve o mesmo `closedAt`; rodada cancelada é `409 sessions.round-canceled`. Um toque depois do fim automático fica gravado, mas não adia o fim. Fechar não recusa eventos da quadra que chegam depois (celular offline). A rodada ganha o evento `RoundClosed` (só IDs), para o push da E3.11. A resposta de rodada (`RoundResponse`) passa a ter `closedAt` e `endsAt`.

**D2 · Janela sem job.** `MvpVotingWindow`: abre em `endsAt` e fecha 24 h depois, intervalo semiaberto (no instante exato de `closesAt` já está fechada), contado em instantes (a virada de horário não muda). O estado é calculado a cada leitura com o `TimeProvider`; nada roda no fechamento, o que funciona com o Cloud Run escalando a zero (ADR 0068).

**D3 · Quem jogou.** Membro com `matchesPlayed ≥ 1` nas linhas `players` da projeção fresca da rodada (`StatsProjector.GetRoundAsync`, lacuna L2 do plano, ADR 0071): só partidas terminadas. A projeção é refeita se o stream mudou, então correção e partida que chega tarde valem. Convidado pode receber voto; não vota (não tem login).

**D4 · Elegibilidade, no servidor e nesta ordem.** Membro ativo do grupo (filtro do Stats, mesmas respostas dos outros filtros); corpo com um id (`400 stats.mvp-vote-invalid`, sem eco); rodada do grupo e não cancelada (senão o mesmo `404 sessions.round-not-found` de rodada inexistente); `mvp.enabled` e `mvp.voting` ligados na configuração resolvida da rodada (`SummaryRules.HasMvpVote`; senão `404 stats.mvp-voting-off`); janela aberta (`422 stats.mvp-voting-not-open` ou `422 stats.mvp-voting-closed`); quem vota jogou (`403 stats.mvp-voter-not-eligible`); candidato diferente de quem vota (`422 stats.mvp-self-vote`); candidato jogou (`422 stats.mvp-candidate-invalid`, um código só para quem não jogou, não é do grupo ou não existe); ainda não votou (`409 stats.mvp-already-voted`). O voto é final (pergunta 145). O corpo é lido como texto e convertido à mão, para que um valor que não é id caia no código da votação.

**D5 · Validade na apuração.** O voto vale se o candidato **ainda** jogou na projeção lida na apuração (correção que o tira descarta o voto). Quem votou foi conferido no voto: correção que o tira depois, ou saída do grupo, não anula.

**D6 · Apuração (pergunta 141).** `MvpTally`: mais votos; empate, mais `plusMinus`; empate, mais `wins`; persistindo, MVP dividido, com os vencedores em ordem de `MemberId` só para a resposta ser estável. Sem voto válido, sem vencedor (pergunta 142: o Resumo cai no MVP pelos dados). `voters` conta todos os votos guardados da rodada, inclusive os descartados por correção ("quantos votaram"). Casos G1 a G8 em `mvp-tally-cases.json` (golden só C#: o app não apura).

**D7 · Sigilo (pergunta 144).** Nenhuma rota devolve o voto de outro membro, nem ao Admin; não há rota de admin para votos. A cédula (`GET .../mvp-voting`) traz só o próprio voto (`myVote`), o estado da janela e quem jogou menos a própria pessoa, sem contagem, total de votantes nem lista de quem votou. O resultado (Parte 2) traz só os vencedores e o número de votantes. O log do voto tem só `roundId` e o resultado (`cast` ou o código do erro), nunca o votante, o candidato nem o par (`MvpVotingLog`); `MvpVote` e `MvpVoteRow` não se imprimem. Nenhum evento leva o voto. As rotas da votação têm `Cache-Control: no-store`.

**D8 · Guarda (pergunta 146).** `stats.mvp_votes`, no `StatsDbContext` (schema `stats`, ADR 0037): PK `(round_id, voter_member_id)`, `group_id`, `candidate_member_id`, `cast_at`, `CHECK (voter_member_id <> candidate_member_id)` e índice por votante (para a exportação da Parte 2). O par fica, por `MemberId` (ADR 0012); o sigilo é garantido nas rotas.

**D9 · Concorrência.** `INSERT ... ON CONFLICT (round_id, voter_member_id) DO NOTHING`; zero linhas afetadas é `409 stats.mvp-already-voted`. Sem trava de linha: a PK resolve a corrida. As conferências do D4 vêm antes, com o `now` do pedido.

**D10 · Limites (ADR 0062).** A cédula lê a projeção fresca, que pode refazer o replay: fica em `court-sync`, como as rotas de estatística da E3.9. O voto e o `close` são escritas baratas e ficam só no limite global por usuário, como as outras escritas da rodada (cancelar, editar); revisar com os 429 do piloto (E5.3).

**D11 · Onde vive.** Fatias `Stats/GetMvpVoting/` e `Stats/CastMvpVote/`, domínio puro em `Stats/Domain/MvpVoting/` (`MvpVotingWindow`, `MvpBallot`, `MvpTally`, `MvpVotingErrors`), leitura da rodada em `Stats/MvpVoting/` (`IMvpVotingRounds`, sobre o `StatsProjector`). O filtro do Stats (`Stats/Access/`) é o mesmo da E3.9 Parte 4b. `mvp.voting` entra em `SummaryRules` como membro `init` (`MvpVoting`), fora da chave da projeção (`facts_hash`): ligar a votação não reconstrói nada. `closedAt` entra em `RoundFacts` do mesmo jeito, com `EndsAt` calculado.

## Para a Parte 2

`GET .../mvp-voting/result` (D6, D7), `mvp.source` e `mvpVoting` no Resumo da E3.9 (calculados na leitura, nunca na projeção), `mvpCount` do perfil com o MVP final, seção `mvpVotes` da exportação (só votos dados) e o teste de exclusão da conta.

## Consequências

- A E4.12 Parte 2 liga o botão "Encerrar rodada" à rota `close`; offline, a rodada termina sozinha.
- A E3.11 manda o push "Votação do MVP aberta" no `RoundClosed` e agenda o do fim automático.
- A E4.18 traduz os códigos novos e mostra "fecha em N h" a partir de `closesAt`.
- Risco aceito: num grupo de dois votantes com vencedor único dá para deduzir o voto pelo resultado (inerente a qualquer resultado). Partidas sincronizadas depois do fim da janela não reabrem a votação.
