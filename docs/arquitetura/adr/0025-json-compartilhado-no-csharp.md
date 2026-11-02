# ADR 0025 · Leitura dos JSON compartilhados no C#

**Status:** aceito (02/11/2026). **Tarefa:** E1.5. Plano em [`docs/estado/tarefas/E1.5.md`](../../estado/tarefas/E1.5.md). Cumpre os contratos dos ADRs [0006](0006-formacoes-em-json.md) e [0021](0021-overlap-validator.md) e fecha a dúvida do [ADR 0005](0005-estrutura-modular-api.md).

## Decisões

**Escopo do porte.** Entram formações, validador de sobreposição e cartinha, com os mesmos resultados nos goldens. O gerador de Pix **não entra**: a condição "se a geração ficar na API" é da E3.10, e portar agora anteciparia código de pagamento sem consumidor. `pix.json` e `pix-crc.json` são só lidos, com contrato de formato e IDs literais, sem afirmar mesmo resultado. **A E3.10, se a geração ficar na API, porta o gerador e passa a executar os dois arquivos**, e a tarefa será sensível.

**Onde mora.** Formações e validador em `Sacou.Modules.Matches`, sem projeto próprio: um `Sacou.VolleyRules` ficaria fora da regra de `Domain`, que só olha `Sacou.Modules.*`, e hoje só `Matches` consome. Cartinha em `Sacou.Modules.Stats`, que terá rating e projeções. `Domain/` é puro; o parser e o carregador ficam em `Matches/FormationCatalogs/`, porque usam `System.Text.Json`, `System.IO` e `System.Reflection`.

**Recurso embutido, sem cópia.** O catálogo entra na DLL como `EmbeddedResource`, por caminho relativo e `LogicalName` fixo. Arquivo ausente reprova a compilação. Os golden entram só nos projetos de teste, com o `LogicalName` `golden/<arquivo>`. Testes em `SharedGoldenFilesTests` conferem: nenhum arquivo com esses nomes em `apps/api`, recurso igual byte a byte à origem, e nenhum golden em assembly de produção. A DLL publicada é autossuficiente; **quem compila precisa de `packages/volley-rules/` no contexto, condição que a E5.1 herda para a imagem.**

**Carga no boot.** `AddMatchesModule` carrega o catálogo e o registra como singleton. Corrompido, a API não sobe, como o TS ao carregar o módulo; `/health` passa a provar a leitura. O custo é uma leitura pequena.

**Erro de catálogo é exceção, não `Result`:** erro de programa, como no TS. `InvalidDataException`, com a mesma frase e os mesmos caminhos de `parse-catalog.ts`.

**`OverlapResult` local e fechado:** `Passed`, `Violated` e `InvalidTolerance`. O `Error` de `Shared` só guarda `Code` e `Kind` e não carrega violações. `Result<OverlapCheck>` com violações no sucesso seria uma armadilha, com `IsSuccess` verdadeiro numa sobreposição. `Result<T, E>` em `Shared` não tem segundo consumidor; a E2.10 reavalia. A cartinha usa o `Result<T>` de `Shared`, com `invalid-rating`.

**Value objects em vez de enum:** `RotationSlot`, `RotationKey`, `PlayerRole`, `FormationSystem`, `FormationPhase`, `OverlapRuleMode` e `PlayerCardTier` são `sealed record` de construtor privado, com instâncias estáticas e `All`. O teste compara `Code` com o texto cru do golden, e não por uma tabela de nomes compartilhada, que esconderia um erro como `S1`↔`S2`.

## Divergências JS × C#

