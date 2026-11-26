# Backup e restauração do banco

Decisões: [ADR 0082](../arquitetura/adr/0082-backup-diario-do-banco.md). Script: [`scripts/backup/backup.sh`](../../scripts/backup/backup.sh) (`dump` e `restore-check`). Configuração: [`scripts/gcp/setup-backups.sh`](../../scripts/gcp/setup-backups.sh).

## Como funciona

| | Teste | Produção |
|---|---|---|
| Job do Cloud Run (`us-east4`) | `sacou-backup-test` | `sacou-backup` |
| Conta de execução | `sacou-backup-test-run` | `sacou-backup-run` |
| Segredo (URL do papel `sacou_backup`, só leitura) | `sacou-backup-database-url-test` | `sacou-backup-database-url-prod` |
| Bucket (`us-east1`, 30 dias) | `sacou-api-backups-test` | `sacou-api-backups-prod` |

Todo dia às 04:00 de Brasília, o agendamento `sacou-backups-daily` chama o workflow `sacou-backups`, que inicia os dois jobs (conta `sacou-backup-trigger`). Cada job grava `sacou-<AAAAMMDD>T<HHMM>Z.dump` e, por último, `sacou-<...>.manifest.json` (tamanho, SHA-256, última migração de cada módulo e linhas de cada tabela; nenhum dado pessoal). **Um dump sem manifesto não é backup** (a execução falhou no meio). Nada se apaga antes de 30 dias (retenção do bucket); com 31, o ciclo de vida apaga, sem lixeira. Um job sem execução bem-sucedida em 26 h manda e-mail (alerta "Sacou backup missing", uma condição de ausência: cobre agendamento que não chama, workflow que falha e job que falha). O alerta só vale para o job depois da primeira execução bem-sucedida (passo 4).

Até 6 h atrás, a restauração do Neon (Neon → projeto → Restore) é mais rápida e perde menos: use primeiro. De 6 h a 30 dias, o dump.

## Configuração (Gabriel, Cloud Shell, cerca de 15 min, uma vez)

1. **Neon, em cada projeto (`sacou-test` e `sacou-prod`):** Roles → New role → `sacou_backup` (o console gera a senha; não digite uma). No SQL Editor, banco `sacou`:
   ```sql
   GRANT pg_read_all_data TO sacou_backup;
   SELECT pg_has_role('sacou_backup', 'pg_read_all_data', 'member');  -- deve dar true
   ```
   Se o `GRANT` for recusado, **pare e avise** (ADR 0082, D6: o fallback é a URL do papel dono, decisão sua). Depois, Connect → papel `sacou_backup`, banco `sacou`, conexão **direta** (sem pooler) → copie a URL.
2. **Segredos** (o valor nunca vai ao chat, ao histórico do terminal nem a arquivo): para cada um, rode, cole a URL, Enter e Ctrl-D.
   ```sh
   gcloud secrets create sacou-backup-database-url-test --replication-policy=user-managed --locations=us-east4 --data-file=-
   gcloud secrets create sacou-backup-database-url-prod --replication-policy=user-managed --locations=us-east4 --data-file=-
   ```
3. **Antes do script, confira o custo do alerta:** na página de preços do Google Cloud Observability (Cloud Monitoring → alerting), veja se uma condição de alerta é cobrada. A política tem **uma** condição (ADR 0082, D7). Se houver cobrança, pare e avise (é gasto novo); para seguir sem alerta, rode o script sem `SACOU_ALERT_EMAIL` (ele pula o alerta) e confira os backups no ensaio mensal.

   **Script**, na raiz do repositório atualizado (`git pull`; o Cloud Shell já tem `jq`):
   ```sh
   read -r SACOU_ALERT_EMAIL && export SACOU_ALERT_EMAIL   # digite o e-mail do alerta e Enter
   bash scripts/gcp/setup-backups.sh
   ```
   O Google manda um e-mail de confirmação do canal de alerta; confirme.
