# Progresso

**Marco atual:** M1 · Fundação

| Tarefa | Status | Observação |
|---|---|---|
| E0.1 | Feita | Plano em `docs/estado/tarefas/E0.1.md`; decisões no ADR 0001. Aprovada no ciclo 2 de revisão. Validação em Linux fica para a CI (E0.4). |
| E0.3 | Em andamento | Implementação na branch `task/E0.3-code-standards`. |
| E0.5 | Em andamento | Revisão e testes da branch `task/E0.5-knowledge-base`. |

## Adiadas

- E0.7: tarefa agendada. Adiada pelo Gabriel em 30/10/2026: por enquanto as sessões são abertas manualmente.

## Pendências herdadas

- E0.4: validar em Ubuntu o que só foi validado no Windows (`expo export` com Hermes, `pnpm test`, `dotnet build`, `dotnet test`). Rodar sempre `pnpm install --frozen-lockfile` antes do Turbo: editar o `pnpm-lock.yaml` sem reinstalar não invalida o cache.
- E0.3: a working copy do Gabriel tem arquivos em CRLF de antes do `.gitattributes`; o índice está em LF. O lint não pode acusar isso como erro por causa do checkout antigo.
- E4.1: validar cedo o Unistyles com React Native 0.88 (sem confirmação nas fontes).

## Bloqueadas
Nenhuma.
