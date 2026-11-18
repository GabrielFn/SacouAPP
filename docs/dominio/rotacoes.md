# Rotações do Sacou — especificação do motor (quadra 6x6)

Pesquisa de 30/10/2026. Dados das formações em [`packages/volley-rules/src/formations/formations.json`](../../packages/volley-rules/src/formations/formations.json); explorador visual em `rotacoes-explorador.html`.

## A regra mudou em 2025

Nas regras **FIVB 2025–2028**, só o time que **recebe** precisa respeitar a ordem de rotação na hora do saque. O time que saca pode estar em qualquer posição. Material antigo ainda mostra a regra antiga para os dois times, então o app tem um modo de regra configurável: **FIVB 2025–28 (padrão)** ou **Clássico**.

## Regras oficiais que o motor segue

### Ordem e giro (FIVB 7.4.1, 7.6, 12.2)
- Rede: posições 4, 3, 2 (esquerda → direita). Fundo: 5, 6, 1. A 1 é o fundo direito e é quem saca.
- Só gira o time que estava recebendo e venceu o rali (side-out), no sentido horário: 2→1, 3→2, 4→3, 5→4, 6→5, 1→6.
- Quem vence sacando não gira e o mesmo jogador saca de novo.
- Cada time tem a sua rotação, independente da do outro.

### Sobreposição — falta de posição (FIVB 7.4, 7.5)
- Vale só no momento do golpe do saque e, no FIVB 2025–28, só para o time que recebe.
- Frente e fundo: 1 atrás de 2, 6 atrás de 3, 5 atrás de 4. **Empate é permitido.**
- Lateral: 4 à esquerda de 3, 3 à esquerda de 2; 5 à esquerda de 6, 6 à esquerda de 1. **Empate é permitido** (FIVB 2025–28, 7.4.3.2, "level with"; decisão do Gabriel de 01/11/2026). O texto de edições anteriores não foi conferido: o Clássico usa a mesma comparação.
- Não existem outras relações (nada na diagonal). O sacador não conta. Mede-se pelos pés no chão.
- Depois do saque, todo mundo pode se mexer.

### Falta de rotação (FIVB 7.7)
- Sacar fora da ordem: ponto e saque para o adversário, rotação corrigida.
- Pontos feitos desde o erro são anulados, se der para saber quando foi.

### Líbero (FIVB 19)
- Só joga no fundo (5, 6, 1). Não saca, não bloqueia, não ataca acima da rede.
- Não entra na ordem de rotação: ocupa o lugar de quem substituiu e sai quando esse lugar vai para a posição 4.
- Trocas ilimitadas, com um rali completo entre duas trocas. Só troca com quem substituiu.
- Toque por cima dele na zona de ataque: o colega não pode atacar acima da rede.

### Jogador do fundo (FIVB 13.2, 13.3.3, 14.6.2)
- Só ataca acima da rede se pular de trás da linha de 3 m. Não bloqueia (levantador infiltrando não pode bloquear).

### Substituições e sets (FIVB 15, 18.2.2, 12.1)
- Oficial: 6 substituições por set. Na pelada o app desliga esse limite.
- Tie-break: troca de quadra aos 8 pontos, sem girar e sem mudar quem saca.
- Saque inicial: sorteio no 1º set e no set decisivo de md3 e md5; nos outros, alterna em relação a quem sacou primeiro no set anterior, e não "quem perdeu saca" (decisão do Gabriel de 02/11/2026; a FIVB fala em 5º set, e o tie-break da md3 segue a mesma regra).

## Sistemas de jogo

Escalação base, na ordem das posições 1 a 6 na rotação 1: Levantador, Ponteiro 1, Central 1, Oposto, Ponteiro 2, Central 2. Cada função fica na diagonal do seu par (convenção de treinador, não regra).

