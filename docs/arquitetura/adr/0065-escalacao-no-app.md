# ADR 0065 · Escalação no app (tela 22)

**Status:** aceito (18/11/2026) para a Parte 1 da E4.8 (modelo, tela e pré-jogo). A Parte 2 (a 22 na partida, `change-lineup`) completa os itens 7 e 8. **Decidido por:** plano da E4.8 (`docs/estado/tarefas/E4.8.md`) e respostas 76 a 78 do Gabriel (17/11/2026). O plano chamava este ADR de 0062; o 0062 foi para o limite de requisições.

## Contexto

A tela 22 edita a escalação de um time: troca de dois jogadores, rotação, levantador, líbero. Ela abre de dois lugares: pela folha 08, antes da partida, e pelo menu 23, durante a partida. No pré-jogo, o arranjo do sorteio, com a **nota do admin**, vive só no reducer da 07 (ADR 0061). Na partida, o estado é o replay do log (ADR 0052). O motor já tem `changeLineup` com a alocação inteira (ADR 0027) e o líbero (ADR 0028).

## Decisão

1. **Uma tela, dois anfitriões (D1).** Fatia nova `src/features/lineup/`. `LineupScreen` recebe `LineupScreenProps` (a vista derivada e os callbacks) e não sabe quem a abriu. O anfitrião entrega uma `LineupSource` (times, base de cada um, fase, quem pode ser líbero, nomes e posições) e recebe as alocações salvas. No pré-jogo, a 22 é a terceira folha do `draw-flow.reducer.ts` (`sheet: "lineup"`), num `Modal` de tela cheia, montado só enquanto aberta, para os rascunhos sumirem ao fechar.
2. **Rascunho no reducer da fatia (D3).** `lineup-editor.reducer.ts` guarda a aba, a seleção e, por time, o rascunho com a chave da base de onde partiu. A base entra em cada ação, nunca copiada por efeito. Rascunho igual à base é apagado ("Salvar" desliga). Chave diferente (no pré-jogo, outro time ou sistema; na partida, outro número de eventos) faz a tela ignorar o rascunho e avisar "A partida mudou enquanto você editava."
3. **Funções puras sobre a alocação:** `swapInLineup`, `withSetterZone`, `reanchor`, `withLibero` (`lineup-moves.ts`) e `fixRoles` e `misplacedMembers` (`fix-roles.ts`). "Corrigir" reusa a regra da escalação padrão (`seatByPosition`, exportada de `default-lineup.ts`) nas cinco vagas depois do levantador. A posição de cada chip, o sacador e o slot do líbero vêm só de `getServeAlignment` do motor.
4. **"Fora de ordem" e "Tornar levantador" (resposta 77).** O aviso compara a posição principal com a função do índice e lista os nomes na ordem do diagrama (4, 3, 2, 5, 6, 1), que reproduz o "Lia e Ana" do canvas. "Tornar levantador" reancora sem mexer ninguém na quadra.
5. **Líbero do início no `MatchStarted` (resposta 76).** Um time sorteado tem 6, e o aplicador confere `lineup`, `bench` e `libero` contra `teams.<lado>.memberIds` congelados no `MatchStarted`, então o líbero não pode entrar depois por `LineupChanged`. A 22 do pré-jogo oferece as reservas da fila; a escolhida sai de `queue.players` e entra em `teams.<lado>` e em `rotations.<lado>.libero` com `[2, 5]`. O motor e o C# não mudaram: o payload já aceitava líbero.
6. **Escalação salva derivada.** `preGame.lineups.<lado>` guarda sistema, `lineup`, `setterZone` e líbero. `teamRotation` usa a salva só enquanto o time e o sistema são os mesmos, e o líbero só enquanto ainda é reserva livre (o time A vence se os dois escolherem a mesma). Trocar nomes na 07 ou o sistema na 08 traz a padrão de volta sem efeito de sincronização. A 08 diz "Laranja tem 6 e líbero Sofia.".
7. **Banco (D6).** A 22 só mostra o banco numa linha. Trocar com o banco é a 23a (E4.10).
8. **Orientação (resposta 78).** Retrato como o canvas; com a janela mais larga que alta (a quadra trava em paisagem, ADR 0052), duas colunas: meia quadra à esquerda, o resto à direita, tudo rolável.
9. **Nenhuma nota na 22.** A `LineupSource` do pré-jogo leva só IDs, nomes e posições; um teste varre a fonte, a vista e o `MatchStarted` com líbero.
10. **O que sai ou muda do canvas (D9):** o selo "Pro" (ADR 0046); a linha "Líbero" (nova, um `radiogroup` sempre aberto, no lugar de uma lista que abre); "Tornar levantador" (novo); "Partida N · antes de começar" no pré-jogo; a malha da rede é a `NetMesh` da quadra.

## Consequências

- `PENDING_PRE_GAME_SCREENS` ficou vazio.
- A 07 continua mostrando a líbero entre as reservas, porque trocá-la para um time ali é o jeito de desfazer a escolha. Só a 08 e o `MatchStarted` a tiram da fila.
- A Parte 2 acrescenta o comando `change-lineup`, a rota da partida e o líbero trocado com o banco (`withLibero(..., "bench")` já existe).
