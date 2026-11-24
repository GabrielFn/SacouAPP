# Deploy da API

Decisões: [ADR 0068](../arquitetura/adr/0068-deploy-cloud-run-neon.md). Configuração feita uma vez: [`gcp-configuracao.md`](gcp-configuracao.md).

## Ambientes

| Ambiente | Serviço do Cloud Run | `ASPNETCORE_ENVIRONMENT` | Banco (Neon, `us-east-1`, Postgres 18) | Segredo | Conta de execução |
|---|---|---|---|---|---|
| Teste | `sacou-api-test` | `Staging` | projeto `sacou-test`, banco `sacou` | `sacou-database-url-test` | `sacou-api-test-run` |
| Produção | `sacou-api` | `Production` | projeto `sacou-prod`, banco `sacou` | `sacou-database-url-prod` | `sacou-api-run` |

Os dois na `us-east4`, projeto `sacou-api`, com a configuração de `deploy/cloud-run/service.yaml`: 1 vCPU, 512 MiB, de 0 a 1 instância, cobrança por requisição, tempo limite de 60 s, sonda de partida em `/health`. As URLs são as `*.run.app` mostradas no run do GitHub (ambiente `test` e `production`) e no console; não há domínio próprio agora (resposta 89: a E5.4 usa EAS Update para poder trocar o endereço pelo ar, e o domínio entra quando a E3.12 for aos jogadores).

Variáveis (só nomes): `SACOU_DATABASE_URL` (do Secret Manager, por referência), `ASPNETCORE_ENVIRONMENT`, `Database__MigrateOnStartup=true` e `RoundPage__PublicBaseUrl` (origem da página da rodada, [ADR 0070](../arquitetura/adr/0070-pagina-web-da-rodada.md): no teste, o workflow fixa `https://sacou-api-test-804880427435.us-east4.run.app` (o host autorizado no Firebase; o `status.url` do serviço devolve outro apelido, `...-podxbcrrra-uk.a.run.app`, achado no celular em 21/11); sem a entrada, a ação usa o `status.url`; a entrada troca pelo domínio quando ele existir; sem ela fora de `Development`, a API não sobe). **Primeiro deploy de um serviço novo:** o `gcloud run services describe` falha porque o serviço ainda não existe, então a entrada `public-base-url` é obrigatória nesse deploy. Lista completa em [`segredos.md`](../seguranca/segredos.md). A página da rodada (E3.12 Parte 2, ADR 0070, D4 e D5) lê de `appsettings.json`, sem variável no serviço: `Firebase:Web:ApiKey`, `AuthDomain`, `ProjectId` e `AppId` (configuração **pública** do app Web do Firebase, a mesma no teste e na produção, registrada em 19/11/2026; vazia, a página fica só leitura, sem VOU. No console do Firebase: domínio autorizado `sacou-api-test-804880427435.us-east4.run.app` e a chave restrita por referenciador a esse host e a `sacou-79493.firebaseapp.com`; **antes da produção e para testar no `localhost`, o Gabriel acrescenta o host nos dois lugares**), `WebSecurity` (as origens do Google e do Firebase da CSP, a confirmar no spike) . A imagem leva o build de `@sacou/web` (estágio Node do `Dockerfile`), com as três entradas: a página da rodada, o convite `/c` (E3.12 Parte 3, ADR 0070, D8) e o estilo das páginas `/termos` e `/privacidade`, cujos textos vêm de `docs/legal/`, embutidos no build (E6.1, [ADR 0083](../arquitetura/adr/0083-documentos-legais-publicados-pela-api.md); sem variável). **Link do convite no app:** `EXPO_PUBLIC_INVITE_BASE_URL` (variável do EAS e do `.env` local) recebe a mesma origem de `RoundPage__PublicBaseUrl` do ambiente, sem caminho (o app acrescenta `/c#token`); no piloto, o `https://sacou-api-<hash>.us-east4.run.app` do teste ou da produção. Sem ela, os botões de convite somem (pergunta 33). Com o domínio próprio, troca-se as duas juntas.

## Fluxo

