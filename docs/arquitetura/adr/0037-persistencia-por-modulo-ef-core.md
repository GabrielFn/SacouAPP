# ADR 0037 · Persistência por módulo com EF Core

**Status:** aceito (08/11/2026). **Tarefa:** E3.1 (primeiro uso de EF Core). Complementa o [ADR 0005](0005-estrutura-modular-api.md) e o [ADR 0020](0020-postgres-local-e-testes-de-integracao.md).

## Contexto

O Identity é o primeiro módulo a guardar dados. O padrão escolhido aqui vale para os outros seis.

## Decisões

**Um `DbContext` por módulo**, `internal`, em `<Module>/Infrastructure/`, com schema próprio (`identity`) e o histórico de migrações no próprio schema (`__ef_migrations_history`). Nomes em snake_case explícitos (`ToTable`, `HasColumnName`, `HasName`, `HasDatabaseName`), sem pacote de convenção. O `Domain` não tem atributo de EF: o mapeamento fica em `IEntityTypeConfiguration` na `Infrastructure`, com conversores para os value objects (`UserId`, `AuthSubject`).

**Pacotes** (versão exata em `Directory.Packages.props`): `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3, alinhado ao `Npgsql` 10.0.3; `Microsoft.EntityFrameworkCore.Relational` 10.0.14 como referência direta, para o runtime usar o mesmo patch do EF Core que o pacote de design (sem ela, o Npgsql puxava 10.0.4 e o build acusava conflito); `Microsoft.EntityFrameworkCore.Design` 10.0.14 com `PrivateAssets="all"`, só para gerar migrações; `dotnet-ef` 10.0.14 em `.config/dotnet-tools.json`. `IDesignTimeDbContextFactory` no próprio módulo, com uma conexão sem senha que nunca é aberta, para gerar migração sem a API.

**Migrações são código gerado, mas `internal`.** Ficam em `Infrastructure/Migrations/`, com `generated_code = true` no `.editorconfig` e fora do `jscpd`. Depois de gerar, troque `public partial class` por `internal partial class` (a regra de superfície pública só aceita a classe de entrada do módulo) e salve em LF sem BOM. O EF encontra migrações internas.

**Aplicação.** `IdentityModule.MigrateAsync(IServiceProvider)` aplica as migrações; o `Program` chama quando `Database:MigrateOnStartup` é `true`, e os testes de integração chamam direto. `appsettings.Development.json` está no `.gitignore` (é arquivo local), então em desenvolvimento a chave vem da variável `Database__MigrateOnStartup=true` ([`postgres-local.md`](../../operacao/postgres-local.md)). Em produção, a E5.1 decide.

**Gravação idempotente sem exceção como fluxo (D6).** `POST /v1/me` faz `SELECT`; se não achou, `INSERT ... ON CONFLICT (firebase_uid) DO NOTHING`; se nada foi inserido (outro login venceu a corrida), `SELECT` de novo. O índice único é a garantia. Só quem inseriu responde 201. SQL sempre parametrizado (interpolação do EF). O plano previa `RETURNING id`; a contagem de linhas afetadas do `ExecuteSqlAsync` dá o mesmo resultado sem o risco de o EF compor a instrução numa subconsulta.

**Conexão.** `ConnectionStrings:Sacou`, lida quando o contexto é montado: faltar o valor falha na primeira consulta, não na composição. Local: `ConnectionStrings__Sacou` a partir do `POSTGRES_PASSWORD` do `.env`. Produção: E5.1.

## Alternativas descartadas

- **Um `DbContext` para a API inteira:** acopla os módulos e quebra o `internal`.
- **Pacote de convenção snake_case:** dependência a mais para o que três chamadas resolvem.
- **Dapper:** sem migrações; o EF Core está na stack aprovada.

## Consequências

- O `Sacou.Integration.Tests` referencia `Sacou.Api` e sobe a API real sobre o Postgres do Testcontainers (P1, P4 a P6).
- `HasPendingModelChanges()` em teste de unidade pega mudança de modelo sem migração.
- O modelo de execução não guarda `CHECK`: testes que leem restrições usam `IDesignTimeModel`.
