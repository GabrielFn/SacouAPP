# ADR 0023 · Placar e primeiros tipos do catálogo de eventos

**Status:** aceito (02/11/2026). **Tarefa:** E2.2. Plano em [`docs/estado/tarefas/E2.2.md`](../../estado/tarefas/E2.2.md). Regras em [`placar.md`](../../dominio/placar.md); catálogo em [`eventos.md`](../../dominio/eventos.md). Registra aplicadores no núcleo do [ADR 0022](0022-event-envelope-replay.md).

## Decisões

**`MatchStarted` abre o stream, com o set 1 já aberto em 0–0.** Atende à exigência do ADR 0022 de um evento antes de qualquer ponto: desfazer o primeiro ponto volta a ele. Não há evento vazio de "abrir quadra"; a E2.6 cria um se a fila precisar.

**Só o resultado no evento.** `SetEnded` grava o vencedor e o alvo do próximo set; `MatchEnded`, o vencedor. O aplicador confere a estrutura (partida, set, set aberto) e não recalcula regra ([ADR 0009](0009-court-session-event-sourcing.md)): `SetEnded` em 10–8, ou com o vencedor atrás, é aplicado como gravado. **A regra de fim de set fica nos comandos e em `scoring-rules.ts`.**

**Estrutura além do plano: não há set depois de `bestOf`.** `SetEnded` com `nextSet` não nulo em `setNumber >= bestOf` é `event-rejected`. Sem isso, um evento forjado abria o set 6, que o parser de `PointScored` recusa: o estado sairia do esquema, e os comandos gerariam payload inválido. Não recalcula regra, porque não olha placar nem vencedor. Tem caso no golden.

**`PointScored` sem placar absoluto.** Grava o time; o aplicador soma 1. Com placar absoluto e conferência, dois escritores intercalados travariam o stream, o que `eventos.md` proíbe. `matchId` e `setNumber` barram o ponto atrasado de outro set, em vez de contá-lo no set errado.

**`rulesVersion` no `MatchStarted`, `scoring` por valor.** O replay aceita qualquer versão, porque o resultado está gravado; só os comandos recusam versão não suportada. O aplicador só calcula o alvo do set 1, a partir da cópia congelada do próprio evento; os alvos seguintes vêm do `SetEnded`. Formações só na E2.4.

**Parsers à mão, sem biblioteca.** O pacote é puro e o C# precisa de equivalente simples. O esquema é uma árvore de chaves por tipo (`SCORE_PAYLOAD_SHAPES`). **O desconhecido é conferido antes de tudo, em qualquer nível**; depois, os campos na ordem da tabela de `eventos.md`. Inteiros com `Number.isSafeInteger`, chaves com `Object.hasOwn`. O erro leva só um caminho do esquema, `payload` ou `unknown-field`, nunca o valor nem a chave recebida. `parseScorePayload` com tipo fora do catálogo do placar devolve `payload`: quem precisa distinguir olha `SCORE_APPLIERS`.

**`matchId` de partida terminada em `startMatch` é `invalid-payload` em `matchId`.** O plano não previa código para o caso, e o replay rejeitaria o evento. Não cria código novo, e o comando continua só emitindo o que o replay aceita.

**Chaves só `a`, `b` e nomes do esquema; sets e times nunca em chave numérica ou por ID.** O parser fechado recusa `"1"`, e o estado monta as chaves em ordem UTF-16, porque o golden compara o texto.

**Versão do esquema.** E2.3 e seguintes acrescentam campos ao `MatchStarted` e ao `nextSet` ainda em `schemaVersion` 1, atualizando o golden; nada foi gravado em produção. Com dados reais, muda a versão.

**Nomes.** `MatchSet` para o set, sem colidir com o `Set` do JS. Lados `a`/`b` (`TeamSide`), como as etiquetas das telas. `MemberId` é apelido de `string` aqui; o local do tipo fica na E3.2.

**`isUuid` extraído para `event-log/is-uuid.ts`,** a única mudança no núcleo, sem mudar comportamento.

**Sem lista de exceção de lint nova.** O arquivo `match-player.test.fixture.ts` é só de teste, fora do build pelo `src/**/*.test.*`, como a fixture da E2.1, e segue as regras de código de produção no lint.

## Contrato para a E2.10 (C#)

**A E2.10 porta parsers, aplicadores e as funções de `scoring-rules.ts` (`targetPointsForSet`, `setsToWin`, `getSetWinner`, `getSetPointTeams`, `getMatchWinner`), e roda os três golden pelo caminho.** Sem isso, o C# não prova nenhum fim de set, porque o aplicador não calcula regra. Os comandos ficam só em TS, salvo decisão da E3.7.

| Arquivo em `packages/match-engine/golden/` | Formato |
|---|---|
| `score-rules.json` | `{ id, scoring, setNumber, score, setsWon?, expected: { targetPoints, setsToWin, setWinner, setPointTeams, matchWinner? } }` |
| `score-payloads.json` | `{ id, type, payload, expected: { ok: true } \| { ok: false, field } }` |
| `score-events.json` | Mesmo formato de `event-log.json` |

Os esperados são decididos à mão, sem o motor, e os arquivos não são gerados pelo código testado. Um script descartável, fora do repositório e sem importar o motor, só expandiu a notação curta em envelopes e casos.

Pontos de divergência para o porte, além dos do ADR 0022:

- **`25.0` e `2.5e1` são 25 em JS.** O parser C# deve seguir o valor, sem depender de `GetInt32`. O golden tem os dois textos (`MatchStarted-pointsPerSet-written-*`).
- **Chave repetida:** como no ADR 0022.
- **`null` de `tieBreakPoints`, `nextSet` e `winner` é serializado, nunca omitido.** O golden compara o texto.
- **`__proto__`, `constructor` e `"1"` no payload** são `unknown-field`. No C#, o primeiro e o segundo são chaves comuns.
- **Set além de `bestOf`:** o aplicador rejeita; os casos `g15-next-set-past-the-format-*` cobrem.
- **Casos só em TS:** comandos, `Object.prototype` poluído, símbolos, getters, proxies, array com buracos, canário de erro e 10 mil pontos.

## Consequências

- **O evento prova formato, não verdade.** `SetEnded` falso passa no replay, e um `MemberId` em UUID válido pode não ser do grupo. A E3.7 confere membros contra o grupo e simula o replay antes de persistir; se validar `SetEnded` pela regra, usa as funções portadas. Quem tem token de placar já pode marcar qualquer ponto, então isso não dá poder novo.
- **Ponto atrasado trava:** ponto de set já encerrado é `event-rejected`, e com falha fechada impede recalcular o stream. A E3.7 e a E4.9 rejeitam antes de persistir. Com a ordem por `batch`, um evento anterior ao `MatchStarted` também trava (para a E3.7).
- **`MemberId` em UUID** presume que a E3.2 gere UUID minúsculo; se não, o parser muda.
- **E2.3** acrescenta `firstServer` e o setup por time, e soma lógica ao `PointScored`: conflito esperado em `SCORE_APPLIERS` e no golden.