| Sistema | Composição | Quem levanta | Rotações |
|---|---|---|---|
| Livre / 6x0 (grátis) | 6 jogadores sem função | Quem estiver na posição 3 | Uma formação base |
| 4x2 (Pro) | 2 levantadores em diagonal, 2 ponteiros, 2 centrais | O levantador da rede | Levantador na rede (4, 3, 2), repetidas |
| 6x2 (Pro) | 2 levantadores-atacantes em diagonal, 2 ponteiros, 2 centrais, líbero | O do fundo (infiltra); o da rede ataca | Levantador no fundo (1, 6, 5), repetidas |
| 5x1 (Pro) | 1 levantador, 1 oposto, 2 ponteiros, 2 centrais, líbero | Sempre o mesmo; infiltra no fundo | As 6 |

### Numeração das rotações
Existem duas convenções. O app guarda a posição do levantador (`setterZone`, 1–6) e chama de "rotação N" o levantador na posição N. Girando, a sequência é **1 → 6 → 5 → 4 → 3 → 2**. Treinadores americanos numeram em sequência (rotação 1 = levantador sacando, rotação 2 = levantador na 6…); as duas só coincidem na 1 e na 4.

### Recomendação para pelada
Times sorteados: Livre/6x0 ou 4x2 com recepção em W de 5 passadores. 5x1 com 3 passadores só para times fixos e com líbero.

## O que o motor valida

**Erro (bloqueia):**
- Seis jogadores por time, cada posição ocupada uma vez. Time sem 6 jogadores fica com a rotação desligada (ADR 0024).
- Girar só quem venceu recebendo; nunca quem venceu sacando.
- Sacador é sempre quem está na posição 1 depois do giro.
- Líbero só no fundo, nunca sacando, sai ao chegar na 4, troca só com quem substituiu. O motor calcula a entrada e a saída a partir da zona e da fase, então não há troca de líbero gravada para validar (E2.11, ADR 0028).
- Tie-break: troca de lado aos 8 sem girar. O lado da quadra fica fora do motor: é o app que troca o desenho (ADR 0024).

**Aviso (só informa):**
- Sobreposição só nas 7 relações oficiais, só no time que recebe (modo FIVB), com tolerância configurável (padrão 0,02 ≈ 18 cm). A tolerância é simétrica: `atrás.y >= frente.y - tolerância` e `esquerda.x <= direita.x + tolerância`. No modo Clássico, o time que saca segue 5 relações: `1-behind-2` e `6-left-of-1` ficam de fora, porque o sacador não conta. Violação vira aviso, nunca bloqueio ([ADR 0010](../arquitetura/adr/0010-rotation-and-rule-mode.md)); contrato no [ADR 0021](../arquitetura/adr/0021-overlap-validator.md).
- Levantador na rede (2, 3, 4): não infiltra; pode bloquear e atacar.
- Levantador no fundo: não bloqueia nem ataca acima da rede na zona de frente.
- Rotação 4 sem empilhar: corrida longa do levantador. Rotação 1: infiltração mais longa.
- Funções fora da diagonal (dois levantadores lado a lado).
- Regras da casa (entra no saque, substituições livres) sempre como configuração, nunca como regra.

## Estado e eventos

Implementado na E2.3 ([ADR 0024](../arquitetura/adr/0024-saque-e-rotacao-derivados.md)). Código em `packages/match-engine/src/score/`; casos em `packages/match-engine/golden/rotation-*.json`.

- **Side-out derivado:** `PointScored` grava só quem marcou. Se esse time não estava sacando, é side-out: ele passa a sacar e só ele avança uma casa em `SETTER_ZONE_SEQUENCE`. Se estava, só o placar muda.
- **`lineup` ancorado no levantador:** 6 `MemberId` do time, sem repetir. `lineup[0]` é o levantador, e os demais seguem a ordem crescente de posição. O giro só muda `setterZone`. O sacador é quem está na posição 1.
- **`setterZone` em todos os sistemas:** a zona atual de `lineup[0]`. Na Livre, sem levantador, é a zona do primeiro da escalação, e a tela não mostra número.
- **Rotação desligada:** `rotations.<lado>: null`, inclusive para time sem 6 jogadores (areia 2x2 e 4x4, pelada com 5). O app mostra só o time que saca, sem sacador nem posições (decisão do Gabriel de 02/11/2026). O saque continua sendo acompanhado.
- **Virada de set:** `SetEnded.nextSet` grava `firstServer` e `setterZones`, aplicados sem recalcular. A rotação **continua de onde parou**, sem mexer em ninguém (decisão do Gabriel de 02/11/2026). O comando alterna o primeiro saque e, no set decisivo, recebe o sorteio de fora (`confirmSetEnd(state, { firstServer })`); a interface do sorteio é da E4.10.
- **Lado da quadra:** fora do estado do motor. Virar set e chegar a 8 no tie-break não giram nem mudam quem saca; o desenho é da E4.10.

