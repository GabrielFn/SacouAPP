# ADR 0087 · Comando de operação `reapply-deletions`: reexcluir depois de restaurar um backup

**Status:** aceito (26/11/2026), E6.3 S1 a S3. **Decidido por:** Gabriel, ao aprovar o plano (respostas 228: 1, 229: 1, 230: não, 231: promover o membro ativo mais antigo) ([plano](../../../.specs/features/E6.3/plan.md)), e o desenvolvedor dentro dele.

## Contexto

Restaurar um dump (até 30 dias) ou um ponto do Neon (até 6 h) traz de volta, completas, as contas de quem se excluiu depois daquele instante, e a marca `identity.deleted_accounts` do banco restaurado também volta ao passado. A exclusão só rodava pelo `DELETE /v1/me` da própria pessoa, que já não tem conta no Firebase. O ADR 0082, D10, bloqueava a restauração real da produção e o piloto com jogadores reais até existir um comando de reexclusão.

## Decisão

- **Porta 1 · Modo de comando no binário da API.** `Program.cs`, depois de `builder.Build()`: `OperationCommands.TryMatch(args)` desvia para o comando, sem Kestrel, rota nem middleware; o Cloud Run nunca passa argumento. O comando descarta o app antes de sair (o logger e o Sentry esvaziam) e recebe um token cancelado pelo Ctrl+C. Roda no Cloud Shell pela imagem `sacou-api:restore` do ensaio ([`backup.md`](../../operacao/backup.md)). Próximos comandos de operação seguem o mesmo `OperationCommands`.
- **Porta 2 · A lista que vale é a do banco atual.** `SACOU_DELETIONS_SOURCE_DATABASE_URL` aponta para o banco atual pelo papel `sacou_backup` (só leitura); todas as marcas são copiadas para o destino (`INSERT ... ON CONFLICT DO NOTHING`), não só as mais novas que o dump. Se o banco atual se perdeu, a origem é o dump mais novo restaurado num banco descartável (pergunta 229). `SACOU_DATABASE_URL` é o banco restaurado; o comando aplica nele as migrações pendentes antes de ler as contas.
- **Porta 3 · Busca pelo hash no banco.** `sha256(convert_to(firebase_uid, 'UTF8')) = ANY(@hashes)`, com teste golden contra `SubjectHash.Of`; nenhum UID vai para a memória do processo.
- **Exclusão:** para cada conta achada, em ordem de `id`, as `IAccountErasure` em `ErasureMode.AfterRestore` e depois `DELETE FROM identity.users` (o mesmo passo do ADR 0056, D7).
- **AD-004 · Guarda de idade do dump** (`--dump-created-at`, o `createdAt` do manifesto, com fuso) duas vezes: no comando, antes das migrações e de qualquer conexão, e no handler, antes de ler a origem. Ambas usam `DeletionMarkRetention.Covers` (60 dias, a mesma constante da limpeza da E6.5, ADR 0086). Data no futuro é erro de uso.
- **AD-005 · `ErasureMode.AfterRestore`:** apaga como o `Sweep` (sem conferir bloqueios) e, quando o grupo perde o último Admin ativo, promove o membro ativo mais antigo com conta (menor `joined_at`, depois menor `MemberId`); sem ninguém com conta, o grupo conta em `groups left without admin` (pergunta 231, [`grupos.md`](../../dominio/grupos.md)). Um modo, não um método novo: o Groups mantém um único caminho de apagar, e o `DELETE /v1/me` não muda.
- **AD-006 · Guardas, na ordem:** (a) antes de conectar, origem e destino com o mesmo host (sem caixa), porta e banco → 2, e depois de conectar, pela identidade que o servidor dá de cada banco; (b) destino sem o esquema `identity` → 2, nada criado; (c) origem cujo papel pode escrever em `identity.users` ou `identity.deleted_accounts` → 2, leitura numa transação `READ ONLY`, e falha de leitura → 3 (`source unreadable`, sem a mensagem do driver); (d) URLs trocadas: o destino tem uma marca mais nova que a retenção que a origem não tem → 2 (as marcas só crescem; contar daria falso positivo depois da limpeza da E6.5); (e) falha do banco numa exclusão para o laço → 5 (`run again`; cada passo é idempotente).
- **Saída:** uma linha só, com números e códigos, nunca URL, host, senha, UID ou hash: `reapply-deletions: ok, <marcas> marks, <novas> new marks, <contas> accounts erased, <grupos> groups left without admin, <s> s`. Códigos: 0 ok, 2 uso, 3 origem ilegível, 4 dump mais velho que a retenção, 5 falha a repetir.
- **Roteiro (S3):** as duas URLs entram com `read -rs` (a de origem direto do segredo `sacou-backup-database-url-<env>`), nunca na linha de comando nem no histórico; `--dump-created-at` sai do manifesto com `jq`, nunca digitado. O comando roda no ensaio mensal e no passo 3 de "Restaurar de verdade", seguido da conferência dos Admins (risco da 231). **Não** roda no Restore do Neon (resposta 230).

## Consequências

- O bloqueio do ADR 0082, D10, cai depois do primeiro ensaio com o comando (saída 0, anotada no diário).
- **Riscos aceitos no piloto:** quem se excluiu nas horas entre o instante do Restore do Neon e a restauração volta (230); o herdeiro do Admin é o mais antigo no banco restaurado, não necessariamente quem o grupo escolheu depois do dump (231; o Admin novo passa o papel); uma exclusão entre a última execução do comando e a troca do banco do serviço fica de fora; a troca das URLs não é detectada quando o restaurado não tem marca recente diferente da origem, e então reaplicar é benigno.
- A credencial de origem fica no ambiente do shell do Cloud Shell durante o roteiro ([`modelo-de-ameacas.md`](../../seguranca/modelo-de-ameacas.md)).

## Alternativas rejeitadas

- **Rota no painel do operador (E7.2):** o banco restaurado ainda não está atrás da API quando o comando precisa rodar, e a rota exporia uma escrita em massa na internet.
- **Script SQL no `backup.sh`:** duplica a exclusão de dois módulos fora dos testes e diverge na primeira mudança.
- **Projeto de console novo (`Sacou.Ops`):** mais um projeto, imagem e registro dos módulos para o mesmo resultado.
- **Cópia própria das marcas fora do Neon:** infraestrutura e credencial novas, e o bucket apaga em 31 dias, menos que os 60 da marca.
