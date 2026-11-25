# Project state

The project's decisions live in `docs/arquitetura/adr/`. This log only mirrors the ones a `.specs` plan cites.

## Decisions

| ID | Decision | Rationale | Status | Date |
| --- | --- | --- | --- | --- |
| AD-001 | Aba Eu: "Compartilhar" e "Editar perfil" em largura total embaixo da cartinha, não na coluna ao lado (diferença de `Perfil.dc.html`) | Pergunta "Como deve ficar?"; Gabriel escolheu "Manter embaixo da cartinha (Recomendado)". Detalhe no ADR 0077 | active | 2026-11-23 |
| AD-002 | Autorização de operador: lista `Operations:OperatorSubjects` (UIDs do Firebase, separados por vírgula, de `vars.SACOU_OPERATOR_UIDS`), política `operator-only`, 404 para quem não está nela | Pergunta 213 (opção 1, com vários UIDs). Detalhe no ADR 0085, D1 | active | 2026-11-24 |
| AD-003 | Leitura agregada entre módulos: contratos `I<Módulo>Metrics` que só devolvem números (mais a chave e o nome do grupo), tipos comuns em `Sacou.Shared.Metrics`, composição na fatia `Sacou.Api/Operations` | Door 2 do plano da E7.2. Detalhe no ADR 0085, D2 | active | 2026-11-24 |
| AD-004 | Comandos de operação no próprio executável da API: `OperationCommands.TryMatch(args)` depois de `builder.Build()`, antes de qualquer middleware ou rota; cada comando é um `IOperationCommand` que devolve o código de saída e escreve uma linha só com números | Pergunta 228 (opção 1), door 1 do plano da E6.3. ADR na S3 da E6.3 | active | 2026-11-25 |
| AD-005 | `ErasureMode.AfterRestore` no contrato `IAccountErasure`: apaga como o `Sweep`, sem conferir bloqueio, e o Groups promove a Admin o membro ativo mais antigo com conta quando a exclusão leva o último Admin; devolve os grupos que ficaram sem Admin e sem ninguém para promover | Pergunta 231 (Gabriel: promover o mais antigo). `docs/dominio/grupos.md`, "Excluir a conta" | active | 2026-11-25 |
