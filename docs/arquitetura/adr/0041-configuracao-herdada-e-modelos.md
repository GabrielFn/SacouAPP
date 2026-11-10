# ADR 0041 · Configuração herdada: catálogo, camadas, resolver e modelos

**Status:** aceito (10/11/2026). **Tarefa:** E3.3 (parte 1: catálogo, resolver e golden; parte 2: persistência e rotas, no fim deste ADR). Plano em [`docs/estado/tarefas/E3.3.md`](../../estado/tarefas/E3.3.md). Detalha o SettingsResolver do [ADR 0011](0011-backend-patterns.md) e a configuração herdada do [ADR 0017](0017-group-settings-queue-bench.md). Segue o padrão de JSON único dos ADRs [0006](0006-formacoes-em-json.md) e [0025](0025-json-compartilhado-no-csharp.md). Regras de produto em [`docs/dominio/configuracao.md`](../../dominio/configuracao.md).

## Decisões

**Três níveis, uma forma só.** O grupo guarda um documento completo; a rodada e a partida guardam camadas parciais com a mesma forma. A herança é por folha, nunca por bloco: em cada folha vence o nível mais específico. Na camada, ausente e `null` significam herdar. Nenhuma folha tem valor nulo: onde "desligado" é um valor, há uma folha booleana ao lado (`capacityLimited`, `tieBreakEnabled`). Isso substitui o "record com campos anuláveis" do ADR 0011, que confundia "herda" com "desliga".

**Fonte única.** `packages/match-engine/src/settings/settings-catalog.json` traz cada campo (caminho, tipo, faixa ou lista, valor "Do zero", níveis aceitos, fato do grupo, Pro) e os cinco modelos prontos. O TypeScript importa o arquivo; o C# o embute na DLL do Groups (`Sacou.Modules.Groups.settings-catalog.json`), e `SharedGoldenFilesTests` confere que o recurso é igual byte a byte. Catálogo quebrado é erro de programa e lança exceção nos dois lados, com a mesma frase.

**Mora no motor e no Groups.** Em TypeScript, em `packages/match-engine/src/settings/`, porque as listas `BEST_OF_VALUES` e `QUEUE_EXIT_CRITERION_KEYS` já moram no motor (em `volley-rules` haveria ciclo). Em C#, no domínio do Groups (`Groups/Domain/Settings`), único consumidor; não vai para `Sacou.Shared` até haver um segundo módulo (ADR 0005).

**O domínio do C# não lê JSON.** A regra de arquitetura não libera `System.Text.Json` em `Domain/`. O leitor (`Groups/Infrastructure/Settings/SettingsJsonReader`) só transforma o JSON numa árvore neutra (`SettingsNode`), sem decidir nada; os parsers do domínio decidem tudo. O leitor recusa chave repetida e surrogate isolado como JSON malformado. O JavaScript fica com a última chave repetida, então os dois lados nunca divergem em silêncio: um recusa o corpo, o outro nunca recebe dois valores do app.

**Funções puras, mesma API nos dois lados.** `parseGroupSettings`, `parseLayer`, `resolveSettings`, `normalizeLayer`, `countLayerChanges` e `applyTemplate`; em TypeScript também `deriveMatchRules`. No C#, a mesclagem, a normalização e os modelos ficam em `SettingsResolver` (o plano previa um arquivo para cada; juntos ficam com menos de 100 linhas). Validação e mesclagem percorrem o catálogo, sem um `if` por campo. A ordem da primeira recusa é a do catálogo, nunca a das chaves recebidas: raiz, `schemaVersion`, chave desconhecida na raiz, e depois bloco a bloco (bloco ausente ou não objeto, folha desconhecida, folhas em ordem).