Posições no saque implementadas na E2.4 ([ADR 0026](../arquitetura/adr/0026-posicoes-no-saque.md)). Código em `packages/match-engine/src/score/serve-alignment.ts`; casos em `packages/match-engine/golden/serve-alignment.json`.

- **`system` por time:** fica em `TeamState`, gravado no `MatchStarted`, e não muda ao virar o set.
- **Função pela ordem do `lineup`:** no 5x1, `S, OH1, MB1, OPP, OH2, MB2`; no 6x2 e no 4x2, `S1, OH1, MB1, S2, OH2, MB2`. O 2º levantador fica no índice 3, em diagonal com o 1º.
- **Da zona à formação:** o 5x1 usa a chave igual à zona. O 6x2 usa as chaves 1, 6, 5 e, nas zonas 4, 3, 2, as mesmas chaves com os pares trocados. O 4x2 usa as chaves 4, 3, 2 nas zonas 1, 6, 5 e as mesmas com os pares trocados nas zonas 4, 3, 2. A Livre usa sempre a chave `0`, com os membros girando, e a função é a posição (`P<slot>`).
- **Troca de pares:** `S1↔S2`, `OH1↔OH2`, `MB1↔MB2`, só no rótulo; o ponto é o da formação.
- **Quem levanta (`actingSetter`):** o único levantador no 5x1, o do fundo no 6x2, o da rede no 4x2, quem está na posição 3 na Livre.
- **Líbero desligado:** o slot `L` da formação vira a função de quem ele substituiria, no mesmo ponto. O líbero ligado é da E2.11 (abaixo).
- **Fase:** quem saca está em `serving`, o outro em `receiving`. Rotação desligada, sem set aberto ou catálogo desconhecido dão `null`.
- **Sobreposição:** `validateServeAlignment` só informa, com o modo de regra de quem chama. Com pontos do catálogo, nunca há violação.
- **Versão do catálogo:** o `MatchStarted` grava `formationsVersion`. Mudar uma formação exige versão nova, com a anterior preservada, para uma partida gravada não mudar de desenho.

Banco manual implementado na E2.5 ([ADR 0027](../arquitetura/adr/0027-banco-manual.md)). Código em `packages/match-engine/src/score/`; casos em `packages/match-engine/golden/bench-events.json`.

- **Só Manual no MVP:** nenhum ponto troca jogador (decisão do Gabriel de 02/11/2026). `PointScored` só soma e gira. "Sai quem saca" e as outras regras automáticas estão em `docs/ideias.md`.
- **`bench` por time:** quem é do time e não está em `lineup`, na ordem da fila. `lineup` e `bench`, sem repetir, são sempre exatamente `teams.<lado>.memberIds`. A ordem inicial vem no `MatchStarted`. Banco vazio é `[]`, e `bench.length === 0` dá "sem banco" nas telas.
- **Mesma posição, zona intacta:** quem entra assume o índice de quem saiu em `lineup`, e `setterZone` não muda.
- **Ordem da fila:** quem entra sai da lista, sem mudar a ordem dos outros; quem sai vai para o fim. O admin escolhe quem entra, que não precisa ser o primeiro: a ordem só aparece com 2 ou mais no banco.
- **Levantador ou sacador saindo:** nada especial. Quem entra em `lineup[0]` é o novo levantador, e quem entra no lugar do sacador saca na hora, porque o sacador vem da posição. Em `ServeAlignment`, muda só o `memberId` daquela posição e, se quem saiu levantava, o `actingSetter`.
- **Alteração de escalação (`LineupChanged`):** grava a alocação inteira do time, para a troca com o banco e para a tela 22 (troca de dois em quadra, seletor de rotação, reancoragem). `system` não muda em partida.
- **Rotação desligada não tem banco,** com qualquer número de membros: a troca é recusada.
- **Virada de set e fim de partida:** banco e escalação seguem como estão. `FinishedMatch.rotations` traz o banco no fim, e a partida seguinte chega em outro `MatchStarted`.

