# Configuração do Google Cloud (feita uma vez)

Decisões: [ADR 0068](../arquitetura/adr/0068-deploy-cloud-run-neon.md). Feita pelo Gabriel no Cloud Shell em 18/11/2026, em dois scripts. **Não rodar de novo o primeiro**: os comandos criam recursos que já existem e falham. O segundo pode ser rodado de novo sem mudar nada.

## O script

[`scripts/gcp/setup-sacou-api.sh`](../../scripts/gcp/setup-sacou-api.sh) é a fonte: só nomes, nenhum valor secreto. Ele:

1. liga as APIs (Cloud Run, Artifact Registry, Secret Manager, IAM, IAM Credentials e STS);
2. cria o repositório Docker `sacou` na `us-east4`, com limpeza que guarda as 5 imagens mais novas (a varredura de vulnerabilidade fica desligada, porque é paga);
3. cria as contas `sacou-deployer`, `sacou-api-test-run` e `sacou-api-run`, com os papéis do D3 do ADR;
4. cria os segredos **vazios** `sacou-database-url-test` e `sacou-database-url-prod` (replicação só na `us-east4`), cada um legível só pela própria conta de execução;
5. cria o pool `github` e o provedor OIDC `sacouapp`, que aceita só o repositório de ID numérico `1440184485` e a `refs/heads/main`, e dá o `workloadIdentityUser` da `sacou-deployer` só ao `principalSet` do repositório;
6. imprime as três variáveis do GitHub.

[`scripts/gcp/harden-deploy-identities.sh`](../../scripts/gcp/harden-deploy-identities.sh) veio depois (revisão de segurança da E5.1) e troca a `sacou-deployer` única por três contas, cada uma presa a um *subject* do OIDC do GitHub (D3 do ADR). Idempotente. Ele:

1. cria `sacou-builder`, `sacou-deployer-test` e `sacou-deployer-prod`;
2. cria os serviços `sacou-api-test` e `sacou-api` com a imagem de exemplo `us-docker.pkg.dev/cloudrun/container/hello`, cada um com a sua conta de execução, e os deixa públicos (`allUsers` com `run.invoker`), o que substitui a caixa do console;
3. dá ao builder só `artifactregistry.writer` no repositório `sacou`, e a cada deployer só `run.developer` no próprio serviço, `artifactregistry.reader` no repositório `sacou` e `serviceAccountUser` na própria conta de execução;
4. dá o `workloadIdentityUser` de cada conta só a um `principal`: `repo:GabrielFn@5855069/SacouAPP@1440184485:ref:refs/heads/main` (builder, job sem ambiente), `repo:GabrielFn@5855069/SacouAPP@1440184485:environment:test` e `repo:GabrielFn@5855069/SacouAPP@1440184485:environment:production`; O repositório usa o *subject* imutável do GitHub (dono e repositório com o ID numérico), conferido com `gh api repos/GabrielFn/SacouAPP/actions/oidc/customization/sub`; se esse ajuste mudar, os três `principal` precisam mudar junto. Logo depois de criar uma conta, a primeira concessão pode falhar por atraso de propagação: o script para antes de apagar a conta antiga, e basta rodá-lo de novo.
5. muda a condição do provedor para aceitar só o `deploy-api.yml` da `main` (`assertion.workflow_ref`);
6. tira os papéis da `sacou-deployer` e a apaga;
7. imprime as variáveis a criar e a apagar no GitHub.

Ordem: rodar o script, criar `GCP_BUILDER_SA`, `GCP_DEPLOYER_TEST_SA` e `GCP_DEPLOYER_PROD_SA`, apagar `GCP_DEPLOYER_SA` e só então fazer o merge do workflow.

## O que existe hoje

| Recurso | Nome |
|---|---|
| Projeto | `sacou-api` (número 804880427435), com conta de faturamento |
| Região | `us-east4` (N. Virginia, Tier 1 da faixa grátis) |
| Artifact Registry | `us-east4-docker.pkg.dev/sacou-api/sacou`, imagem `api` |
| Contas de serviço | `sacou-builder`, `sacou-deployer-test` e `sacou-deployer-prod` (GitHub Actions), `sacou-api-test-run`, `sacou-api-run` |
| Segredos | `sacou-database-url-test`, `sacou-database-url-prod` (com valor, colado pelo Gabriel no console) |
| Federação | pool `github`, provedor `sacouapp` |
| Serviços do Cloud Run | `sacou-api-test` e `sacou-api`, criados pelo segundo script com a imagem de exemplo; o primeiro deploy troca a imagem |

