# Modo quadra: log local e controlador

Regras do modo quadra no app (E4.9). A parte 1 (log local e controlador, sem tela) está feita; as decisões de tela, trava, vibração e tela ligada entram com as partes 2 e 3. Decisão técnica no [ADR 0038](../arquitetura/adr/0038-log-local-da-quadra.md). Código em `apps/mobile/src/features/court/`.

## O estado é o log

O estado da partida é **sempre** o replay do log de eventos persistido no SQLite do aparelho (`frontend.md`, regra 1). Ninguém guarda uma cópia do placar. O controlador expõe `events`, exatamente o que está gravado, e quem precisa do estado chama o `CourtReplayer` (cache por array, sem cópia do estado).

## Comandos

| Comando | Faz | Recusas do motor |
|---|---|---|
| `start-match` | `startMatch` | `match-already-open`, `too-many-matches`, versão de regras ou formações não suportada |
| `score-point { team }` | `scorePoint` | `set-decided`, `no-open-match`, `no-open-set` |
| `undo` | `undoLastAction` (um `RevertedTo`) | `nothing-to-undo`, `no-open-match` |
| `confirm-set-end { firstServer? }` | `confirmSetEnd`; `firstServer` só no sorteio do set decisivo (E4.10) | `set-not-decided`, `no-open-match` |

- **Um comando por vez**, na ordem enviada. O estado usado é o do momento da execução, nunca o de quando o toque foi feito.
- **Simular antes de gravar:** o log com os eventos novos precisa fazer replay; senão o resultado é `rejected` e nada é gravado.
- **Atômico:** os eventos de um comando vão numa transação. O fim do set decisivo grava `SetEnded` e `MatchEnded` juntos (`placar.md`).
- **Snapshot só depois do commit.** Se a gravação falha, o resultado é `write-failed`, e o controlador **recarrega o log do arquivo dentro da fila**, porque a falha pode ter vindo depois do COMMIT. Dois desfechos: o snapshot ganha o evento que já estava gravado (ou continua igual, se nada foi gravado) e o próximo comando funciona; ou, se a recarga também falha, o snapshot vira `failed` (hoje permanente até reabrir o app; o `retry()` é da parte 2).
- **Fim de set é sempre confirmado:** `confirm-set-end` é um comando do usuário; desfazer logo depois reabre o set (`undo` aponta para o evento anterior ao `SetEnded`).

## Começar uma partida

`startCourtMatch(deps, MatchStartedPayload)` é a única porta pública: abre a `CourtSession` se não existe, roda `startMatch`, grava o `MatchStarted` e devolve `{ route: "/court/<id>" }`. O pré-jogo (E4.7) a chama em "Começar". Na E4.9 quem a chama é a tela de desenvolvimento, com os times de exemplo das telas (`dev/sample-match.data.ts`: só IDs, os nomes ficam num `CourtRoster` à parte, nunca no SQLite).

## Falhas ao abrir

| Situação | Estado do controlador |
|---|---|
| Sessão que não existe | `failed` · `session-not-found` |
| Linha que o parser recusa (payload que não é JSON, `type` vazio, UUID inválido) | `failed` · `corrupted-log` |
| `sequence` de um aparelho fora de 1..n, na ordem das posições | `failed` · `corrupted-log` |
| Linhas válidas, mas o log não faz replay (inclusive payload com campo a mais) | `failed` · `replay-failed` |
| Erro do banco | `failed` · `storage-failed` |

Nada é apagado e nenhum valor do log aparece no erro. A tela de erro ("Não conseguimos abrir esta partida") é da parte 2.

## Pendente (partes 2 e 3)

Trava e menu, bloqueio de 700 ms após o ponto, toque com a palma, toast, tela ligada, vibração, set point no tema Sol, bolinhas de sets, "venceu N seguidas", fila e retomada ao reabrir. As decisões estão no plano `docs/estado/tarefas/E4.9.md` (seção 2) e entram aqui com cada parte.
