# ADR 0074 · Partida esquecida e expiração da retomada

**Status:** aceito (21/11/2026). **Tarefa:** R97 Parte 1 (revisão do fluxo rodada → partidas, teste no celular de 21/11). Plano e respostas do Gabriel (P1 = c, P2 = b) em [`docs/estado/tarefas/R97.md`](../../estado/tarefas/R97.md).

## Contexto

O celular marca uma quadra por vez (uma `CourtSession` aberta, ADR 0061). "Sair do modo quadra" não fecha nada, e a retomada na abertura do app (E4.9) não tinha prazo. Uma partida esquecida numa rodada antiga reabria o app nela toda vez e travava a partida de uma rodada nova sem dizer onde encerrar. O Início não tinha a barra "EM QUADRA" da tela 03.

## Decisões

**D1 · Barra "EM QUADRA" no Início.** `readActiveCourt` lê a sessão aberta do log (registro único) e mostra a barra enquanto a partida está em jogo (`playing`, `set-decided`, `match-pending`, a mesma decisão da retomada, `isMatchInPlay`). Ela mostra só o nome do grupo (do cache) e o placar do set, e leva à quadra num toque. A sessão de amostra só aparece com as ferramentas de desenvolvimento.

**D2 · Fim da rodada pelo cache.** A porta `RoundEndLookup` lê a lista persistida `["groups", g, "rounds"]` e responde `listed` (com `endsAt` e a data), `gone` ou `unknown`. A rodada ausente só conta como encerrada (`gone`) se a lista foi lida há menos de 24 h, porque `GET /rounds` lista as futuras e as das últimas 24 h, **e depois da abertura da sessão** (`court_sessions.opened_at`, gravado por `ensureRoundCourtSession`): uma lista lida antes pode ser anterior à própria rodada (criada em outro celular e aberta pelo push). Sessão sem `opened_at` (aberta antes do R97 ou recebida numa troca) dá `unknown`. Sem lista, ou com lista mais velha, a resposta é `unknown`. Rodada cancelada conta como encerrada.

**D3 · A retomada expira (P2 = b).** A quadra não abre sozinha depois de `endsAt + 30 min` (`RESUME_GRACE_MS`). Os 30 minutos cobrem o app que morreu no último rali de uma partida que passou do fim marcado. Com `unknown` (offline no primeiro uso), retoma como antes. O `DatabaseGate` espera o cache persistido ser restaurado (`useIsRestoring`) antes de decidir. Depois disso, a partida continua acessível pela barra do D1.

**D4 · Partida esquecida (P1 = c).** Na 08, a partida aberta de outra rodada vira um de três casos:
- **rodada em andamento ou desconhecida:** bloqueio "Há uma partida aberta em outra rodada. Abra e encerre pelo Menu antes de começar esta." com o botão "Abrir a partida aberta". Ele aparece antes do toque em "Começar".
- **rodada encerrada, sessão desta conta:** "Começar" abre a folha "Encerrar a partida antiga?". Confirmar grava `MatchEnded` (manual, pelo motor) na sessão antiga, fecha a sessão e só então começa a nova (`closeStaleCourt`).
- **rodada encerrada, sessão de outra conta (ou sem dono):** bloqueio sem saída aqui (D8 do ADR 0067).

Fechar nunca descarta evento: os pontos não enviados seguem em `findSessionsToSync`, que lê as sessões fechadas, e o envio é disparado na hora. Uma sessão assumida por outro celular (ADR 0063) só é fechada aqui, sem gravar nada, porque quem escreve nela é o outro celular. Se o fim não for gravado ou a sessão não fechar, nada começa ("Não deu para encerrar a partida antiga."). `closeStaleCourt` é idempotente: sessão já fechada ou sem partida aberta só fecha de novo, sem gravar nada. Assim, se a antiga fechou e a nova falhou, o toque seguinte começa sem erro; e a 08 relê a partida de outra rodada a cada início que termina.

**D5 · O erro de outra rodada carrega o ID.** `EnsureRoundCourtError` `other-round-match-open` passa a levar o `courtSessionId`. A API não muda.

## Consequências

- O cache de rodadas passa a decidir a retomada. Um cache velho nunca faz a rodada contar como encerrada pela ausência (risco do plano).
- A data da folha vem da lista em cache. Sem ela, o texto diz "uma rodada que já terminou".
- A barra lê o log a cada foco do Início e quando o envio muda uma sessão. Não há cópia do estado da quadra.
