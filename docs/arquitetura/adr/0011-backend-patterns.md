# ADR 0011 · Padrões de back-end, sem MediatR e AutoMapper

**Status:** aceito (decidido em 30/10/2026, registrado em 31/10/2026). **Tarefa:** E0.8.

**Fontes:** `decisoes.md:27`; `produto.md:303-315, 332-333, 348`. Estrutura, `Result` e testes de arquitetura no [ADR 0005](0005-estrutura-modular-api.md); lint no [ADR 0002](0002-padroes-e-lint.md).

## Decisão

| Padrão                  | Uso                                                                                                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strategy                | `IRotationSystem`, `IQueueExitCriterion`, `ITeamBalancer`; `IBenchRule` só quando houver regra automática de banco (ADR 0027)                                                                                                                  |
| SettingsResolver        | Mescla grupo → rodada → partida, folha a folha. **Substituído em parte pelo [ADR 0041](0041-configuracao-herdada-e-modelos.md):** a camada é parcial (folha ausente herda) e nenhuma folha é nula; o catálogo é um JSON único lido por TS e C# |
| Outbox                  | Eventos gravados na mesma transação e enviados pelo Hangfire                                                                                                                                                                                   |
| Idempotência            | Eventos com ID gerado no celular; reenvio não duplica                                                                                                                                                                                          |
| Concorrência otimista   | `xmin` como versão, usada na disputa pela última vaga                                                                                                                                                                                          |
| Result pattern          | Erro de regra vira resultado e depois `ProblemDetails`, sem exceção                                                                                                                                                                            |
| Autorização por recurso | Policies verificam o papel no grupo (Admin, CoAdmin, Scorekeeper)                                                                                                                                                                              |
| CQRS leve               | Comandos passam pelo domínio; leituras usam projeções com `AsNoTracking`                                                                                                                                                                       |
| Testes golden           | JSONs rodados em C# e em TypeScript                                                                                                                                                                                                            |

**Sem MediatR e sem AutoMapper:** handlers injetados diretamente e mapeamento manual.

## Alternativas

MediatR e AutoMapper: recusados porque passaram a ter licença comercial em 2025 (`produto.md:333`).

## Consequências

- Em `Sacou.Shared` só entra namespace novo com ADR (ADR 0005). `produto.md:348` lista Outbox, SettingsResolver e Entitlements ali; cada um entra na tarefa que o implementa.
- **A definir:** como separar a Outbox, que precisa de infraestrutura (E3.11, já aberto no ADR 0005).

> **Nota (E3.4, ADR 0043):** a disputa pela última vaga da rodada usa trava pessimista curta por rodada, não `xmin`; a regra é sobre o conjunto de presenças (mesmo motivo do ADR 0040 D8).
