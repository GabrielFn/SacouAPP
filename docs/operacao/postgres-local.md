# Postgres local e testes de integração

Decisões: [ADR 0020](../arquitetura/adr/0020-postgres-local-e-testes-de-integracao.md). Precisa do Docker Desktop aberto (`docker version` responde).

## Testes de integração

```sh
dotnet test --project apps/api/tests/Sacou.Integration.Tests
```

Não precisa de `.env`. O Testcontainers baixa a imagem na primeira vez, sobe um Postgres com senha aleatória e o remove no fim (o container auxiliar Ryuk remove restos se a execução for interrompida). `dotnet test` na raiz não roda esse projeto e não precisa de Docker.

Se falhar com "Could not start Postgres in Docker (…). Check that Docker is running and can pull the image", abra o Docker Desktop, espere o ícone indicar que está rodando e repita. O tipo entre parênteses ajuda a diferenciar: `DockerUnavailableException` é Docker fora do ar; `DockerApiException` é recusa da API, por exemplo falha ao baixar a imagem (sem internet, limite de pull ou digest inexistente). Depois de reiniciar o computador o Docker pode não subir sozinho.

## Banco de desenvolvimento

1. Copie `.env.example` para `.env` e troque o valor de `POSTGRES_PASSWORD` por uma senha local sua. O `.env` não vai para o Git.
2. Suba e espere ficar saudável: `docker compose up -d --wait`.
3. Confira: `docker compose exec -T postgres pg_isready -h 127.0.0.1` e `docker compose port postgres 5432` (deve responder `127.0.0.1:5432`).
4. Conecte em `localhost:5432`, usuário `postgres`.
5. Pare e apague os dados (descartáveis): `docker compose down -v`.

- A senha só vale no primeiro início do volume. Trocou a senha com volume existente e deu erro de autenticação: `docker compose down -v` e suba de novo.
- Porta 5432 ocupada: pare o outro Postgres ou mude a porta do lado esquerdo em `docker-compose.yml` (só na sua cópia). Os testes usam porta aleatória.
- Nunca rode `docker compose config` sem `--quiet`: imprime a senha.

## Espaço em disco

O disco de imagens do Docker Desktop fica no disco do sistema. Veja o espaço em Settings > Resources > Advanced (disk image location). Para liberar: `docker compose down -v`, `docker image prune`. Mover o disco de imagens é feito pela tela de configurações do Docker, nunca movendo o arquivo à mão.

## Roteiro de 10 minutos (conferência na máquina)

1. Docker ligado: rode o teste de integração. Esperado: 2 testes aprovados.
2. `docker ps -a` logo depois: nenhum container do Testcontainers ou do Ryuk sobrando (o Ryuk some em alguns segundos).
3. Desligue o Docker Desktop e rode o teste de novo. Esperado: vermelho, código de saída diferente de 0, mensagem apontando este roteiro, nenhum teste pulado.
4. Ligue o Docker e siga a seção "Banco de desenvolvimento" até o `down -v`.