**Códigos de erro.** Lista fechada, com o caminho da folha (ou do bloco, ou `""` para a raiz): `settings.unknown-field`, `settings.missing-field`, `settings.wrong-type`, `settings.out-of-range`, `settings.unknown-value`, `settings.invalid-text`, `settings.not-allowed-at-level` e `settings.unsupported-version`. **`settings.invalid-text` é novo em relação ao plano:** texto invisível, fora da forma canônica ou sem letra não é faixa nem lista. Chave desconhecida é reportada pelo caminho do pai, nunca pelo nome recebido. Na API (parte 2), todos viram `400 groups.settings-invalid`, sem o caminho.

**`schemaVersion` também na camada.** Camada sem `schemaVersion` é recusada; "camada vazia" é `{ "schemaVersion": 1 }`. Versão nova exige migração explícita do `jsonb`, nunca leitura tolerante.

**Números.** `25.0` é 25 nos dois lados, porque `JSON.parse` não distingue (ADR 0025); o plano listava `25.0` como recusa, o que é impossível no TypeScript. `25.5`, `"25"`, `true` e `1e400` são `wrong-type`.

**Horário.** `HH:mm` com dígitos ASCII, de `00:00` a `23:59`. Forma errada é `wrong-type`; hora ou minuto fora da faixa, `out-of-range`. Sem regex no C#: o `[GeneratedRegex]` emite um atributo que o domínio não pode referenciar, e `$` aceitaria quebra de linha no fim.

**Texto livre (local).** A regra do `GroupName`, com vazio permitido e sem aparar: o texto precisa já estar aparado e em NFC (o app normaliza antes de enviar). As peças comuns saíram de `GroupName` para `Groups/Domain/DisplayText`. **Diferença em relação ao plano:** o limite de 80 conta pontos de código que não são marca, ZWJ nem tom de pele, e não grafemas. O motor não pode usar `Intl` (regra de lint do determinismo), e o Hermes não garante `Intl.Segmenter`; contar igual nos dois lados vale mais que contar uma família de emoji como um. O teto de pontos de código é 4 por caractere, como no `GroupName`. Limite aceito: as tabelas Unicode do JavaScript e do .NET podem divergir em caracteres novos (`Cn`).

**Modelos.** Um modelo pronto guarda só os campos não-fato que diferem de "Do zero"; aplicar um modelo copia esses valores e põe "Do zero" nos demais não-fatos. Os fatos do grupo (dia, horário, local, vagas e valores em dinheiro) nunca vêm de modelo nem são apagados por ele. É cópia, não vínculo: mudar o catálogo não mexe em grupo nenhum. Os valores seguem o padrão adotado da pergunta 21 do plano.

**Partida.** Aceita pontos, sets, tie-break, vantagem e sistema. `deriveMatchRules` gera o que a partida congela: `ScoringRules` (tie-break desligado vira `null`), sistema, modo de regra e `liberoAllowed` (só com líbero ligado e sistema 5x1 ou 6x2). Conflito entre níveis se resolve aqui, nunca recusando a mesclagem. O C# não porta essa função: o servidor recebe a cópia congelada (`decisoes.md:26`).

**Golden compartilhado.** `packages/match-engine/golden/settings-resolver.json` roda em TypeScript (`settings.golden.test.ts`) e em C# (`SettingsGoldenTests`), com os casos S, N e V do plano: `values` e `sources` por folha, normalização (incluindo a propriedade `resolve(g, normalize(g, r)) = resolve(g, r)` em todos os casos S), recusas com código e caminho, e cada modelo com todos os valores fixados. Os casos S10 (toda folha sobrescrita em cada nível que a aceita) são conferidos contra o catálogo; os demais, contra uma lista literal em cada lado. Os casos de `deriveMatchRules` rodam só no TypeScript, numa lista literal que o C# confere.

## Alternativas descartadas

- **Campos anuláveis (ADR 0011):** `null` não distingue "herda" de "sem limite".
- **Herança por bloco:** mudar só os pontos na rodada levaria o bloco inteiro do grupo junto, e o ponto laranja apareceria em tudo.
- **`JsonSerializer` direto para o tipo:** ignora chave desconhecida e aceita tipo próximo; o parser estrito é a única porta, inclusive para o que vem do banco.
- **Catálogo em C# escrito à mão:** duas fontes divergem; o golden pegaria, mas tarde.