| Tema | Decisão |
|---|---|
| `25.0`, `2.5e1`, `1e0` | Sempre `TryGetDouble` e comparar com a lista permitida, nunca `GetInt32`. Vale para `rotationOrder` e, nos testes, para `rotation`, `levelTenths` e `rating` |
| Número enorme | `ValueKind`, `TryGetDouble` e `double.IsFinite` juntos: `1e400` dá `Infinity`, como no JS, e é recusado |
| Chave repetida | **O C# recusa, o JS fica com a última.** `AllowDuplicateProperties = false`, em produção e nos testes. Os dois leem o mesmo arquivo na mesma CI, então o resultado é reprovação, nunca divergência silenciosa. A detecção pega a chave escrita com escape (`"x"` e `"x"`), com teste. Vale só para estes arquivos confiáveis: **a E2.10 decide à parte para eventos recebidos** |
| Ordem das chaves | A saída percorre listas fixas. `EnumerateObject` só detecta chave desconhecida, e o `ImmutableDictionary` nunca é enumerado para produzir saída |
| Chave desconhecida | Recusada só em mapas e ignorada em objetos, nos mesmos lugares do TS. Por isso não há `JsonSerializer` |
| Ponto flutuante | `double` em tudo, igualdade por bits. Nada de `decimal`, `float`, `Math.Round` ou precisão em `Assert.Equal` |
| Tolerância | `double? tolerance = null`; só `null` vira o padrão, e `0` é zero. Conferida antes de calcular as relações |
| `NaN` | A mesma forma positiva (`>=`, `<=`), para falhar fechado |
| Cultura | Nada de `double.Parse`. Os testes do parser rodam em pt-BR |
| Arredondar | `Math.Floor(x + 0.5)`, limitando em `double` antes de converter para `int` |

**`golden/overlap.json` ganha dois casos T23,** a exceção deliberada à regra de frações binárias do ADR 0021: `0.8 - 0.1` dá `0.7000000000000001`, e `0.7 + 0.1` dá `0.7999999999999999`. Em `decimal`, os dois passariam; em `double`, os dois violam. Sem eles, o golden não distinguia os tipos.

## Barreira do domínio

Comparar namespace exato não bastava, porque `System` contém tanto `Guid` quanto `Environment`, e `System.Diagnostics` e `System.Runtime.InteropServices` estavam liberados inteiros.

- **Saíram da lista** `System.Diagnostics` e `System.Runtime.InteropServices`: pegam `Process`, `Stopwatch`, `Marshal` e `NativeLibrary`.
- **`AllowedDomainTypes`,** por nome exato, só com o que o compilador emite desses namespaces. A lista é a que os positivos exigem, em Debug e em Release, e o conteúdo fica em `ArchitectureDependencyRules`. **Tipo novo entra só por nome exato e com motivo; nunca um namespace inteiro.**
- **`ForbiddenDomainTypes`:** `Environment`, `Console`, `AppContext`, `AppDomain`, `Activator` e `GC`, pelo tipo de nível superior, então `Environment+SpecialFolder` também cai. É lista de bloqueio porque `System` não cabe em lista de permissão.
- **`DomainPInvokeViolations`, regra de reflexão:** `DllImport` é pseudoatributo, vira metadado do método e não deixa referência de tipo. Um teste documenta que a regra de IL não o vê.
- **`RealDomain_IsInspected`** reprova se o modelo deixar de enxergar o `Domain` de `Matches` ou de `Stats`.
- **Evite indexador em `Domain/`:** ele emite `[DefaultMember]`, de `System.Reflection`.

`ModuleNamesInSolution` passou a ignorar projetos em `apps/api/tests/`, sem usar o sufixo `.Tests`: um módulo falso em `src/` com esse nome continua reprovando.

### Limites aceitos

- `System.Type` segue liberado, porque os records o usam em `EqualityContract`, então `Type.GetType(...).InvokeMember` passa.
- `Thread` e `Task.Run` em `System.Threading*`, `DateTime.Now`, `Random` e `Guid.NewGuid` seguem liberados. Determinismo no C# é assunto da E2.10.
- O parser C# é uma segunda implementação de `parse-catalog.ts`. A CI reprova se os dois divergirem no arquivo real, mas não garante a mesma rejeição em arquivos corrompidos fora dos casos de teste.

## Alternativas descartadas

- **`Content` copiado para a saída:** dependeria de disco em produção, contra o ADR 0006.
- **`JsonSerializer`:** não reproduz chave desconhecida recusada só em mapas.
- **Enum com tabela de nomes:** catálogo e golden liam pela mesma tabela.
- **Projeto `Payments.Tests` só para a leitura do Pix:** projeto sem código de produção; a leitura fica em `Sacou.Architecture.Tests`.

## Consequências

- Mudar o formato de um JSON exige mudar o parser nas duas linguagens, no mesmo PR.
- Cada golden tem lista literal de IDs no teste: acrescentar um caso exige listá-lo no C#.
- **E2.10** avalia promover `OverlapResult` a `Result<T, E>`, decide chave repetida em eventos e define o determinismo do domínio C#.
