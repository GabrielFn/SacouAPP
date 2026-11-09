# ADR 0038 · Log local da quadra: SQLite, esquema, simular antes de gravar

Data: 08/11/2026 · Tarefa: E4.9 (parte 1) · Status: aceito

## Contexto

O modo quadra funciona em modo avião (`decisoes.md:26`; `frontend.md`, regra 1): o estado da partida é o replay do log de eventos, e o log persistido é a única fonte. A E4.9 cria o armazenamento local e o controlador que une o motor (`match-engine`) a ele, sem tela. A sincronização é da E4.11, e a simulação no servidor, da E3.7.

## Decisões

**SQLite no aparelho (`expo-sqlite`), atrás da porta `SqlDatabase`.** A fatia `features/court/` só conhece a interface (`exec`, `run`, `getAll`, `transaction`), sempre com parâmetros. O adaptador real (`src/adapters/expo-sqlite-database.ts`) é o único que importa o SDK. O `tsconfig.json` do app inclui os testes, com `types: ["node"]` (o `lint` com tipos precisa dele); o `tsconfig.app.json` exclui os testes e não carrega tipos do Node, e o `typecheck` roda os dois, então código de produção que use Node não compila. O ESLint também reprova imports `node:`, builtins e os globais `Buffer`, `setImmediate`, `__dirname`, `__filename` e `global` fora dos testes. A mesma porta tem uma implementação de teste sobre SQLite de verdade, o `node:sqlite` do Node 22 (`persistence/node-sqlite-database.test.fixture.ts`), sem dependência nova, e uma falha injetável para provar a atomicidade. Os testes rodam o SQL real (`STRICT`, `UNIQUE`, `FOREIGN KEY`), não um simulacro.

**Durabilidade e transação.** Ao abrir, na conexão principal: `synchronous = FULL` (o commit sobrevive também a desligar o celular, e não só a fechar o app) e `foreign_keys = ON`; `journal_mode = WAL` só depois de conferir que o `user_version` é um que este app conhece (o `PRAGMA` escreve no arquivo). A transação **não** usa `withExclusiveTransactionAsync` do `expo-sqlite` 58, porque ele abre uma conexão nova, sem esses `PRAGMA`s. O adaptador (`sqlite-connection-database.ts`) faz `BEGIN IMMEDIATE`, o trabalho e `COMMIT` (ou `ROLLBACK` no erro) na conexão principal, e uma fila serializa **todas** as chamadas, para nenhuma cair no meio de uma transação alheia. A fila e o `ROLLBACK` têm teste de unidade com uma conexão simulada. O custo do `fsync` por toque será medido no Hermes (parte 3), e a decisão por `NORMAL` só vem com o número.

**Esquema (migração 1, `PRAGMA user_version`).** `device` (uma linha, `device_id`), `court_sessions` (`status`, `batch`) e `court_events` (um envelope por linha, chave `(court_session_id, position)`, `event_id` único e `(court_session_id, batch, sequence, device_id)` único). Só IDs, números e o payload em JSON: nenhuma coluna guarda nome (teste sobre `pragma_table_info`). As migrações são uma lista ordenada aplicada numa transação; um banco com `user_version` maior que o conhecido (app rebaixado) dá `unsupported-database-version` sem tocar no arquivo. Mudança de esquema de evento exige `schemaVersion` nova e migração dos logs abertos.

**`deviceId`.** UUID aleatório gerado pelo `IdGenerator` na primeira abertura e gravado em `device`. Nunca IMEI, Android ID, `identifierForVendor` ou token de push. Real: `expo-crypto` (`randomUUID`); falso: sequencial.

