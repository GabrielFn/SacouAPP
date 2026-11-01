# ADR 0014 · Login com Firebase Auth

**Status:** aceito (decidido em 30/10/2026, registrado em 31/10/2026). **Tarefa:** E0.8.

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
