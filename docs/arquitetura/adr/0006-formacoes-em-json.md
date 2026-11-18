# ADR 0006 · Formações em JSON e golden compartilhado

**Status:** aceito (30/10/2026). **Tarefa:** E1.1. Plano e divergências entre as fontes em [`docs/estado/tarefas/E1.1.md`](../../estado/tarefas/E1.1.md).

## Decisões

**Fonte única em `packages/volley-rules/src/formations/formations.json`.** O arquivo saiu de `docs/dominio/`, sem cópia nem ponteiro lá. Conteúdo igual ao anterior, com dois acréscimos: `P2`–`P6` em `roles` e `rotationOrder` por sistema, porque chave numérica em JSON perde a ordem de giro.

**O explorador não é fonte.** `docs/dominio/rotacoes-explorador.html` fica como referência congelada e oráculo do aceite. Mudar uma formação exige mudar os dois no mesmo PR; `formations.explorer.test.ts` impede o desvio. Como ele fica fora do pacote, `packages/volley-rules/turbo.json` o declara como entrada do `test`.

**Livre e 6x0 são um botão só (decisão do Gabriel).** Uma entrada `livre` nos dados, com rótulo "Livre / 6x0". `produto.md:89` e as telas `AjustesGrupo` e `PreJogo` ainda mostram dois: a E4 ajusta.

**O sistema sacando é derivado.** Só a posição base e as trocas de `serveSubstitution` ficam nos dados; `getFormation` monta a fase `serving`. A revisão do MVP previa guardar os dois lados, mas assim há uma cópia só da posição base. O golden materializa os dois lados, então o C# não reinterpreta nada.

**Livre usa a chave de rotação `0`.** Não tem levantador, e `setterZone` é 1–6. Daí `RotationKey = SetterZone | 0`.

**`FormationTemplate` é a entrada crua; `Formation` é o resultado por fase.**

**Catálogo corrompido lança ao carregar.** É erro de programa, não regra de negócio, então `parseFormationCatalog` lança citando o campo, em vez de usar Result. O parser não tem dependência externa, e o catálogo e cada `Formation` são congelados em profundidade.

**Constantes numéricas em `constants.data.ts`.** `ROTATION_SLOTS` e `ROTATION_KEYS` são dados, e o lint isenta `*.data.*` de `no-magic-numbers`.

**`@types/node` no pacote, só para testes.** `tsconfig.json` usa `types: ["node"]`; `tsconfig.build.json` usa `types: []`, para o código de produção não enxergar Node. Segue o ADR 0002.

**Formato do JSON segue o Prettier.** Com o arquivo agora dentro de `packages/`, ele entra no `format:check`; pares `[x, y]` ficam em uma linha.

## Contrato para a E1.5 (C#)

- Ler `packages/volley-rules/src/formations/formations.json` e `packages/volley-rules/golden/formations.json` **pelo caminho**, como recurso embutido. Não copiar.
- Comparar por valor, nunca por bytes, com `double` em igualdade exata.
- O golden é uma lista de 26 casos (13 formações × 2 fases): `{ system, rotation, phase, slots: { "1": { role, x, y }, … }, liberoReplaces }`. O `phase` é `receiving` ou `serving`.
- Para atualizar: `pnpm --filter @sacou/volley-rules exec vitest run --dir src -u`. O golden é gerado do oráculo, não do JSON. Na CI, arquivo ausente reprova.
- **Com o golden ausente, o `-u` escreve o arquivo, mas a mesma execução reprova 2 testes:** o Vitest só grava o snapshot ao fim do arquivo de teste, depois dos testes que leem o golden. Rode de novo: a segunda execução passa.
- O build da API em produção precisa levar `packages/volley-rules/` no contexto (Docker/Railway). A E5.1 herda essa condição (atendida: o `Dockerfile` copia `formations.json`, ADR 0068); a DLL publicada já leva o catálogo ([ADR 0025](0025-json-compartilhado-no-csharp.md)).
- **Cartinha (E1.3):** `packages/volley-rules/golden/player-card-level.json` é escrito à mão, e não há dados para ler: a E1.5 precisa **portar a função** `playerCardLevelFromRating`, conforme [`docs/dominio/player-card.md`](../../dominio/player-card.md). O golden é uma lista de `{ id, rating, expected: { levelTenths, tier } }`.
- **Pix (E1.4):** a E1.5 só lê `packages/volley-rules/golden/pix.json` e `packages/volley-rules/golden/pix-crc.json`, escritos à mão, sem o gerador. **Se a geração ficar na API, a E3.10 porta o gerador** ([ADR 0025](0025-json-compartilhado-no-csharp.md)). Formato e cuidados no porte em [`docs/dominio/pix.md`](../../dominio/pix.md).

## Consequências

- O recorte do HTML no teste depende de `const BASE=` e `function checks(`. Reformatar o explorador pode exigir ajustar as âncoras; se sumirem, o teste reprova.
- `note` e `label` em pt-BR ficam no JSON, apesar de "textos centralizados", porque são parte do aceite. A E4 decide se exibe `note` e se usa rótulos próprios.
- 6x2 e 4x2 repetem com pares trocados (S1↔S2, OH1↔OH2, MB1↔MB2). `getFormation` não resolve isso de propósito: é da E2.4, junto com a regra do líbero desligado.
- Para a E2.4: em `serving`, `liberoReplaces` continua preenchido nas rotações 2 e 5 do 5x1 e 5 do 6x2, em que o substituído saca. Não significa líbero em quadra: quem está na posição 1 é o papel de `slots`.
- Para a E1.2: `rotacoes.md:65` diz "6 relações", mas a lista tem 7; a E1.2 corrige o texto.