Correções implementadas na E2.7 ([ADR 0030](../arquitetura/adr/0030-correcoes-da-linha-do-tempo.md)). Código em `packages/match-engine/src/corrections/` e `score/commands.ts`; casos em `packages/match-engine/golden/corrections-events.json`.

- **Girar e desgirar (tela 24):** gravam a alocação inteira num `LineupChanged`, com a zona vizinha absoluta. Girar segue `1 → 6 → 5 → 4 → 3 → 2 → 1`; desgirar volta `1 → 2 → 3 → 4 → 5 → 6 → 1`. Banco, líbero e escalação ficam; o outro time e o placar não mudam. O próximo side-out parte da zona gravada.
- **Trocar sacador:** troca só o time que saca, sem girar ninguém (decisão do Gabriel de 03/11/2026). No 0–0 também corrige quem começou o set, e o próximo set alterna a partir do corrigido; com pontos, quem começou fica. O próximo ponto de quem passou a sacar não gira. O líbero segue o saque corrigido, porque a fase sai do estado. Vale com a rotação desligada. Recusado com set decidido ou fechado.
- **Desfazer:** volta a última ação, seja ela qual for (decisão do Gabriel de 03/11/2026). Voltar a um ponto volta placar, saque, zonas, banco, líbero e fila juntos, ao estado logo depois dele. Só na partida aberta.
- **Linha do tempo da tela 24:** em cada ponto, o sacador é o de **antes** do ponto, e "rot. N" é a zona de quem venceu depois do side-out.
- **Girar desatualizado:** um `LineupChanged` de outro celular, gravado depois de um side-out na ordem canônica, vale como veio e desfaz o giro (pendência da E3.7 e da E4.11).

Líbero ligado implementado na E2.11 ([ADR 0028](../arquitetura/adr/0028-libero-ligado.md)). Código em `packages/match-engine/src/score/rotation-rules.ts` e `serve-alignment.ts`; casos em `packages/match-engine/golden/libero-*.json`.

- **Só 5x1 e 6x2** (decisão do Gabriel de 03/11/2026). 4x2 e Livre recusam o líbero, e o catálogo não muda.
- **`libero` por time:** `{ memberId, replacedIndexes }` ou `null`, fora de `lineup` e de `bench`. `lineup`, `bench` e o líbero, sem repetir, são sempre exatamente `teams.<lado>.memberIds`.
- **Vagas por índice de `lineup`:** uma, ou duas em diagonal (diferença 3), nunca de levantador (5x1: 0; 6x2: 0 e 3). No app, os dois centrais, `[2, 5]`, alternando, como no catálogo (decisão do Gabriel de 03/11/2026). Quem entra do banco numa vaga coberta passa a ser coberto.
- **Entrada e saída calculadas, nunca gravadas** (decisão do Gabriel de 03/11/2026): o líbero está no slot do fundo (1, 5 ou 6) em que está uma vaga coberta. Com a vaga na rede, está fora, e por isso sai ao chegar na 4. Na posição 1 do time que saca, está fora: saca o titular.
- **Tabela com os centrais `[2, 5]`** (`*`: o time que saca não tem líbero nesse slot, e saca o titular):

| `setterZone` | 1 | 6 | 5 | 4 | 3 | 2 |
|---|---|---|---|---|---|---|
| Slot do líbero | 6 | 5 | 1* | 6 | 5 | 1* |
| Índice coberto | 5 | 5 | 2 | 2 | 2 | 5 |

