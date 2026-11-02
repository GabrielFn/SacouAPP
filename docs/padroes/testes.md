# Padrões de teste

## Ferramentas

| Onde | Ferramenta | Comando |
|---|---|---|
| `packages/*` | Vitest, arquivos `src/**/*.test.ts` junto do código | `pnpm test` |
| `apps/api/tests/` | xUnit v3 sobre Microsoft Testing Platform | `dotnet test` |
| `scripts/` | `node:test`, arquivos `*.test.mjs`, sem dependências | `pnpm test:tooling` |

## Regras

- O teste entra junto com o código e cobre a regra de negócio.
- O nome do teste descreve o comportamento. `CA1707` fica desligada em `apps/api/tests` por causa dos underscores.
- Testes TS podem ter números soltos, `let`, mutação e `node:*`: são liberados no lint. `any` continua proibido.

## Golden compartilhado TS/C#

Regras do vôlei e do motor sempre têm testes golden: os mesmos casos em JSON, executados pelas duas linguagens.

- Os casos compartilhados ficam só em JSON. `*.data.ts` é para dados que não são golden compartilhado: o lint não cobra número mágico ali, mas reprova função.
- O executor dos casos é um `*.test.ts`. Outro arquivo em `golden/` segue as regras normais.
- Vitest e xUnit leem os mesmos arquivos. Ninguém copia caso para o outro lado.
- Regra nova vai para `docs/dominio/`, como pede o `CLAUDE.md`.

O primeiro golden é `packages/volley-rules/golden/formations.json`, e o contrato de leitura pelo C# está no [ADR 0006](../arquitetura/adr/0006-formacoes-em-json.md). `golden/overlap.json` é escrito à mão e tem o contrato no [ADR 0021](../arquitetura/adr/0021-overlap-validator.md). Pacote com golden que lê arquivo declara `@types/node`, só para testes; ver ADR 0002.

No C#, os golden entram por `EmbeddedResource` só nos projetos de teste, por `apps/api/tests/Golden/GoldenFile.cs`, com leitura estrita ([ADR 0025](../arquitetura/adr/0025-json-compartilhado-no-csharp.md)). Testes de módulo em `tests/Sacou.Modules.<Module>.Tests/`: hoje `Matches` e `Stats`. Projeto de teste novo precisa de `packages.lock.json` no commit, porque o restore recria um lock ausente em vez de reprovar.

**Regra dos IDs literais, em todo golden lido pelo C#:**

- Cada arquivo tem uma lista de IDs escrita à mão no teste, nunca lida do arquivo. O `[Theory]` percorre a lista, então um caso apagado reprova o próprio ID.
- Um `[Fact]` compara a lista com o arquivo e nomeia `missing`, `unlisted` e `duplicated`; outro confere o total exato.
- O leitor recusa campo fora do esquema e chave repetida. Mensagem de falha cita o ID e o campo, nunca o valor.

## Definição de pronto

A lista completa está no `CLAUDE.md`. O testador, agente novo, roda build, lint e testes, e tenta quebrar os critérios de aceite.
