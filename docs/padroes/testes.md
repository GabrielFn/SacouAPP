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

O primeiro golden é `packages/volley-rules/golden/formations.json`, e o contrato de leitura pelo C# está no [ADR 0006](../arquitetura/adr/0006-formacoes-em-json.md). Pacote com golden que lê arquivo declara `@types/node`, só para testes; ver ADR 0002.

## Definição de pronto

A lista completa está no `CLAUDE.md`. O testador, agente novo, roda build, lint e testes, e tenta quebrar os critérios de aceite.
