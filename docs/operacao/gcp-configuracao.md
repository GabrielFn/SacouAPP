# Configuração do Google Cloud (feita uma vez)

Decisões: [ADR 0068](../arquitetura/adr/0068-deploy-cloud-run-neon.md). Feita pelo Gabriel no Cloud Shell em 18/11/2026. **Não rodar de novo**: os comandos criam recursos que já existem e falham.

## O script

[`scripts/gcp/setup-sacou-api.sh`](../../scripts/gcp/setup-sacou-api.sh) é a fonte: só nomes, nenhum valor secreto. Ele:

1. liga as APIs (Cloud Run, Artifact Registry, Secret Manager, IAM, IAM Credentials e STS);
2. cria o repositório Docker `sacou` na `us-east4`, com limpeza que guarda as 5 imagens mais novas (a varredura de vulnerabilidade fica desligada, porque é paga);
3. cria as contas `sacou-deployer`, `sacou-api-test-run` e `sacou-api-run`, com os papéis do D3 do ADR;
4. cria os segredos **vazios** `sacou-database-url-test` e `sacou-database-url-prod` (replicação só na `us-east4`), cada um legível só pela própria conta de execução;
5. cria o pool `github` e o provedor OIDC `sacouapp`, que aceita só o repositório de ID numérico `1440184485` e a `refs/heads/main`, e dá o `workloadIdentityUser` da `sacou-deployer` só ao `principalSet` do repositório;
6. imprime as três variáveis do GitHub.

## O que existe hoje

| Recurso | Nome |
|---|---|
| Projeto | `sacou-api` (número 804880427435), com conta de faturamento |
| Região | `us-east4` (N. Virginia, Tier 1 da faixa grátis) |
| Artifact Registry | `us-east4-docker.pkg.dev/sacou-api/sacou`, imagem `api` |
| Contas de serviço | `sacou-deployer` (GitHub Actions), `sacou-api-test-run`, `sacou-api-run` |
| Segredos | `sacou-database-url-test`, `sacou-database-url-prod` (com valor, colado pelo Gabriel no console) |
| Federação | pool `github`, provedor `sacouapp` |
| Serviços do Cloud Run | `sacou-api-test` e `sacou-api`, **criados pelo primeiro deploy** (não pelo script) |

Variáveis do repositório (Settings → Secrets and variables → Actions → **Variables**; não são segredo): `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_DEPLOYER_SA`. Ambientes do GitHub: `test` (sem regra) e `production` (revisor obrigatório: o Gabriel; só a `main`).

## Passos manuais no console

- **Segredos:** em Security → Secret Manager, em cada segredo, "Nova versão" com a URL **direta** do Neon (sem "Connection pooling"). Nunca pelo chat.
- **Custo:** teto de gasto do Cloud Run no projeto e alerta de orçamento na conta de faturamento, US$ 1 (resposta 94).
- **Acesso público, uma vez por serviço, depois do primeiro deploy dele:** Cloud Run → serviço → Segurança → "Permitir acesso público". A `sacou-deployer` não tem `run.admin`, então o workflow não liga isso sozinho.

## Se precisar refazer

Num projeto novo, trocar `PROJECT_ID` no topo do script, conferir `GITHUB_REPO_ID` (`gh api repos/<dono>/<repo> --jq .id`) e rodar no Cloud Shell. Depois, atualizar as três variáveis do GitHub e este arquivo.
