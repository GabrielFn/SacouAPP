# ADR 0022 · Envelope de evento e função de estado

**Status:** aceito (01/11/2026). **Tarefa:** E2.1. Plano em [`docs/estado/tarefas/E2.1.md`](../../estado/tarefas/E2.1.md). Contrato em [`eventos.md`](../../dominio/eventos.md). Detalha o [ADR 0009](0009-court-session-event-sourcing.md).

## Decisões

**Esquema fechado do envelope.** Oito campos; qualquer outro é `invalid-envelope` (achado A4 da [revisão do M1](../../seguranca/revisoes/M1-2026-11-01.md)). Um teste rejeita campo desconhecido e os nomes proibidos `email`, `name`, `nickname`, `phone`, `pix`, `photo` e `userId`, que também estão no golden. A regra equivalente em C#, por reflexão, fica na E2.10 ou E3.7.

**Erro não ecoa o campo desconhecido.** O nome de um campo fora do esquema é dado recebido e pode ser pessoal, então o erro traz `unknown-field`, nunca o nome. A entrada que não é objeto traz `envelope`.

**`batch` e `RevertedTo`.** Os docs não definiam; as definições estão em `eventos.md`, são técnicas e reversíveis, e entram no relatório do marco.

**`RevertedTo` fora de `activeEventIds` e fora da linha do tempo.** A lista traz só os eventos com efeito no estado. Com isso, alvo inexistente, futuro, inativo ou que seja outro `RevertedTo` têm a mesma causa, "não está na linha do tempo", e o mesmo código. O alvo é sempre um evento, então não há como voltar ao estado inicial: o primeiro evento do stream não se desfaz.

**Linha do tempo em lista ligada imutável.** Voltar só move o ponteiro, sem copiar estados. Quem caminha é o `RevertedTo`, e cada nó percorrido sai da linha do tempo, então o replay inteiro segue linear. Sem recursão, para os 10 mil eventos, o laço precisa de `let` no `for`: a única exceção de `functional/no-let`, só em `replay-events.ts` (`allowInForLoopInit`, [ADR 0002](0002-padroes-e-lint.md)).

**Payload copiado e congelado pelo parser.** A cópia separa o envelope da entrada, recusa o que JSON não representa e limita a profundidade a 32 níveis, com a recursão limitada por isso. `Object.fromEntries` define propriedades próprias, então `__proto__` no payload continua uma chave comum, sem contaminar nada. Por isso a comparação de duplicatas confere `Object.hasOwn`. O tamanho total do payload é limitado no servidor (E3.7).

**Exceção de aplicador vira `event-rejected`.** Falha fechada: a mensagem da exceção não é repassada, porque pode carregar dado.

**`Result` de `@sacou/volley-rules`.** O plano mandava reaproveitar. O lint de fronteira já permite que `match-engine` importe `volley-rules`, e continua havendo uma cópia só.

**Pureza imposta por lint.** Em `packages/match-engine/src`, fora de testes: `Date`, `crypto`, `performance`, `Intl`, `setTimeout` e `Math.random` reprovam, com casos em `scripts/lint-regression.mjs`. `globalThis.Date` e `Reflect.get(globalThis, ...)` não são pegos pela regra e ficam com o revisor.

## Contrato para a E2.10 (C#)

**A E2.10 porta parser, normalização e dobra, e lê o golden pelo caminho** (como no ADR 0006), junto com a fixture `append-fixture.test.fixture.ts` no projeto de testes C#.

`packages/match-engine/golden/event-log.json` é uma lista de `{ id, courtSessionId, initialState, events, expected }`. `expected` é `{ ok: true, state, activeEventIds }` ou `{ ok: false, code, eventId?, field? }`. Os eventos são crus: passam um a um pelo parser, na ordem do arquivo, e o primeiro erro é o resultado do caso. Os esperados são decididos à mão, sem o motor, e o arquivo não é gerado pelo código testado nem tem `-u`. Na escrita, um script descartável, fora do repositório e sem importar o motor, só expandiu os envelopes de uma notação curta.

Pontos de divergência para o porte:

- **`$` na regex:** no .NET casa antes de uma quebra de linha final. Use `\z`, e `[0-9a-f]` em vez de `\d`; o golden tem casos de UUID com `\n`.
- **Chave repetida no JSON:** `JSON.parse` fica com a última; `JsonDocument` guarda as duas. O porte precisa decidir e não pode divergir na comparação de duplicatas.
- **Número:** `1.0` e `1` são o mesmo em JS. O golden usa só inteiros, e a E2.2+ guarda só inteiros no estado. O limite é 2^53−1, com caso em `9007199254740992`.
- **Ordem de texto:** UUID válido em minúsculas ordena igual por unidade UTF-16 e por `localeCompare`, então o golden não distingue os dois. O teste `compares text by UTF-16 code unit` pula o parser para isso, e o porte precisa de equivalente, ou usa `string.CompareOrdinal` sem exceção.
- **Casos só em TS,** porque JSON não os representa: `NaN`, `Infinity`, `undefined`, objetos que não são JSON, `__proto__`, profundidade, 720 permutações, 10 mil eventos e os testes de vazamento em erro.

## Consequências

- O estado é recalculado do zero, sem cache. A E4.9 mede em celular real.
- Com falha fechada, um evento inválido gravado impede recalcular o stream: a E3.7 e a E4.9 têm de simular o replay antes de persistir.
- `PACKAGE_NAME` saiu de `match-engine`, e o app passou a usar `CURRENT_EVENT_SCHEMA_VERSION` no `testID`.