4. **Primeira execução:** Cloud Run → Jobs → `sacou-backup-test` → Executar. Em cerca de 1 min, a execução fica verde e o bucket `sacou-api-backups-test` mostra o `.dump` e o `.manifest.json`. Os logs da execução mostram só nomes, bytes e segundos. Se falhar com permissão no volume ou no banco, mande só a mensagem do log (ela não tem senha). Repita com `sacou-backup` quando a produção tiver o segredo.
5. **Isolamento** (caso 10 do plano), com a mesma impersonação do passo 7 de [`deploy.md`](deploy.md):
   ```sh
   gcloud secrets versions access latest --secret=sacou-backup-database-url-prod --impersonate-service-account=sacou-backup-test-run@sacou-api.iam.gserviceaccount.com   # 403
   echo x | gcloud storage cp - gs://sacou-api-backups-prod/x --impersonate-service-account=sacou-backup-test-run@sacou-api.iam.gserviceaccount.com   # 403
   gcloud storage rm gs://sacou-api-backups-test/<o .dump de hoje>   # recusado pela retenção
   ```
6. **Faturamento:** Cloud Scheduler com 3 jobs na conta "Pagamento Firebase" (as duas varreduras das notificações e `sacou-backups-daily`). Um quarto job custaria US$ 0,10 por mês.

Resultados no diário da sessão.

## Ensaio de restauração (Gabriel, cerca de 15 min, todo mês e depois da configuração)

O dado de produção não sai do Google nem do Neon: tudo no Cloud Shell, num banco descartável do **mesmo** projeto do Neon.

1. Cloud Shell, na raiz do repositório:
   ```sh
   bucket=sacou-api-backups-test   # ou sacou-api-backups-prod
   gcloud storage ls "gs://$bucket/" | tail -n 2
   gcloud storage cp "gs://$bucket/<nome>.dump" "gs://$bucket/<nome>.manifest.json" /tmp/
   ```
2. Neon, mesmo projeto: Databases → New database → `sacou_restore` (dono: o papel da API). Copie a URL direta desse banco.
3. Comece a cronometrar e rode (cole a URL do `sacou_restore` no `read`; ela não aparece nem fica no histórico):
   ```sh
   read -rs SACOU_RESTORE_DATABASE_URL && export SACOU_RESTORE_DATABASE_URL
   docker run --rm -e SACOU_RESTORE_DATABASE_URL -v "$PWD/scripts/backup:/scripts:ro" -v /tmp:/work:ro \
     postgres:18.6-alpine@sha256:9ba53c7d41ea093baf5c1ba635ba5434c4f979880527d49bb7d9237d3193085b \
     sh /scripts/backup.sh restore-check /work/<nome>.dump /work/<nome>.manifest.json
   ```
   Esperado: `restore-check: ok, N tables match the manifest, X s`. Qualquer outra saída é falha do backup: avise.
4. A API lê o banco restaurado **sem migrar** (prova que o esquema do dump bate com o código atual; com migração, ela consertaria o esquema e esconderia a diferença). O `/health` só diz que a API subiu; a página pública de uma rodada com um código que não existe lê a tabela de rodadas e deve dar **404** (um 500 é esquema diferente: avise):
   ```sh
   docker build --tag sacou-api:restore .
   SACOU_DATABASE_URL="$SACOU_RESTORE_DATABASE_URL" docker run --rm -d --name sacou-restore -p 127.0.0.1:8080:8080 \
     -e SACOU_DATABASE_URL -e Database__MigrateOnStartup=false -e RoundPage__PublicBaseUrl=https://sacou.test sacou-api:restore
   curl -s --retry 10 --retry-delay 2 --retry-all-errors http://127.0.0.1:8080/health
   curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/r/AAAAAAAAAAAAAAAAAAAAAA   # 404
   docker rm -f sacou-restore
   ```