- **Ordem de rotação intacta:** `getLineupBySlot` e o sacador seguem o `lineup`; `getOnCourtBySlot` mostra quem está em quadra, com o líbero no slot dele. `actingSetter` nunca muda, porque vaga de levantador é proibida.
- **Um rali entre trocas:** só um ponto muda quem está em quadra, e a vaga coberta nunca muda num mesmo ponto.
- **Trocar ou desligar o líbero em partida** é um `LineupChanged`, que grava o líbero junto com a alocação. O líbero não entra nem sai por troca com o banco.

### No app: tela 22, Escalação (E4.8, [ADR 0065](../arquitetura/adr/0065-escalacao-no-app.md))

- **"Rotação N"** é o levantador na zona N: o seletor é absoluto e muda só `setterZone`. Todos giram juntos e, no time que saca, muda quem saca ("João passa a sacar."). Na Livre não há seletor.
- **Trocar dois jogadores** troca os dois índices de `lineup`: cada um vai para a posição do outro e herda a função do índice; `setterZone` fica.
- **"Tornar levantador" (reancorar):** gira `lineup` para o escolhido ficar em `lineup[0]` e põe `setterZone` na zona atual dele. Ninguém muda de lugar (`getLineupBySlot` igual antes e depois); muda só quem é levantador e, por isso, as funções.
- **"Fora de ordem" (resposta 77):** a posição principal do perfil não bate com a função do índice (`S, OH, MB, OPP, OH, MB` no 5x1; `S1, OH, MB, S2, OH, MB` no 6x2 e no 4x2, com o oposto aceito em `S2` quando não há outro levantador). `any`, `libero` e sem perfil nunca avisam; a Livre nunca avisa. O texto lista os nomes na ordem do diagrama da quadra (4, 3, 2, 5, 6, 1). Só informa: salvar continua possível.
- **"Corrigir":** `lineup[0]` e a zona ficam; as outras cinco vagas são preenchidas de novo pela regra da escalação padrão, na ordem atual.
- **Líbero do início (resposta 76):** uma reserva da fila, escolhida na 22 do pré-jogo, só no 5x1 e no 6x2, cobrindo sempre `[2, 5]`. Ela sai da fila e entra no time no `MatchStarted` (`teams.<lado>` com 7). A mesma reserva não é líbero dos dois times. Mudar o sistema para 4x2 ou Livre, ou trocar o time na 07, descarta a escalação salva e o líbero sem ação nenhuma (derivado).

## Erros comuns de implementação
- Misturar as duas numerações de rotação.
- Guardar o líbero dentro da ordem de rotação.
- Guardar a vaga do líbero por `MemberId`: quem entra do banco na vaga ficaria sem cobertura.
- Checar relações que não existem (diagonais, rede contra fundo na lateral).
- Espelhar coordenadas na troca de quadra: as coordenadas são do próprio time; só o desenho espelha.
- Girar o time ao trocar de quadra.

## Coordenadas (`packages/volley-rules/src/formations/formations.json`)

Meia quadra do próprio time vista de cima, rede no topo. `x`: 0 = esquerda, 1 = direita. `y`: 0 = rede, 1 = linha de fundo (> 1 = zona de saque). As coordenadas são proposta técnica dentro das convenções da Gold Medal Squared e da JVA, todas validadas contra as regras de sobreposição. 6x2 = 5x1 com o levantador do fundo (S1) infiltrando e o da rede (S2) atacando como oposto.

## Fontes
- FIVB — Official Volleyball Rules 2025–2028 (PDF) e tradução PT-BR
- FIVB — Alterações de regras 2025–2028
- Volleyball England — FAQ 2025–26
- Gold Medal Squared — Serve receive; JVA — Serve receive rotations
- Coaching Volleyball — Líbero; Rotação inicial no 5-1
- visu.network — Rodízio de vôlei; The Art of Coaching Volleyball — Formações de passe; UGA — Volleyball (CC BY 4.0)