1. PR com CI verde → merge squash na `main`.
2. O `CI` roda na `main`. Só com ele verde o workflow **Deploy API** (`.github/workflows/deploy-api.yml`) começa. CI vermelha: nada sobe; corrigir com um PR novo.
3. Job `changes`: se o commit só mexe em `docs/` (fora de `docs/dominio/`) ou só em `apps/mobile/`, o deploy é pulado (`api=false` de `scripts/ci-areas.mjs`). Qualquer outra coisa, ou um diff que falhe, faz o deploy.
4. Job `build` (conta `sacou-builder`, sem ambiente): monta a imagem e envia para o Artifact Registry; a saída é a imagem **por digest**.
5. Job `deploy-test` (ambiente `test`, conta `sacou-deployer-test`): aplica o `service.yaml` no `sacou-api-test` e chama `/health`.
6. Job `deploy-production` (ambiente `production`, conta `sacou-deployer-prod`): espera a **aprovação do Gabriel** (Actions → o run → "Review deployments" → Approve). Sobe a mesma imagem, pelo digest, no `sacou-api` e chama `/health`. Sem aprovação, só o teste muda.

Cada deploy tem o seu grupo de `concurrency` (`deploy-api-test` e `deploy-api-production`), sem cancelar o que já roda: um run parado à espera da aprovação da produção não segura o deploy do teste do run seguinte. Por grupo, o GitHub mantém no máximo um job rodando e um pendente: um pendente novo cancela o pendente mais velho antes de ele começar, então a produção sobe sempre o run mais novo que chegou lá.

As migrações rodam na partida de cada revisão, antes de a porta abrir. Se falharem, a revisão nova não recebe tráfego e a anterior continua no ar; o job falha.

**Toda migração tem de ser compatível com a versão anterior** (expandir e depois contrair): durante o deploy, a revisão velha e a nova convivem. Renomear ou apagar coluna leva dois deploys: primeiro o código para de usar, depois a migração remove.

## Push (E3.11 Parte 2)

**Limites de requisição no teste:** `appsettings.Staging.json` multiplica por 10 os limites de `RateLimiting` só no `sacou-api-test` (pedido do Gabriel em 21/11/2026, depois de o teste no celular bater em "Muitas tentativas" no cadastro e na exportação). A produção usa os valores de `appsettings.json` (ADR 0062).

Push ligado no deploy em 21/11/2026 (o Gabriel rodou `scripts/gcp/setup-notifications.sh` e pôs o token do Expo em `sacou-expo-access-token-test`). **Antes de aprovar o primeiro deploy da produção, o segredo `sacou-expo-access-token-prod` precisa de uma versão**, ou o Cloud Run recusa a revisão. Sem o token (rodando local), o envio fica desligado (um aviso `PushSendingOff` no log, só com o nome), o Cloud Tasks não é chamado e a rota interna recusa tudo. O que o deploy passa: no `service.yaml`, `SACOU_EXPO_ACCESS_TOKEN` por `secretKeyRef` (segredo do ambiente) e as variáveis não secretas `ServiceCaller__Audience` e `NotificationTasks__ServiceUrl` (URL do serviço), `ServiceCaller__Email` e `NotificationTasks__InvokerEmail` (a conta que chama do ambiente: `sacou-tasks-invoker-test@sacou-api.iam.gserviceaccount.com` no `sacou-api-test`, `sacou-tasks-invoker@sacou-api.iam.gserviceaccount.com` no `sacou-api`), `NotificationTasks__Project` (`sacou-api`), `NotificationTasks__Location` (`us-east4`) e `NotificationTasks__Queue` (`sacou-notifications-test` ou `sacou-notifications`), com as entradas correspondentes na ação `deploy-cloud-run`. Os dois lados de cada par precisam ser iguais (o `aud` e o `email` que o Cloud Tasks põe no token são os que a rota aceita): definidos e diferentes, a API não sobe e o erro cita só os nomes das chaves, em vez de levar 401 calado em toda tarefa.

## Primeiro deploy de cada serviço

Os dois serviços já existem, públicos e com uma imagem de exemplo do Google, criados por `scripts/gcp/harden-deploy-identities.sh` (cada conta de deploy só tem papel no próprio serviço, e um papel não se dá num serviço que ainda não existe). O primeiro deploy troca a imagem pela da API. Se o `/health` responder 403, confira em Cloud Run → serviço → Segurança se "Permitir acesso público" está marcado e use "Re-run failed jobs".

