# Request

Gabriel, 23/11/2026, via `/tlc-spec-lean`:

> pode iniciar a R99

Context the request points to (my previous message in the session, which the user answered):

> **Próximo passo:** corrigir os defeitos 1 a 3 numa tarefa curta (R99), pelo ciclo normal de agentes. Depois vêm o teste do push com uma conta nova, a revisão de segurança e o relatório do M5. Posso começar a R99?

The defects 1 to 3, as recorded in `docs/estado/pendencias.md` (last item) from the phone walkthrough of 23/11 (PR #226, `docs/operacao/percurso-m5/roteiro.md` steps 38–45):

1. Início duplica rodadas encerradas: o mesmo card aparece como "Ver resumo" e como aberta, e o contador não bate com os cards (print 116). O card do grupo diz "Próxima: seg 23/11" para uma rodada encerrada.
2. Depois de "Encerrar rodada", a página da rodada (print 104) e a cartinha da aba Eu (print 119) ficam desatualizadas até recarregar o app: falta invalidar as consultas da rodada e de `/v1/me/stats`.
3. Cartinha: o botão "Compartilhar" quebra no meio da palavra mesmo com fonte 1.0 (print 106); com fonte 1.3, "vitórias" e "vezes MVP" ficam cortados (print 122).

Captures: `docs/operacao/percurso-m5/104-seg-pagina-pos-encerrar.jpg`, `106-eu-cartinha-zerada.jpg`, `116-*.jpg`, `119-*.jpg`, `122-*.jpg`.
