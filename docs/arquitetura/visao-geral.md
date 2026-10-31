# Visão geral da arquitetura

Versão curta, da tarefa E0.2; a E0.8 expande. Motivos em [ADR 0005](adr/0005-estrutura-modular-api.md).

## Módulos da API

Monólito modular em .NET 10, com 7 módulos: Identity, Groups, Sessions, Matches, Payments, Summaries e Stats. Cada um é um `.csproj` em `apps/api/src/Sacou.Modules/<Module>/`.

## Dependências permitidas

```
Sacou.Api  ->  Sacou.Modules.*  ->  Sacou.Shared  ->  só BCL
```

- Um módulo só enxerga de outro o namespace `Sacou.Modules.<Outro>.Contracts`. Hoje nenhum módulo referencia outro.
- `Domain` só usa uma lista fechada de namespaces da BCL, `Sacou.Shared` e o próprio `Domain`.
- As regras são testes em `apps/api/tests/Sacou.Architecture.Tests`, provados contra violações plantadas em `Sacou.Architecture.Fixtures`.

## Onde fica cada coisa

| Local | Conteúdo |
|---|---|
| `src/Sacou.Api/` | Composição (`Program.cs`, `/health`) e, depois, Razor Pages |
| `src/Sacou.Shared/Results/` | `Result`, `Result<T>`, `Error`, `ErrorKind`. Namespace público novo exige ADR |
| `src/Sacou.Modules/<Module>/<Module>Module.cs` | Entrada pública: `AddXModule(IServiceCollection)` |
| `.../<Module>/Contracts/` | Única superfície pública para outros módulos |
| `.../<Module>/Domain/` | Domínio `internal`, sem infraestrutura |
| `.../<Module>/<Slice>/` | Fatia vertical `internal`: endpoint, request, handler, validação |
| `.../<Module>/Infrastructure/` | `DbContext` etc., a partir da E0.6 |
| `tests/Sacou.Modules.<Module>.Tests/<Slice>/` | Testes da fatia, criados com a primeira fatia |

Caminhos relativos a `apps/api/`. Pastas de módulo só existem quando têm conteúdo.
