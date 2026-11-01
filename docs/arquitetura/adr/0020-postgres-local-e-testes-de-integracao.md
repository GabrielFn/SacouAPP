# ADR 0020 · Postgres local e testes de integração

**Status:** aceito (01/11/2026). **Tarefa:** E0.6. **Decidido por:** Gabriel (Docker Desktop para o desenvolvimento local, 01/11/2026); o restante, orquestrador e desenvolvedor, sem gasto, conta ou segredo novo. Roteiro: `docs/operacao/postgres-local.md`.

## Contexto

O backlog pede Postgres local e um teste de integração de exemplo. `produto.md` (linhas 328 e 332) exige testes de integração com Postgres real e nomeia o Testcontainers. O Docker Desktop já está instalado. O ambiente de CI (runner Ubuntu) tem Docker.

## Decisão

- **Testes com Testcontainers.** Cada execução sobe um Postgres descartável; Docker ausente é vermelho, nunca teste pulado. Os testes não usam o compose.
- **Desenvolvimento local com `docker-compose.yml`,** na porta `127.0.0.1:5432`, volume nomeado em `/var/lib/postgresql` (no 18 o caminho mudou) e `healthcheck` com `pg_isready -h 127.0.0.1` (no primeiro início o servidor temporário da imagem só escuta no socket Unix).
- **Imagem:** `postgres:18.6@sha256:3a4264520e121176619f54ff867d12774bc81e95e7b84db58d63bccdb6144b81`, a mesma no teste e no compose (um teste de arquitetura as compara). A tag foi republicada em 31/10/2026, então o digest vale e atualizá-lo é decisão manual, com nova leitura do registro. Conferido na implementação: o `PostgreSqlBuilder` da 4.16.0 aceita `tag@sha256` e o digest é respeitado (digest inexistente falha com `DockerApiException`; essa foi a prova de falha da fixture, feita com digest inválido e não com o Docker desligado, que segue pendente para o Gabriel).
- **Versão 18.** É o padrão do Neon para projetos novos: **a E5.1 cria o projeto com `pg_version` 18.** O Neon não fixa a versão menor; a igualdade garantida é a da principal.
- **Pacote:** `Testcontainers.PostgreSql` com versão exata `[4.16.0]`, e `Testcontainers` também em `[4.16.0]` (é nele que está o digest do Ryuk), mais `Npgsql`. A CI confere o digest do Ryuk depois do teste (`docker image ls --digests`). A versão do pacote define o digest do Ryuk (`testcontainers/ryuk:0.14.0@sha256:7c1a8a9a...`), então subi-la é revisão deliberada. Sem `Testcontainers.XunitV3`: a documentação do Testcontainers não cita o Microsoft.Testing.Platform e o pacote não é necessário (a faixa de dependência aceita o xUnit 4.0.2, então não é incompatível). O ciclo de vida usa `IAsyncLifetime` com `[assembly: AssemblyFixture]` do xUnit v3. Provado: falha na fixture sai como teste vermelho e código de saída 2 no modo Microsoft.Testing.Platform.
- **Ryuk ligado, imagem padrão.** Não se define `TESTCONTAINERS_RYUK_DISABLED` nem `TESTCONTAINERS_RYUK_CONTAINER_IMAGE`; um teste de arquitetura reprova `TESTCONTAINERS_RYUK` no `ci.yml`. Risco aceito: o Ryuk acessa o socket do Docker e roda privilegiado por padrão; é imagem fixada, só em teste.
- **Risco da porta do Ryuk:** ela não tem autenticação, fica em todas as interfaces e a regra do firewall do Docker Desktop a aceita no perfil Público. Alguém na mesma rede pode registrar um filtro e apagar containers e volumes durante a execução. **O Gabriel aceitou esse risco por ora em 01/11/2026.** Alternativas, se deixar de ser aceitável: `"ip": "127.0.0.1"` na configuração do Docker Engine, remover a regra do firewall ou marcar a rede como Privada.
- **Senha aleatória por execução,** gerada em memória (`RandomNumberGenerator`), nunca registrada. Conferido: por padrão a porta do container de teste é publicada em **todas as interfaces** (`0.0.0.0:<porta aleatória>`), por isso a senha não pode ser a padrão `postgres`. O teste a restringe a loopback com `WithCreateParameterModifier`, fixando `HostIP = "127.0.0.1"` nos `PortBindings` (conferido no Windows: `127.0.0.1:<porta>->5432/tcp`); a prova em Linux é a CI, e se falhar lá o ajuste volta atrás e é registrado. A mensagem de falha mostra só o tipo da exceção, nunca a conexão.
- **Projeto `apps/api/tests/Sacou.Integration.Tests` fora do `Sacou.slnx`,** para o `dotnet test` puro seguir rápido e sem Docker. Sem `IsTestProject=false` (o modo MTP pode ignorá-lo, dotnet/sdk#51873) e sem segundo `.slnx` (o `dotnet build` sem parâmetro falharia).
- **CI:** passos `Test API integration` e `Check Postgres compose` no `verify`. `Sacou.Architecture.Tests` guarda: passos presentes; mesma imagem com digest em teste e compose; projeto fora do `.slnx`, sem `Assert.Skip` nem `GetEnvironmentVariable`; Testcontainers com versão exata; Ryuk intocado; `audit:api` cobrindo o projeto.
- **Natureza das guardas:** casam texto (sem parser YAML nem recorte de bloco, comentários ignorados). São um alarme de remoção acidental; a barreira contra um PR adversário é a leitura obrigatória do `ci.yml` (`docs/padroes/commits-e-prs.md`).
- **Ferramentas:** `lint:api`, `format:api` e `audit:api` incluem o projeto fora da solução (o audit gera um segundo relatório, `.nuget-audit-integration.json`).

## Alternativas

- **Binários do Postgres da EDB:** `bin\postgres.exe` sem assinatura (18.6-3 e 18.6-5).
- **Postgres instalado direto na máquina ou no runner:** versão e dados dependem do ambiente.
- **`services.postgres` na CI com senha literal:** a CI seria diferente da máquina local e exporia senha fixa.
- **`SACOU_TEST_POSTGRES_CONNECTION`:** permitiria apontar o teste para um banco existente; removido.
- **`Testcontainers.XunitV3`:** não é necessário; o `IAsyncLifetime` com `AssemblyFixture` basta.

## Consequências

- Rodar o teste de integração exige Docker; sem ele, falha com mensagem que aponta o roteiro.
- Docker Desktop no Windows 10 Home está fora da lista oficial de suporte; a CI é a prova independente. Licença: uso gratuito enquanto a empresa tiver menos de 250 funcionários e menos de US$ 10 milhões de receita; passar disso é decisão de dinheiro do Gabriel.
- O disco de imagens do Docker fica no C: (pouco espaço); imagens e volumes crescem lá.
- `docker.io` fora do ar ou com limite de pull deixa o `verify` vermelho; repetir o run, sem trocar o digest pela tag.
- Para atualizar o Postgres: reler o digest no registro, trocar nos dois lugares e rodar os testes.