## Voltar para a revisão anterior

Quando a revisão nova sobe mas se comporta mal:

1. Console → Cloud Run → serviço → aba **Revisões** → "Gerenciar tráfego" → 100% na revisão anterior → Salvar. Ou, no Cloud Shell: `gcloud run services update-traffic <serviço> --region=us-east4 --to-revisions=<revisão>=100`.
2. A revisão anterior sobe com o esquema já migrado. Por isso as migrações precisam ser compatíveis com ela.
3. Corrigir num PR novo. O próximo deploy volta a mandar 100% para a revisão mais nova (`latestRevision` no `service.yaml`).

Desfazer uma migração não é automático: com dado errado, use a restauração do Neon (abaixo).

## Roteiro depois de um deploy (casos 17 a 27 do plano da E5.1)

1. Neon: `SHOW server_version;` começa com `18.` nos dois projetos.
2. `GET https://<url>/health` responde 200; `http://` é redirecionado ou recusado.
3. Uma rota protegida sem token responde 401 com `ProblemDetails`; `/openapi/v1.json` responde 404 ou 401.
4. Com uma conta de teste, `POST /v1/me` responde 200 e a linha aparece **só** no banco do ambiente.
5. Logs Explorer (partida e requisições): procurar `Password`, `postgresql://` e `Bearer`; nenhum aparece.
6. Partida a frio: com zero instâncias e o Neon parado, medir a primeira requisição. Acima de 10 s, levar o número ao Gabriel (resposta 90).
7. No Cloud Shell, impersonando `sacou-api-test-run`, ler `sacou-database-url-prod` deve dar 403.
8. Uma branch descartável que tente `google-github-actions/auth` recebe recusa do STS.
9. Faturamento → Relatórios: US$ 0,00 no fim do primeiro dia; teto e alerta ativos; Artifact Registry abaixo de 0,5 GB.
10. Neon depois de 15 min sem uso: a compute aparece como **Suspended**. Se não aparecer, a conexão ociosa a mantém acordada (ADR 0068, D6).

Resultados no PR da tarefa ou no diário da sessão.

## Custo

Esperado: US$ 0 (faixa grátis do Cloud Run na `us-east4`, 0,5 GB do Artifact Registry, Secret Manager e Logging dentro do grátis; Neon Free, 100 CU-hora por projeto e por mês). Onde olhar:

- Google Cloud → Faturamento → Relatórios (filtro do projeto `sacou-api`). O teto de gasto do Cloud Run **pausa os serviços** quando atingido; o alerta avisa em 50, 90 e 100%.
- **Como estão configurados (18/11/2026, pelo console, na conta de faturamento "Pagamento Firebase", em reais):**
  - `sacou-api-cloud-run-cap`: orçamento do tipo **"Aplicação do limite de gastos"** (*spend cap enforcement*), projeto `sacou-api`, serviço **Cloud Run**, R$ 5 por mês (cerca de US$ 1, resposta 94), avisos em 50, 80 e 100%. Na lista de "Orçamentos e limites" aparece com o status **Configurado**. Quando atingido, pausa os dois serviços (teste e produção, no mesmo projeto: abuso no teste também pausa a produção, achado M4-M1 da revisão do M4) até o mês seguinte ou até o teto subir; os gastos máximos voltam no início de cada mês. A cobrança chega com algumas horas de atraso, então o gasto pode passar um pouco do valor.
  - `sacou-api`: orçamento **só de alerta**, projeto `sacou-api`, todos os serviços, R$ 5 por mês, e-mail em 50, 90 e 100%.
  - Conferir no roteiro (passo 9): Faturamento → Orçamentos e limites, as duas linhas acima, a do teto com "Configurado".
- Neon → projeto → Billing / Usage: horas de compute. Se acabarem, a compute fica suspensa até o mês seguinte.

## Backup

Até a E5.3, só a restauração do Neon Free (6 h de histórico): Neon → projeto → Restore. A produção só recebe jogadores reais depois da E5.3 (condição 2 da revisão do M3).
