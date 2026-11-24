# Backup e restauração do banco

Decisões: [ADR 0082](../arquitetura/adr/0082-backup-diario-do-banco.md). Script: [`scripts/backup/backup.sh`](../../scripts/backup/backup.sh) (`dump` e `restore-check`). Configuração: [`scripts/gcp/setup-backups.sh`](../../scripts/gcp/setup-backups.sh).

## Como funciona

| | Teste | Produção |
|---|---|---|
| Job do Cloud Run (`us-east4`) | `sacou-backup-test` | `sacou-backup` |
| Conta de execução | `sacou-backup-test-run` | `sacou-backup-run` |
| Segredo (URL do papel `sacou_backup`, só leitura) | `sacou-backup-database-url-test` | `sacou-backup-database-url-prod` |
| Bucket (`us-east1`, 30 dias) | `sacou-api-backups-test` | `sacou-api-backups-prod` |

Todo dia às 04:00 de Brasília, o agendamento `sacou-backups-daily` chama o workflow `sacou-backups`, que inicia os dois jobs (conta `sacou-backup-trigger`). Cada job grava `sacou-<AAAAMMDD>T<HHMM>Z.dump` e, por último, `sacou-<...>.manifest.json` (tamanho, SHA-256, última migração de cada módulo e linhas de cada tabela; nenhum dado pessoal). **Um dump sem manifesto não é backup** (a execução falhou no meio). Nada se apaga antes de 30 dias (retenção do bucket); com 31, o ciclo de vida apaga, sem lixeira. Falha de um job ou do workflow manda e-mail (alerta "Sacou backups failed").

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
3. **Script**, na raiz do repositório atualizado (`git pull`):
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
4. A API sobe no banco restaurado (o esquema bate com o código atual):
   ```sh
   docker build --tag sacou-api:restore .
   SACOU_DATABASE_URL="$SACOU_RESTORE_DATABASE_URL" docker run --rm -d --name sacou-restore -p 127.0.0.1:8080:8080 \
     -e SACOU_DATABASE_URL -e Database__MigrateOnStartup=true -e RoundPage__PublicBaseUrl=https://sacou.test sacou-api:restore
   curl --retry 10 --retry-delay 2 --retry-all-errors http://127.0.0.1:8080/health; docker rm -f sacou-restore
   ```
5. Pare o cronômetro e anote o tempo no diário. Limpe: `unset SACOU_RESTORE_DATABASE_URL; rm /tmp/<nome>.*`; no Neon, apague o `sacou_restore`.

## Restaurar de verdade

1. **Erro de menos de 6 h:** Neon → Restore, no instante antes do erro. Fim.
2. Escolha o último dump **antes** do erro (o horário está no nome, em UTC). Faça os passos 1 a 3 do ensaio num banco novo `sacou_restored` do projeto do ambiente.
3. **Contas excluídas depois do dump** (LGPD, ADR 0082, D10). No banco **atual**, quem se excluiu depois do horário do manifesto (`createdAt`):
   ```sql
   SELECT encode(subject_hash, 'hex'), deleted_at FROM identity.deleted_accounts WHERE deleted_at > '<createdAt>';
   ```
   Essas contas existem no banco restaurado e precisam ser apagadas de novo antes de o banco voltar à API. **Ainda não há comando para isso** (a exclusão só roda pelo `DELETE /v1/me` da própria pessoa): pendência registrada para antes do piloto com jogadores reais. Até lá, com alguma linha aqui, pare e chame o desenvolvedor.
4. Troque o banco do serviço: nova versão de `sacou-database-url-<env>` com a URL do papel da API no `sacou_restored` (mesmo `--data-file=-` da configuração, `gcloud secrets versions add`), e uma revisão nova para ler a versão: `gcloud run services update <serviço> --region=us-east4 --update-labels=restored=<AAAAMMDD>`. Confira o `/health` e o roteiro de [`deploy.md`](deploy.md).
5. Avise os grupos do que se perdeu entre o horário do dump e o erro (rodadas, presenças, placares).
6. Guarde o banco antigo até entender o erro; depois, apague-o.
