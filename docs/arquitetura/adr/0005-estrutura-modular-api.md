# ADR 0005 · Estrutura modular da API

**Status:** aceito (30/10/2026). **Tarefa:** E0.2. Resumo em [`docs/arquitetura/visao-geral.md`](../visao-geral.md).

## Contexto

A arquitetura aprovada é um monólito modular em .NET 10 com DDD enxuto e fatias verticais. A estrutura precisa barrar acoplamento entre módulos desde o início, antes de existir código de negócio, e sem depender da atenção do revisor.

## Decisões

**Exatamente 7 módulos:** Identity, Groups, Sessions, Matches, Payments, Summaries e Stats (`docs/produto.md` e `docs/revisao-mvp.md`). Notifications, Photos e Plans não são módulos em nenhum documento; E3.11, E3.14 e E3.15 decidem onde ficam, com ADR.

**Um `.csproj` por módulo, sem projeto `Contracts` separado.** O projeto dá a barreira de compilação (`internal`). Um `Contracts` separado dobraria para 14 projetos sem uso hoje. Se surgir ciclo entre módulos, que o MSBuild recusa, extrair só aquele `Contracts`: o namespace não muda.

**`Sacou.Shared` com lista fechada.** Só contém o que o `produto.md` lista; hoje, `Sacou.Shared.Results`. Namespace público novo exige ADR, dois módulos consumidores e editar a lista em `RealAssemblyTests`. O assembly compilado só pode referenciar uma lista fechada da BCL (`ArchitectureReflectionRules`), sem `System.Net.Http` nem `System.Data.Common`. O `.csproj` também é lido, porque referência sem uso não deixa rastro no assembly: só o SDK simples, sem `PackageReference`, `FrameworkReference`, `ProjectReference`, `Reference`, `Import` ou `Sdk`.

**Catálogo conferido em três fontes:** assemblies na saída do teste, `.csproj` em `Sacou.Modules/` e `Sacou.slnx`. Assim, módulo novo sem referência da API também reprova.

**Namespace acompanha assembly e pasta.** Teste de reflexão: todo tipo de módulo e de `Shared` fica sob o nome do assembly; `InternalsVisibleTo` só para o próprio teste vale nos dois. Pasta e namespace: `IDE0130` como erro no build, o que fecha `Sessions/Domain/` com namespace `Sessions.Core`.

**`Result` sem HTTP e sem texto de interface.** `Error.Code` é constante estável; o texto pt-BR fica centralizado fora, e o mapeamento para `ProblemDetails` vem com o primeiro endpoint. Exceção só para erro de programação: ler `Value` em falha, `Error` em sucesso, código vazio.

**CA1716 desligada só em `Sacou.Shared` e nos seus testes.** "Shared" e "Error" são palavras-chave apenas em VB, e a API é só C#. Vale o nome do glossário.

**Testes de arquitetura: reflexão onde basta, biblioteca só onde há IL.** Superfície pública, `InternalsVisibleTo`, catálogo de módulos e `Shared` usam reflexão simples. Domínio e fronteira entre módulos precisam ler corpos de método, porque o `Domain` divide assembly com fatias que usam ASP.NET; `GetReferencedAssemblies` não serve. Para isso, `TngTech.ArchUnitNET` em versão exata (`[0.13.5]`): antes dela, dependências em método `async` sumiam em builds otimizados e a regra passava sem checar.

**As regras leem o modelo do ArchUnitNET, não a API fluente.** `ArchLoader` carrega os assemblies e as regras percorrem `architecture.Types` e `GetTypeDependencies()`, devolvendo a lista de violações. A lista de permissão é uma comparação exata de namespace, o que evita a dúvida sobre `NotDependOnAny` com conjunto vazio, e dispensa `WithoutRequiringPositiveResults()`, porque lista vazia é o resultado correto nos assemblies reais.

**Teste vazio não prova nada.** O `Domain` real ainda não existe. A prova de que cada regra funciona vem de `Sacou.Architecture.Fixtures`, com uma violação plantada por tipo, avaliada em Debug e Release. O namespace `Sacou.Modules.Alpha` etc. do `Fixtures` não entra no catálogo, porque o catálogo olha o nome do assembly. Esse projeto roda com `RunAnalyzers=false`, porque o código é estranho de propósito; nenhum outro projeto desliga os analisadores.

## Desvios do `produto.md`

**Testes da fatia fora da pasta da fatia.** O `produto.md` os põe junto da fatia, mas isso embarcaria xUnit em produção. Ficam em `tests/Sacou.Modules.<Module>.Tests/<Slice>/`, criado com a primeira fatia.

## Limites aceitos

- `internal` não barra reflexão em produção; a revisão cobre.
- Dependência só no corpo de um `async IAsyncEnumerable` ou só em `catch (X)` pode escapar das regras de IL. Rever quando o `Domain` real existir.
- `public` declarado no namespace `Contracts` de outro módulo passa na regra de superfície, que olha só o namespace.
- Constante e enum dobrados pelo compilador não deixam dependência no IL.

## Alternativas descartadas

- **Projeto `Contracts` por módulo:** custo sem uso hoje (acima).
- **NetArchTest:** sem release desde 2021.
- **Adaptador xUnit do ArchUnitNET:** traz dependências desnecessárias.
- **Varredura direta com `Mono.Cecil`:** plano B, só se o ArchUnitNET não enxergasse alguma dependência.

## Em aberto, para tarefas futuras

- E3.2: onde fica `MemberId`, usado em vários domínios (`Shared` por ADR ou `Groups.Contracts`, o que mudaria a regra do `Domain`).
- E3.11: como separar a Outbox, que precisa de infraestrutura, já que o domínio depende de `Shared`.
- E1.5: leitura dos JSON em `Matches` ou em projeto próprio.