5. **Reexclusão** ([ADR 0087](../arquitetura/adr/0087-comando-de-reexclusao-depois-de-restaurar.md)): o comando `reapply-deletions` apaga do banco restaurado quem se excluiu depois do dump, lendo as marcas de `identity.deleted_accounts` do banco **atual** com o papel `sacou_backup` (só leitura), e aplica antes as migrações do código atual. A URL de origem sai do segredo direto para a variável, sem aparecer na tela nem no histórico; a data do dump sai do `createdAt` do manifesto, nunca digitada:
   ```sh
   amb=test   # ou prod, o mesmo do bucket
   read -rs SACOU_DELETIONS_SOURCE_DATABASE_URL < <(gcloud secrets versions access latest --secret="sacou-backup-database-url-$amb"; echo)
   export SACOU_DELETIONS_SOURCE_DATABASE_URL
   created="$(jq -er .createdAt /tmp/<nome>.manifest.json)"
   SACOU_DATABASE_URL="$SACOU_RESTORE_DATABASE_URL" docker run --rm -e SACOU_DATABASE_URL -e SACOU_DELETIONS_SOURCE_DATABASE_URL \
     -e RoundPage__PublicBaseUrl=https://sacou.test sacou-api:restore reapply-deletions --dump-created-at "$created"; echo "exit $?"
   ```
   Esperado: `reapply-deletions: ok, M marks, N new marks, A accounts erased, G groups left without admin, X s` e `exit 0`. No ensaio, `A` é quem se excluiu desde o dump (pode ser 0). Anote a linha no diário. Os outros códigos, sempre com uma linha só, sem URL nem senha:

   | Saída | O que é | O que fazer |
   |---|---|---|
   | 2 (`usage: ...`) | Uso errado, dito no fim da linha: variável faltando ou vazia (segredo vazio ou falha do `gcloud`), `--dump-created-at` inválido ou no futuro, destino sem o esquema `identity` (não é o banco restaurado), origem com papel que escreve (a URL da API no lugar da do `sacou_backup`), origem igual ao destino ou as duas URLs trocadas | Corrija o que a linha diz e rode de novo; nada foi escrito |
   | 3 (`source unreadable`) | A origem não abre: segredo errado, senha, rede, tabela | Confira o `amb` e o segredo (`gcloud secrets versions list sacou-backup-database-url-$amb`) e rode de novo |
   | 4 (`dump older than the mark retention (60 days)`) | O dump é mais velho que as marcas (60 dias); não acontece com o bucket de 30 dias | Manifesto errado: pare e chame o desenvolvedor |
   | 5 (`failed ...; run again`) | O banco falhou no meio | Rode de novo: cada passo é idempotente e retoma de onde parou. Se repetir, mande só a linha ao desenvolvedor |
   | Outro código (com pilha de erro) | Exceção não tratada: destino que não abre ou migração que falha | Pare, não copie a saída para lugar nenhum (pode trazer o host) e chame o desenvolvedor |

   **Conferência dos Admins** (risco aceito da pergunta 231, [`grupos.md`](../dominio/grupos.md)): quando a conta reexcluída era o único Admin ativo de um grupo, o comando promove o membro ativo mais antigo com conta **do banco restaurado**, que pode não ser quem o grupo tinha escolhido depois do dump. Compare os Admins dos dois bancos (só IDs):
   ```sh
   q="SELECT group_id, id FROM groups.members WHERE role = 'admin' AND status = 'active' ORDER BY 1, 2"
   pg=postgres:18.6-alpine@sha256:9ba53c7d41ea093baf5c1ba635ba5434c4f979880527d49bb7d9237d3193085b
   docker run --rm -e SACOU_RESTORE_DATABASE_URL -e q "$pg" sh -c 'psql "$SACOU_RESTORE_DATABASE_URL" -XAt -c "$q"' > /tmp/admins-restored.txt
   docker run --rm -e SACOU_DELETIONS_SOURCE_DATABASE_URL -e q "$pg" sh -c 'psql "$SACOU_DELETIONS_SOURCE_DATABASE_URL" -XAt -c "$q"' > /tmp/admins-current.txt
   diff /tmp/admins-current.txt /tmp/admins-restored.txt
   ```
   Uma linha `>` é um Admin do restaurado que o banco atual não tem (promovido pelo comando ou desfeito pelo dump). No ensaio, só anote quantas. Na restauração de verdade, avise o grupo: o Admin pode passar o papel pelo app. `G` maior que 0 é grupo sem ninguém com conta para promover; fica como está.
