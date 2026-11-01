# SEC-M1 · Correções da revisão de segurança do M1

**Origem:** [parecer de 01/11/2026](../../seguranca/revisoes/M1-2026-11-01.md), achados A1, A2, A3 e B1. **Sensível para segurança:** sim, porque altera a barreira da CI. **Desenvolvedor:** Opus. **Toca arquivos de leitura obrigatória** (`docs/padroes/commits-e-prs.md`). **Decisão pendente do Gabriel:** nenhuma. **Merge:** antes de E1.2, E1.3, E1.4 e E2.1 entrarem na `main`.

## Aceite

Cada forma abaixo tem um caso de teste que passava antes e agora reprova, mais um caso válido que continua passando.

## Sub-passos

Branch `task/SEC-M1-audit-policy`.

1. **A1, `scripts/lib/npm-audit-policy.mjs`:** ler o YAML com parser real, ou reprovar `audit` fora da forma canônica e qualquer `ghsa-`, sem diferenciar caixa, fora da lista lida. Validade com teto de 180 dias, contados da data de execução. Casos: `audit: { ignore: [...] }`, linha em branco antes do item, GHSA em maiúsculas, `expires: 9999-12-31`. A exceção atual, até 31/01/2027, deve continuar válida.
2. **A3, mesmo arquivo:** aceitar só `catalog:` exato, resolver o spec pelo catálogo antes de identificar o pacote e comparar com os `importers` do lockfile, inclusive a raiz. Conferir antes o formato do alias no lockfile. Casos: `catalog:legacy` e `catalog:nao-existe` com `zod` no catálogo padrão, `validator: npm:zod`, `validator: catalog:` apontando para `npm:zod@3.25.76`, URL de tarball, `github:colinhacks/zod`.
3. **A2, `test:tooling`:** reprovar `uses:` sem SHA de 40 caracteres em `.github/workflows/`, e `resolution` com `tarball:` fora de `registry.npmjs.org` em `pnpm-lock.yaml`. Casos plantados para os dois.
4. **B1, `.gitignore`:** cobrir `service-account*.json`, `firebase-adminsdk*.json`, `appsettings.Development.json`, `secrets.json`, `credentials.json`, `*.pem`, `*.jks`, `*.keystore`, `*.p12`, `.npmrc` e `.claude/settings.local.json`. `google-services.json` e `GoogleService-Info.plist` ficam para a tarefa do Firebase decidir. Conferir com `git check-ignore` e garantir que nada rastreado passa a ser ignorado.
5. **Docs:** retirar de `varredura-ci.md` os limites corrigidos e ajustar o ADR 0007.

## Riscos

- Um parser YAML novo é dependência de ferramenta: preferir o que já existe no lockfile; se for preciso declarar, usar versão exata.
- A checagem de `importers` não pode reprovar o `zod` transitivo de `@expo/cli`, coberto pela exceção.