Variáveis do repositório (Settings → Secrets and variables → Actions → **Variables**; não são segredo): `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_BUILDER_SA`, `GCP_DEPLOYER_TEST_SA`, `GCP_DEPLOYER_PROD_SA`. Ambientes do GitHub: `test` (sem regra) e `production` (revisor obrigatório: o Gabriel; só a `main`).

## Push (E3.11 Parte 2, ADR 0069)

`scripts/gcp/setup-notifications.sh`, no Cloud Shell, depois que os dois serviços existem: liga as APIs do Cloud Tasks e do Cloud Scheduler; cria uma conta que chama por ambiente, `sacou-tasks-invoker-test` e `sacou-tasks-invoker` (sem chave e sem papel no projeto), para a fila e o job de teste nunca conseguirem chamar a produção; as filas `sacou-notifications-test` e `sacou-notifications` em `us-east4` (`max-attempts` 3, `max-dispatches-per-second` 1); dá `cloudtasks.enqueuer` a cada conta de execução só na sua fila, `iam.serviceAccountUser` dela só na conta que chama do seu ambiente e `run.invoker` dessa conta só no seu serviço; cria vazios os segredos `sacou-expo-access-token-test` e `-prod`, cada um lido só pela conta de execução do seu serviço; e os jobs diários `sacou-notifications-sweep-test` e `sacou-notifications-sweep` (4h de Brasília, `POST /internal/notifications/pump` com OIDC da conta que chama do ambiente e `audience` igual à URL do serviço). Pode rodar de novo: cada recurso só é criado quando o `describe` não o acha, e as permissões são idempotentes. No fim ele mostra, por serviço, a URL e o e-mail que vão nas variáveis `ServiceCaller__*` e `NotificationTasks__*` do deploy. Depois, no console, uma versão de cada segredo com o token de acesso do Expo (expo.dev, com a segurança reforçada do push ligada). Nunca pelo chat.

## Backups (E5.3 Parte 1, ADR 0082)

`scripts/gcp/setup-backups.sh`, no Cloud Shell, depois que os segredos `sacou-backup-database-url-test` e `-prod` têm versão (papel `sacou_backup` só de leitura no Neon): liga as APIs do Cloud Scheduler, Workflows, Cloud Storage e Monitoring; cria os buckets `sacou-api-backups-test` e `-prod` em `us-east1` (acesso uniforme, sem acesso público, retenção de 30 dias, apagados com 31, sem versionamento nem exclusão reversível); as contas `sacou-backup-test-run` e `sacou-backup-run` (cada uma lê só o seu segredo e grava só no seu bucket); os jobs `sacou-backup-test` e `sacou-backup` a partir de `deploy/backup/job.yaml`, com `scripts/backup/backup.sh` embutido; a conta `sacou-backup-trigger` (`run.invoker` nos dois jobs e `workflows.invoker` no projeto); o workflow `sacou-backups`, o agendamento `sacou-backups-daily` (4h de Brasília) e o alerta por e-mail de falha (`SACOU_ALERT_EMAIL`, dado no Cloud Shell). Pode rodar de novo. Roteiro completo, primeira execução e ensaio de restauração: [`backup.md`](backup.md).

## Passos manuais no console

- **Segredos:** em Security → Secret Manager, em cada segredo, "Nova versão" com a URL **direta** do Neon (sem "Connection pooling"). Nunca pelo chat.
- **Custo:** teto de gasto do Cloud Run no projeto e alerta de orçamento na conta de faturamento, US$ 1 (R$ 5, a conta é em reais; resposta 94).
- **Acesso público:** o segundo script já liga nos dois serviços. Nenhuma conta de deploy tem `run.admin`, então o workflow não muda isso.

## Se precisar refazer

Num projeto novo, trocar `PROJECT_ID` no topo do script, conferir `GITHUB_REPO_ID` (`gh api repos/<dono>/<repo> --jq .id`) e rodar no Cloud Shell. Depois, rodar `harden-deploy-identities.sh`, atualizar as variáveis do GitHub e este arquivo.