**Simular antes de gravar.** O controlador executa o comando do motor sobre o estado do momento da execução (fila de escrita, um comando de cada vez), monta os envelopes pelo `parseEventEnvelope`, faz o `replayTimeline` do log com os eventos novos e **só então** grava, numa transação. Log que não faz replay não entra: ponto atrasado, `RevertedTo` inválido e `SetEnded` com `MatchEnded` duplicado são recusados no aparelho (`modelo-de-ameacas.md`, ADR 0023). `SetEnded` e `MatchEnded` do set decisivo vão na mesma transação. O snapshot só muda depois do commit: `events` é exatamente o que está no arquivo. Depois de um `write-failed` o controlador recarrega o log dentro da fila, porque a falha pode ter vindo depois do COMMIT.

**Registro único e cache do replay.** O controlador expõe `{ loading | ready { events } | failed { code } }` para `useSyncExternalStore`; o estado da partida é sempre o replay desses eventos. O `CourtReplayer` guarda o resultado num `WeakMap` pela identidade do array de eventos: é um valor derivado de um array imutável, não uma cópia do estado, e sai da memória junto com o array. A simulação do toque e a leitura da tela usam o mesmo array, então cada toque roda um replay.

**`sequence` e `batch`.** `sequence` é o maior do aparelho no stream mais 1, calculado pelo controlador a partir do log confirmado. O repositório **confere dentro da transação** que o lote continua o log (mesmo stream, `batch` e `deviceId`, sequências seguidas a partir da última do aparelho) e recusa com `sequence-conflict` se não, o que protege de um escritor atrasado. `batch` é 1 enquanto só este celular escreve; quem numera os lotes depois é a E3.7/E4.11 (`eventos.md`).

**Falha fechada.** Linha que não passa no `parseEventEnvelope` (payload que não é JSON, `type` vazio, UUID inválido) ou `sequence` de um aparelho que não seja 1..n faz o `load` devolver `corrupted-log`, sem estado parcial e sem ecoar o valor; log que lê mas não faz replay é `replay-failed`. Nada é apagado. Erros de armazenamento viram `storage-failed`, sem repassar a mensagem do banco.

**Sem criptografia do arquivo.** Só há IDs e números; os nomes vêm do cache do servidor (E4.2), nunca do SQLite.

**Sem rede na fatia.** O ESLint reprova `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` e `@tanstack/*` em `features/court/` (casos em `lint:regression`): é a prova estrutural do modo avião.

**`startCourtMatch(deps, MatchStartedPayload)`** é a porta pública para começar uma partida: abre a sessão se não existe, roda `startMatch`, grava o `MatchStarted` e devolve a rota da quadra. A tela de desenvolvimento a chama na E4.9, e o pré-jogo, na E4.7.

## `node:sqlite` nos testes

Funciona no Vitest do repositório (Node 22.20, aviso de módulo experimental no console). Não foi preciso `sql.js`. O `STRICT` exige SQLite 3.37 ou mais; conferir a versão embutida no `expo-sqlite` está registrado abaixo.

## Backup e `deviceId`

O backup automático do Android copiaria o `deviceId` para outro celular. A mitigação (`android.allowBackup: false`) entra com o `app.json` na parte 3; o caso do iPhone fica para a E4.11 e a E3.7 (o servidor pode detectar o mesmo `deviceId` em dois aparelhos pelo `sequence-conflict`).

## Pendente (partes seguintes)

Medição do replay e do `fsync` no Hermes, orçamento (toque no S3 com p95 ≤ 100 ms e reabrir no S4 em ≤ 1 s), tela ligada, vibração, trava, telas 09 e 10 e o `DatabaseGate`. Estado de envio (sincronização) é migração 2, da E4.11.

## Alternativas descartadas

- **AsyncStorage ou MMKV:** sem transação nem restrição `UNIQUE`; a atomicidade do `SetEnded` com o `MatchEnded` ficaria à mão.
- **Calcular a `sequence` só no banco:** o replay simulado precisa dela antes de gravar.
- **Guardar o estado (snapshot) no SQLite:** duplicaria a fonte; o log é a fonte (`frontend.md`, regra 1).
