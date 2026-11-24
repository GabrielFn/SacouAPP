# ADR 0082 · Backup diário do banco no Cloud Storage

**Status:** aceito (24/11/2026), E5.3 Parte 1. **Decidido por:** desenvolvedor, dentro da arquitetura aprovada, com o plano do analista ([plano](../../estado/tarefas/E5.3.md)) e o padrão adotado nas perguntas 193 a 195. Troca o Cloudflare R2 de `decisoes.md` **só para os backups**; o R2 continua previsto para as fotos, depois do piloto.

## Contexto

O Neon Free guarda 6 h de histórico (restauração instantânea) e um snapshot manual, sem backup agendado. Um erro descoberto no dia seguinte não tem volta. O aceite da E5.3 pede backup diário e restauração testada; o teto do projeto é R$ 0 de gasto novo (teto do Cloud Run de R$ 5, ADR 0068).

## Decisões

**D1 · Onde roda e onde fica (pergunta 193).** Um **Cloud Run Job** por ambiente (`sacou-backup-test` e `sacou-backup`, `us-east4`) grava num **bucket do Cloud Storage** do projeto `sacou-api` por ambiente (`sacou-api-backups-test` e `sacou-api-backups-prod`, `us-east1`, a região da faixa grátis de 5 GB-mês). A URL do banco fica no Secret Manager e entra no job por `secretKeyRef`, como na API: nenhum segredo nem acesso ao banco sai do Google. Descartados: workflow agendado do GitHub (o provedor de federação passaria a aceitar outro workflow com acesso à URL de produção; cron atrasa e é desligado em repositório parado), R2 (conta nova, cartão e chave S3 de vida longa guardada em algum lugar) e Neon pago (gasto mensal e cópia no mesmo provedor).

**D2 · O agendamento cabe na faixa grátis.** O Cloud Scheduler dá 3 jobs grátis por conta de faturamento, e as notificações já usam 2 (as varreduras diárias, ADR 0069). Em vez de dois agendamentos (um quarto job, US$ 0,10 por mês), **um** agendamento (`sacou-backups-daily`, 04:00 de Brasília) chama um **Workflow** (`sacou-backups`, `deploy/backup/workflow.yaml`) que inicia os dois jobs, cada um mesmo que o outro falhe ao iniciar, sem esperar o fim (sem passos de espera; 2 chamadas por dia ficam muito abaixo dos 5 mil passos grátis do Workflows). O resultado de cada job vai para o alerta (D7).

**D3 · Formato e consistência.** `pg_dump --format=custom --no-owner --no-privileges` com o cliente 18, na imagem `postgres:18.6-alpine` fixada por digest, do Docker Hub (fica fora do Artifact Registry, perto do limite de 0,5 GB; a Alpine traz as CAs do sistema, que a imagem Debian não traz). Uma transação `REPEATABLE READ, READ ONLY` exporta o snapshot: o dump (`--snapshot`) e as contagens do manifesto veem as mesmas linhas, mesmo com a API escrevendo. Ao lado de cada `sacou-<AAAAMMDD>T<HHMM>Z.dump`, um `.manifest.json` com tamanho, SHA-256, a última migração de cada módulo (`__ef_migrations_history` de cada esquema) e as linhas de cada tabela: só nomes e números, nenhum dado pessoal. O dump é feito em `/tmp` (memória do contêiner) e só depois copiado para o bucket, o manifesto por último: um dump sem manifesto não é backup. Cópia, nunca `mv`: no volume do bucket, renomear é apagar, e a retenção recusa.

**D4 · Um script só.** `scripts/backup/backup.sh` (POSIX `sh`) tem os comandos `dump` (o job) e `restore-check` (a CI e o ensaio). O `restore-check` confere o SHA-256, recusa destino com tabelas (nunca restaura por cima), roda `pg_restore --no-owner --no-privileges --exit-on-error --single-transaction` e compara migrações e contagens com o manifesto, linha a linha. O `job.yaml` não leva cópia do script: `scripts/gcp/setup-backups.sh` o embute a partir do arquivo, e o `test:tooling` confere que o texto embutido é igual ao arquivo.

**D5 · TLS e segredo.** Fora de `localhost` e `127.0.0.1`, o script troca qualquer `sslmode` e `sslrootcert` da URL por `sslmode=verify-full&sslrootcert=system`. A URL só vive em variável de ambiente e nos argumentos das ferramentas dentro do contêiner; nunca numa linha de log (o script tira das mensagens de erro qualquer linha com a senha) nem no manifesto. `set -eu`, nunca `set -x`.

**D6 · Credencial (pergunta 194).** Papel `sacou_backup` só de leitura (`pg_read_all_data`) em cada projeto do Neon, com os segredos `sacou-backup-database-url-test` e `sacou-backup-database-url-prod`, criados pelo Gabriel. Um job comprometido não escreve no banco. Se o Neon não deixar conceder `pg_read_all_data`, o fallback é a URL do papel dono, com o risco registrado aqui.

