# ADR 0058 · Repositório público

**Status:** aceito (16/11/2026). **Decidido por:** Gabriel. Altera o contexto do [ADR 0004](0004-ci-github-actions.md).

## Contexto

Com o repositório privado, a CI usava a cota de 2.000 min/mês do plano Free. Em novembro foram cerca de 300 execuções, com o `verify` em cerca de 15 min (8 min só nos testes de integração), e a cota acabou. O Gabriel não quer pagar minutos extras.

## Decisão

1. **`GabrielFn/SacouAPP` passa a ser público** (16/11/2026). Em repositório público, os runners padrão do GitHub Actions não têm limite de minutos. O `ci.yml` não muda.
2. **Workflows de PR de fora pedem aprovação:** a política de aprovação de PR de fork passou de `first_time_contributors` para `all_external_contributors`. Nenhum PR de quem não é colaborador roda a CI sem o Gabriel aprovar.
3. **O resto continua igual:** `permissions: contents: read`, sem segredos na CI, actions fixadas por SHA e gitleaks em todo o histórico (ADR 0007). Os segredos do Actions e do Railway não ficam visíveis para PR de fork.

## Alternativas

- **Runner no PC do Gabriel:** um i7-5500U de 2 núcleos e 10 GB de RAM, com os caches no HDD. A execução levaria de 30 a 45 min e disputaria a máquina com os agentes. Recusado.
- **Gastar menos minutos** (CI só em PR pronto e jobs da API e do app separados por área): também não resolvia o resto do mês. Fica como plano se o repositório voltar a ser privado.
- **Pagar minutos extras:** recusado pelo Gabriel.

## Consequências

- Código, docs, telas e modelo de ameaças ficam visíveis para qualquer pessoa. Voltar a privado não apaga as cópias já feitas.
- O e-mail de autor dos commits fica público em todo o histórico. Reescrever o histórico para trocá-lo foi descartado.
- **O `google-services.json` fica público quando for versionado** (ADR 0057). Como ele já vai dentro do APK, isso não muda o que ele expõe. Mas a restrição da chave de API ao pacote `com.sacou.app` e ao SHA-1 deixa de ser só uma boa prática e passa a ser condição obrigatória antes do commit.
- Um segredo que vazar num commit fica público na hora, e não só para colaboradores. A resposta a vazamento em [`varredura-ci.md`](../../seguranca/varredura-ci.md) (revogar primeiro) fica ainda mais urgente.