## Persistência e rotas (parte 2)

**Tabelas** (módulo Groups, schema `groups`, migração `AddGroupSettings`). `group_settings`: uma linha por grupo, com o documento completo em `jsonb` e `schema_version` (`CHECK = 1`); `template_key` (uma das 5 chaves) ou `saved_template_id` (nunca os dois) só para o rótulo "Modelo usado"; `updated_by_member_id` (nenhuma resposta o devolve). `saved_templates`: `id` (UUID v7), `group_id`, nome (1 a 160 pontos de código no banco; 1 a 40 caracteres no domínio, pela regra do `GroupName`), o retrato dos campos que não são fato em `jsonb` e `created_by_member_id`. Os dois `jsonb` têm `CHECK` de objeto e de no máximo 8 KiB. `saved_template_id` não tem chave estrangeira: apagar o modelo limpa a referência na mesma transação.

**Criar grupo** grava a linha de configuração na mesma transação, com o modelo pedido (`do-zero` sem `templateKey`). Chave desconhecida é 400 `groups.template-not-found` e **nenhum grupo é criado**. Um grupo sem linha (feito antes da E3.3) é lido como "Do zero" e a linha é criada na primeira escrita, só para quem pode gerir a configuração.

**Escrita.** `PATCH`, aplicar modelo, salvar e apagar modelo passam por `IGroupSettingsStore.ExecuteInSettingsLockAsync`: transação que cria a linha se faltar, trava com `SELECT ... FOR UPDATE` a linha de `group_settings`, confere sob a trava que quem age ainda é membro ativo com `ManageSettings` (rebaixado depois do filtro recebe 403 e nada muda), carrega a configuração e os modelos do grupo, aplica a mudança e grava. O `PATCH` é mesclado sob a trava, folha a folha: dois admins em blocos diferentes não perdem a mudança um do outro. O teto de 20 modelos é contado sob a mesma trava. Modelo salvo é sempre buscado entre os modelos do grupo da rota (`group_id`, `id`): o id de outro grupo é 404 `groups.template-not-found`.

**`PATCH` aceita uma camada parcial do grupo**, com `schemaVersion`: `SettingsParser.ParsePatch` aceita qualquer folha do catálogo e recusa `null` numa folha ou num bloco (o grupo é completo, não herda). O modelo salvo é um retrato (`SettingsParser.ParseSnapshot`): só folhas que não são fato, todas as que o catálogo tem; aplicá-lo copia esses valores e deixa os fatos do grupo. Aplicar um modelo pronto grava `template_key`; aplicar um salvo grava `saved_template_id`; editar uma folha depois não muda o rótulo.

**Erros.** Tudo que o catálogo recusa, e JSON malformado (chave repetida dentro de `settings`, *surrogate* solto no local, fundo demais), sai como 400 `groups.settings-invalid`, sem o caminho. Chave repetida no corpo inteiro é recusada antes, pelo *binder* (400 sem código). A linha do banco que não passa no parser é erro de servidor: 500 genérico, e o log leva só o `groupId`.

**Contrato** (`ProducesProblem` em cada rota nova, para o portão do OpenAPI): `GET /settings` (`ViewGroup`), `PATCH /settings`, `POST /settings/apply-template`, `GET /templates`, `POST /templates` e `DELETE /templates/{templateId}` (`ManageSettings`), mais `templateKey` em `POST /v1/groups`. Detalhes em [`docs/dominio/grupos.md`](../../dominio/grupos.md).

**Desvios do plano.** O contrato `Groups.Contracts.IGroupSettingsReader` (D6) fica para a E3.4, que é quem o consome; a Parte 2 não o cria. O `GET` devolve `schemaVersion` no topo e também dentro de `settings`, para o documento poder voltar inteiro num `PATCH`. O corpo cabe nos 4 KB (conferido com o documento completo e o local de 80 caracteres). Sem evento (Outbox é da E3.11; `GroupSettingsChanged` levará só `GroupId` e `MemberId`).
