# ADR 0021 · Validador de sobreposição, `OverlapRuleMode` e `RotationSlot`

**Status:** aceito (01/11/2026). **Tarefa:** E1.2. Plano em [`docs/estado/tarefas/E1.2.md`](../../estado/tarefas/E1.2.md). Regra em [`rotacoes.md`](../../dominio/rotacoes.md).

## Decisões

**7 relações, não 6.** 3 de frente/fundo e 4 laterais (`rotacoes.md:19-20`). O "6" de `rotacoes.md:65` e do explorador foi corrigido.

**Tolerância só em frente/fundo.** A fórmula é contrato: `back.y >= front.y - tolerance` e `left.x < right.x`. Na lateral, a tolerância permitiria o empate proibido. O padrão é `0,02`, configurável por chamada. A tolerância precisa ser finita e ≥ 0, e isso é conferido antes de tudo, mesmo quando nenhuma relação está em vigor.

**O que vale em cada caso:**

| Modo | Recebendo | Sacando |
|---|---|---|
| `fivb-2025-28` | 7 relações | Nenhuma |
| `classic` | 7 relações | 5: o sacador fica fora (`1-behind-2` e `6-left-of-1`) |

**Modo obrigatório na chamada.** `DEFAULT_OVERLAP_RULE_MODE` existe para a configuração herdada (E3.3), mas o validador não o aplica: configuração esquecida não vira padrão silencioso.

**Falha fechada.** As comparações são escritas de modo que `NaN` em coordenada vire violação. Faixa de coordenada e `Infinity` não são conferidos; quem fizer o editor Pro (`produto.md:92`) valida a entrada e define o teto da tolerância, se expuser esse ajuste.

**`Result` próprio do pacote.** `src/result.ts` traz `Result<T, E>`, `ok()` e `err()`, exportados. Regra de negócio devolve Result; catálogo corrompido continua lançando (ADR 0006). A E2.1 decide se reaproveita.

**O validador só informa.** Ele devolve o que falhou, e não decide o que a interface faz. O ADR 0010 e `produto.md:95` dizem que violação vira aviso; `rotacoes.md:61-65` a lista sob "Erro (bloqueia)". Quem consome (E2.4 e o editor Pro) resolve esse ponto.

## Definições delegadas pelo ADR 0010

**Nome do modo de regra: `OverlapRuleMode`,** com os valores `fivb-2025-28` e `classic`, em `OVERLAP_RULE_MODES`. Em que nível da configuração herdada ele fica continua com a E3.3.

**`CourtPosition` e `RotationSlot` são o mesmo conceito; no código, o nome é `RotationSlot`.** Os dois designam o número oficial de 1 a 6 que define o sacador, o giro e a sobreposição (`rotacoes.md:12`, `produto.md:95`). Não há um segundo conceito de 1 a 6 a separar: o lugar físico de cada jogador, que é a outra camada, é o `CourtPoint`. Assim:

- `RotationSlot` é o tipo já usado em `Formation`, `SetterZone` e no golden; não haverá tipo `CourtPosition`.
- O pedido de `produto.md:272` continua atendido: nada de `int` solto. No TS, `RotationSlot` é a união literal de 1 a 6; no C#, será value object.
- "Posição na quadra (1–6)" segue como termo do app. `produto.md:272, 296` e o glossário passam a citar `RotationSlot`.

## Contrato para a E1.5 (C#)

**A E1.5 precisa portar o validador,** e não só ler os JSON: o aceite dela é "mesmos resultados nos testes golden", e `golden/overlap.json` só dá resultado com o validador. Mesma expressão, com `double`.

`packages/volley-rules/golden/overlap.json` é uma lista de `{ id, mode, phase, tolerance?, slots: { "1": { x, y }, … }, expected }`:

- `expected` é `{ ok: true, checked: [...] }` ou `{ ok: false, code, violations? }`. O `code` é `overlap`, com `violations`, ou `invalid-tolerance`, sem elas.
- `checked` e `violations` seguem a ordem fixa de `OVERLAP_RELATIONS`, e a comparação considera a ordem.
- `tolerance` omitida significa o padrão. `0` explícito é zero, não o padrão.
- Casos no limite exato usam frações binárias (0,375; 0,125), para as linguagens não divergirem por arredondamento.

**O golden é escrito à mão, nunca gerado pelo validador,** e não tem `-u`: caso gerado confirmaria qualquer erro do próprio validador. Formatado pelo Prettier. Ao mudar uma regra, alguém decide o esperado de cada caso.

`overlap-validator.test.ts` reprova se faltar caso para alguma combinação de relação × modo × fase. Os casos com valores que JSON não representa (`NaN`, `Infinity`) ficam só nesse teste, e a E1.5 precisa de equivalentes próprios. O aceite também roda os 26 casos de `golden/formations.json` nos dois modos, com tolerância padrão e `0`, lidos do arquivo.

## Consequências

- `OverlapValidator`, do glossário, é o módulo `overlap-validator.ts`: `validateOverlap` recebe posições e fase, e `validateFormationOverlap` recebe uma `Formation`. No C#, a E1.5 pode dar à classe esse nome.
- `validateFormationOverlap` ignora o papel: o líbero conta no lugar que ocupa.
- O explorador segue com `T=0` e fica fora da decisão: é só a checagem visual dele (ADR 0006). As 13 formações passam nos dois valores.
- **Empate em frente/fundo sem conferência no texto oficial:** vale `rotacoes.md:19`. O plano pede que o revisor confira a regra 7.4 no PDF da FIVB; se divergir, é pergunta ao Gabriel antes do merge, e a mudança fica restrita a uma comparação e aos casos T8.
