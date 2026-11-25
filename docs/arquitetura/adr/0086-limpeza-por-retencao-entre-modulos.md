# ADR 0086 · Limpeza por retenção entre módulos: `IRetentionCleanup` na rota interna

**Status:** aceito (25/11/2026), E6.5 S1. **Decidido por:** Gabriel, ao aprovar a porta 1 do plano ([plano](../../../.specs/features/E6.5/plan.md)), e o desenvolvedor dentro dele.

## Contexto

A marca de exclusão (`identity.deleted_accounts`, ADR 0056, D5) vale 60 dias (pergunta 222), mas nada a apagava. O Cloud Run escala a zero, então não há `BackgroundService` com timer (teste `Api_HasNoBackgroundWork`), e a única coisa que roda todo dia é a rota interna `POST /internal/notifications/pump`, chamada pelo Cloud Scheduler e pelo Cloud Tasks com OIDC (ADR 0069, D10 a D13). Outros módulos terão prazos parecidos (a E6.6, por exemplo, apaga denúncias velhas).

## Decisão

- **Contrato** em `Sacou.Shared/Retention/IRetentionCleanup.cs`: `Task CleanUpAsync(DateTimeOffset now, CancellationToken cancellationToken)`. Idempotente (o corte depende só de `now`), em lotes, para quando o token dispara; o que sobrar sai na próxima chamada.
- **Registro:** cada módulo registra a sua com `services.AddScoped<IRetentionCleanup, ...>()`. A primeira é `PostgresDeletionMarkPurge` do Identity (lotes de 500, `deleted_at < now - DeletionMarkRetention.Period`).
- **Execução:** `InternalPumpEndpoint` recebe `IEnumerable<IRetentionCleanup>` e roda cada uma no passo `retention-cleanup`, com o `StepAsync` de sempre (a falha fica no log pelo tipo e não para os outros passos) e o mesmo orçamento de 25 s. A rota não conhece nenhuma limpeza pelo nome, e o Notifications não passa a referenciar o Identity fora de `Contracts`.
- **Log:** só números (ADR 0056, D11): a limpeza das marcas registra quantas apagou, e nada quando é zero.

## Alternativas rejeitadas

- **Rota `POST /internal/identity/sweep` com job novo do Scheduler:** mais um job, mais um binding do invocador e mais um script no Cloud Shell, para um `DELETE` de uma linha.
- **`BackgroundService` com timer:** o Cloud Run escala a zero; o timer não é confiável.
- **Contrato do Identity chamado pelo Notifications (`IDeletionMarkPurge`):** a rota passaria a conhecer cada limpeza pelo nome.
- **Identity implementar `INotificationSource`:** semântica errada, não há outbox.

## Consequências

- A próxima retenção de outro módulo implementa o mesmo contrato e entra na rota sem mudar o endpoint. Limpezas já existentes com contrato próprio (o `INotificationRetention` do módulo, e o da E6.6 se entrar antes) podem migrar para este contrato quando forem mexidas.
- A limpeza roda a cada chamada da rota (diária pelo Scheduler e a cada janela do Cloud Tasks); o `DELETE` vazio é barato.
