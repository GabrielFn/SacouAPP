# ADR 0010 · Rotação por time, formações como dados e modo de regra

**Status:** aceito (decidido em 30/10/2026, registrado em 31/10/2026). **Tarefa:** E0.8.

**Fontes:** `decisoes.md:12`; `rotacoes.md:5-7, 13-15, 65`; `revisao-mvp.md:77, 106-107`; `produto.md:89-95, 358`; `perguntas.md:14`. Formato e carga dos dados no [ADR 0006](0006-formacoes-em-json.md).

## Contexto

A regra de sobreposição mudou em 2025 e material antigo ainda mostra a anterior (`rotacoes.md:7`). Cada time tem a sua rotação, independente da do outro (`rotacoes.md:15`).

## Decisão

**Rotação por time.** `TeamState` por time: sistema, escalação, levantador, rotação atual e banco. `MatchStarted` recebe um setup por time. Gira só quem ganha o side-out.

**Duas camadas.** `RotationSlot` (1–6) separado de `CourtPoint` (x, y). `FormationTemplate` por sistema × rotação × sacando/recebendo, como dado compartilhado entre app e servidor. Id interno da rotação: `setterZone`.

**Posições no momento do saque,** nunca depois.

**Modo de regra configurável:** FIVB 2025–28, o padrão, em que só o time que recebe tem restrição de sobreposição, ou Clássico, em que os dois têm. `OverlapValidator` com a regra oficial e tolerância configurável (`rotacoes.md:69`). Violação vira aviso, nunca bloqueio (`produto.md:95`).

**Sistemas.** Livre/6x0 grátis, com um botão só na interface; 4x2, 5x1 e 6x2 no Pro.

## Conflitos entre as fontes

**Livre e 6x0 separados** (`revisao-mvp.md:77`, `produto.md:10, 89, 394`). Vale `decisoes.md:12`: um botão só, confirmado pelo Gabriel em `perguntas.md:14`. A entrada de dados e as telas a ajustar estão no ADR 0006.

**Guardar os dois lados** (`revisao-mvp.md:107`, "sacando/recebendo"). O ADR 0006 guarda só a posição base e deriva a fase de saque; o golden materializa os dois lados.

## Alternativas

Sem alternativa documentada ao modo configurável: `rotacoes.md:7` só o justifica.

## Consequências

- **Definido no [ADR 0021](0021-overlap-validator.md) (E1.2):** `CourtPosition` e `RotationSlot` são o mesmo conceito, e o nome no código é `RotationSlot`; o modo de regra no código é `OverlapRuleMode`.
- **A definir:** em que nível da configuração herdada o modo de regra fica (E3.3).
