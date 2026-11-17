# ADR 0062 · Limite de requisições e concorrência das rotas de duas conexões

**Status:** aceito (17/11/2026). **Decidido por:** Gabriel (perguntas 66, opção 1, e 67); números e detalhes técnicos pelo time (tarefa E5.3a).

## Contexto

A revisão do M3 (condição 1) bloqueia o primeiro deploy (E5.1) até a API ter limite por usuário nas rotas caras ou abusáveis: login, prévia e aceite de convite, criação de grupo, sorteio (~0,4 s de CPU por chamada, ADR 0055), exportação e notas do admin. Junto, o achado M3-M1: o aceite de convite e a criação de grupo seguram duas conexões ao mesmo tempo (a do Groups, com a trava, e a da conferência do Identity, ADR 0056, D7a), e pedidos simultâneos podem esgotar o pool e esperar uns pelos outros até o tempo limite.

## Decisão

1. **`AddRateLimiter` do ASP.NET Core, em memória, janela fixa** (`Sacou.Http/RateLimiting`), `QueueLimit = 0`: passou do limite, 429 na hora.
2. **Chave sem dado pessoal:** SHA-256 em hexadecimal do `ClaimTypes.NameIdentifier` (o UID do Firebase), calculada no pedido e guardada só no dicionário de partições do limitador. Nunca o UID cru, nunca em log, métrica ou resposta. Não usa `UserId` nem `MemberId`, que pediriam leitura no banco antes do limite. Pedido sem usuário (o `/health`) não tem limite (`GetNoLimiter`).
3. **Lugar no pipeline:** `UseSacouRateLimiting()` (`UseRateLimiter`) depois de `UseAuthentication()` e `UseAuthorization()`. O 401 sai antes e não gasta cota; a verificação do token (local, chaves em cache, teto de 8 KB) roda antes do limite.
4. **Políticas** (valores iniciais em `appsettings.json`, seção `RateLimiting`; a política da rota soma-se à global):

   | Política | Rotas | Limite por usuário |
   |---|---|---|
   | global | toda rota autenticada | 120 / 60 s |
   | `sign-in` | `POST /v1/me` | 10 / 60 s |
   | `invite` | `POST /v1/invites/preview` e `/accept` (mesmo balde) | 20 / 60 s |
   | `group-create` | `POST /v1/groups` | 10 / 1 h |
   | `invite-create` | `POST /v1/groups/{id}/invites` | 20 / 1 h |
   | `draw` | `POST .../rounds/{id}/draw` | 10 / 60 s |
   | `member-levels` | `PUT .../member-levels` e `.../member-levels/{memberId}` | 60 / 60 s |
   | `account-export` | `GET /v1/me/export` | 5 / 1 h |
   | `account-delete` | `DELETE /v1/me` | 5 / 1 h |
   | `court-sync` | lote e leitura do stream da quadra (E3.7) | 120 / 60 s |

   Cada rota declara a sua no próprio `*Endpoint.cs` (`.RequireRateLimiting(RateLimitPolicies.X)`); um teste confere a tabela método + rota → política, e que nenhuma outra rota tem política própria.
5. **Duas conexões (M3-M1):** o limitador global é `PartitionedRateLimiter.CreateChained` da janela por usuário com um `ConcurrencyLimiter` **de uma partição só para todos**, aplicado às rotas das políticas `group-create` e `invite`: `DualConnectionConcurrency` (8) pedidos rodam juntos, `DualConnectionQueue` (16) esperam em fila (`OldestFirst`), o resto recebe 429. Assim no máximo 2 × 8 conexões ficam presas nessas rotas. Na partida, o Groups confere `2 × DualConnectionConcurrency + DualConnectionHeadroom (4) ≤ Maximum Pool Size` (lido com `NpgsqlConnectionStringBuilder`; 100 se a string não diz) e **a partida falha** se não couber, sem ecoar a string. O D7a não muda: a conferência continua em outra conexão, sob a trava da pessoa.
6. **Resposta 429:** `ProblemDetails` (`application/problem+json`) com título fixo `Too many requests`, `type` da RFC 6585, extensão `code` = `api.rate-limited`, `Retry-After` em segundos inteiros (o metadado do lease arredondado para cima, mínimo 1; sem metadado, que é a fila cheia da concorrência, 1 s) e `Cache-Control: no-store`. Sem detalhe, sem nome da política, sem chave. O código entra em `x-sacou-error-codes` (`PipelineErrorCodes`), e o 429 com `Retry-After` é declarado no OpenAPI de toda rota autenticada. Log: uma linha `Information` com o nome da política, nada do usuário.
7. **Configuração com `ValidateOnStart`:** toda janela presente, todo inteiro ≥ 1. Política faltando ou número inválido para a partida.
8. **App:** novo `ApiError` `{ kind: "rate-limited", retryAfterMs }`, decidido pelo status 429 antes do código (como o 503). Texto único em `strings/api-errors.pt-BR.ts`, usado pelo `kind` e pelo código `api.rate-limited`. `shouldRetryQuery` não repete 429 (repetir só gasta a cota); o cache persistido não é apagado por um 429.

## Consequências

- **Janela fixa** deixa passar até o dobro do limite na virada da janela. Risco aceito: os limites são folgados para o uso real e baixos para o abuso; a janela deslizante custaria mais memória por usuário.
- **Memória:** o dicionário de partições guarda um hash por usuário ativo por política; o `PartitionedRateLimiter` recolhe os limitadores ociosos (janela vencida e sem permissões em uso) no seu laço de limpeza, então não cresce sem teto com usuários que pararam de chamar.
- **Uma réplica:** o limitador é por processo. Com mais de uma réplica, cada uma tem a sua cota; o limitador distribuído fica para a E5.3.
- **Fica para a E5.3:** limite por IP para pedidos sem token ou com token recusado (precisa de `ForwardedHeaders` com o proxy do Railway); limite na borda; ajuste dos números com os 429 reais do piloto (E5.2); tamanho final do pool contra o limite de conexões do Neon (a E5.1 escolhe a string; esta decisão só garante a conferência).
- **Números podem barrar um admin legítimo** (notas uma a uma em grupo grande). Mitigação: 60/min e configuração sem novo deploy de código.
- **E3.7:** a política `court-sync` existe desde já; a E3.7 Parte 2 a aplica nas rotas do stream. **E4.11:** o laço de sincronização da quadra espera `retryAfterMs` de um `rate-limited`.
- Os testes de integração usam limites altos por padrão (`ApiWithDatabase`); só os de `Sacou.Integration.Tests.RateLimiting` baixam os números, e o de concorrência roda com pool de 6 (24 pedidos simultâneos de duas conexões, todos 201 ou 200). O controle é a partida recusada com a concorrência inicial de 8 nesse pool: uma corrida sem o limite esgotou o pool numa execução isolada, mas não na suíte inteira, por depender do tempo da máquina, e por isso não ficou como teste.