**D7 · Contas e papéis.** `sacou-backup-test-run` e `sacou-backup-run` executam os jobs: `secretAccessor` só no próprio segredo e `storage.objectUser` só no próprio bucket. O plano pedia `objectCreator`, com `objectUser` de fallback (R1); fica direto o `objectUser`, porque o volume do Cloud Storage (FUSE) lista e lê o que grava, e o job que já lê o banco inteiro não ganha nada lendo o backup; a retenção o impede de apagar ou trocar. `sacou-backup-trigger` só inicia: `run.invoker` nos dois jobs e `workflows.invoker` no projeto (o Workflows não tem papel por workflow; é o único do projeto). Nenhuma conta de deploy, build ou da API recebe papel nesses recursos (`test:tooling`). Alerta por e-mail (Cloud Monitoring, grátis) quando uma execução de job ou do workflow falha; o e-mail é dado ao rodar o script (`SACOU_ALERT_EMAIL`), nunca no repositório.

**D8 · Retenção (pergunta 195).** 30 dias, igual aos logs. Política de retenção do bucket de 30 dias (ninguém apaga nem troca antes, nem uma conta comprometida; sem trava, porque travar é irreversível) e regra de ciclo de vida que apaga com 31. Sem versionamento e **sem exclusão reversível** (soft delete 0): apagado com 31 dias, sumiu, o que importa para a LGPD. A E6.2 revê com a pergunta 2.

**D9 · Criptografia.** A padrão do Google no bucket. Sem cifra própria no piloto: guardar e girar uma chave privada é risco maior que o ganho, com acesso uniforme, prevenção de acesso público e só duas contas com leitura.

**D10 · Contas excluídas depois do dump (R4).** Restaurar ressuscita quem se excluiu depois do horário do dump. A exclusão já deixa a marca `identity.deleted_accounts` (SHA-256 do UID e `deleted_at`, ADR 0056, D5), então o banco atual diz quem se excluiu e quando, sem log com ID: a E3.16 proíbe ID no log (D11), e a 1.7 do plano não acrescenta linha nenhuma. O roteiro de restauração copia as marcas mais novas que o dump para o banco restaurado e apaga essas contas antes de devolver o banco à API ([`backup.md`](../../operacao/backup.md)).

## O que fica com quem

- **Até 6 h:** a restauração do Neon (Restore), mais rápida e sem perda além do instante escolhido.
- **De 6 h a 30 dias:** o dump diário, perdendo o que entrou depois das 04:00 do dia escolhido.

## Consequências

- Custo esperado R$ 0: um dump de poucos MB por dia acorda o Neon por cerca de um minuto (menos de 1 CU-hora por mês de 100); 2 × 30 dumps de poucos MB no Cloud Storage; 3 jobs do Scheduler; poucos passos do Workflows; o job dentro do teto do Cloud Run (R6: abuso que pause a API pausa o backup do mês).
- A CI prova a ida e volta (`BackupRoundTripTests`, integração): migrações reais, dados de um grupo com rodada e partida, dump e restore no Postgres 18 descartável, contagens iguais, sem dado pessoal nem senha na saída, e os casos de recusa (SHA-256, destino com tabelas, contagem diferente, TLS forçado, ambiente desconhecido, falha no meio sem arquivo com nome de backup).
- O ensaio no ambiente fica com o Gabriel ([`backup.md`](../../operacao/backup.md)), mensal, com o tempo anotado no diário.
- Riscos abertos: a cota anônima do Docker Hub pode falhar o job (R3: tenta de novo uma vez; se repetir, espelhar a imagem no Artifact Registry); o `pg_read_all_data` no Neon e o volume do Cloud Storage com `objectUser` só se confirmam na primeira execução (passo 4 do roteiro).

## Pendências do SEC-M1 (fechadas nesta parte)

No `test:tooling` (`scripts/lib/supply-chain-guards.mjs` e testes com o desvio plantado): um `packages.lock.json` por `.csproj`; todo `NuGetAuditSuppress` com entrada viva em `nuget-audit-exceptions.json` (um aviso suprimido some do relatório do `dotnet list --vulnerable`, então a validade é conferida aqui ou em lugar nenhum); `allowBuilds` só com `false` e nenhuma chave que desligue a revisão dos scripts de instalação, no `pnpm-workspace.yaml` ou no `.npmrc` (na prática, o `pnpm install --frozen-lockfile` do pnpm 12 já falha com script não listado: é o `strictDepBuilds` padrão). Em `dotnet-audit.mjs`, validade de no máximo 90 dias (`MAX_EXCEPTION_DAYS`) e data impossível recusada (já era, agora com teste). Em `npm-audit-policy.mjs`, um CVE fora de `audit.ignore` reprova como um GHSA (`auditConfig.ignoreCves` não tem par na lista de exceções; se o pnpm 12 ainda o respeita não foi medido, e passa a não importar).
