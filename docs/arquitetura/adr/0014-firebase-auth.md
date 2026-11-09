# ADR 0014 · Login com Firebase Auth

**Status:** aceito (decidido em 30/10/2026, registrado em 31/10/2026). **Tarefa:** E0.8.

> **Atualizado pelo [ADR 0036](0036-verificacao-do-token-e-usuario.md) (E3.1, 08/11/2026):** a validação não usa o FirebaseAdmin, e sim o JWT pelas chaves públicas do Google, sem conta de serviço. O FirebaseAdmin segue para administrar contas (E3.16). Os pontos a definir sobre dados guardados e tentativas de senha estão resolvidos lá.

**Fontes:** `decisoes.md:19`; `produto.md:115, 250, 275, 400`.

## Decisão

- **Provedores:** Google, Apple (obrigatório no iOS) e e-mail/senha, via Firebase Auth. Sem telefone.
- **Validação:** a API valida o token com FirebaseAdmin.
- **Interface:** botões de login só aparecem para quem está deslogado.

## Alternativas

Sem alternativa documentada.

## Consequências

- O domínio não conhece Firebase (`produto.md:275`).
- **A definir:** quais dados do provedor a API guarda e proteção contra tentativas repetidas de senha, além do limite de requisições (E3.1); armazenamento do token no app (E4.3); sessão na página web (E3.12).