6. Pare o cronômetro e anote o tempo no diário. Limpe **sempre, também se algum passo falhou** (o dump tem dados pessoais): `unset SACOU_RESTORE_DATABASE_URL SACOU_DELETIONS_SOURCE_DATABASE_URL created q; rm -f /tmp/<nome>.* /tmp/admins-*.txt; docker rm -f sacou-restore`; no Neon, apague o `sacou_restore`.

## Restaurar de verdade

> **Liberado depois do primeiro ensaio com a reexclusão (LGPD, ADR 0082, D10):** até o passo 5 do ensaio sair com `exit 0` e a linha estar anotada no diário, nenhuma restauração real da produção nem piloto com jogadores reais.

1. **Erro de menos de 6 h:** Neon → Restore, no instante antes do erro. Fim. A reexclusão **não** roda aqui (resposta 230): quem se excluiu entre esse instante e agora volta; risco aceito no piloto, pelo tamanho da janela.
2. Escolha o último dump **antes** do erro (o horário está no nome, em UTC). Faça os passos 1 a 4 do ensaio num banco novo `sacou_restored` do projeto do ambiente.
3. **Contas excluídas depois do dump** (LGPD, ADR 0082, D10): rode o passo 5 do ensaio (reexclusão e conferência dos Admins) contra o `sacou_restored`, com o `amb` do ambiente. Siga só com `exit 0`. Se passar mais de alguns minutos até o passo 4, rode a reexclusão de novo logo antes (pega quem se excluiu nesse meio-tempo; uma exclusão entre a última execução e a troca fica de fora, risco aceito). Se o banco atual se perdeu, a origem é o dump mais novo restaurado num banco descartável (pergunta 229): leia a URL do `sacou_backup` nesse banco com `read -rs SACOU_DELETIONS_SOURCE_DATABASE_URL` no lugar da linha do segredo.
4. Troque o banco do serviço: nova versão de `sacou-database-url-<env>` com a URL do papel da API no `sacou_restored` (mesmo `--data-file=-` da configuração, `gcloud secrets versions add`), e uma revisão nova para ler a versão: `gcloud run services update <serviço> --region=us-east4 --update-labels=restored=<AAAAMMDD>`. Confira o `/health` e o roteiro de [`deploy.md`](deploy.md).
5. Troque o banco do **backup** também, senão o job de amanhã copia o banco antigo: o papel `sacou_backup` é do projeto do Neon e já lê o `sacou_restored`; copie a URL direta dele nesse banco (Connect → papel `sacou_backup`, banco `sacou_restored`) e crie uma versão nova do segredo `sacou-backup-database-url-<env>` (`test` ou `prod`) com a URL dele (`gcloud secrets versions add sacou-backup-database-url-<env> --data-file=-`, cole, Enter e Ctrl-D). O job lê `latest` a cada execução. Rode o job à mão (Cloud Run → Jobs → `sacou-backup-test` ou `sacou-backup` → Executar) e confira o `.dump` e o `.manifest.json` novos no bucket, com as contagens do banco restaurado.
6. Avise os grupos do que se perdeu entre o horário do dump e o erro (rodadas, presenças, placares).
7. Limpe o Cloud Shell como no passo 6 do ensaio (sem apagar o `sacou_restored`, que agora é o banco do serviço). Guarde o banco antigo até entender o erro; depois, apague-o.
