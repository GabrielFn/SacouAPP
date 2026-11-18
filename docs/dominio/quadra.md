# Modo quadra: log local, controlador e telas

Regras do modo quadra no app (E4.9). As partes 1 (log local e controlador, sem tela), 2 (telas 09 e 10) 3 (recursos do aparelho e medição) e 4 (líbero) estão feitas. Decisão técnica no [ADR 0038](../arquitetura/adr/0038-log-local-da-quadra.md). Código em `apps/mobile/src/features/court/`.

## O estado é o log

O estado da partida é **sempre** o replay do log de eventos persistido no SQLite do aparelho (`frontend.md`, regra 1). Ninguém guarda uma cópia do placar. O controlador expõe `events`, exatamente o que está gravado, e quem precisa do estado chama o `CourtReplayer` (cache por array, sem cópia do estado).

## Comandos

| Comando                            | Faz                                                                  | Recusas do motor                                                                      |
| ---------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `start-match`                      | `startMatch`                                                         | `match-already-open`, `too-many-matches`, versão de regras ou formações não suportada |
| `score-point { team }`             | `scorePoint`                                                         | `set-decided`, `no-open-match`, `no-open-set`                                         |
| `undo`                             | `undoLastAction` (um `RevertedTo`)                                   | `nothing-to-undo`, `no-open-match`                                                    |
| `confirm-set-end { firstServer? }` | `confirmSetEnd`; `firstServer` só no sorteio do set decisivo (E4.10) | `set-not-decided`, `no-open-match`                                                    |

- **As telas não têm `start-match`.** O tipo `PlayCommand` (`score-point`, `undo`, `confirm-set-end`) é o que o hook `useCourtSession` aceita; quem abre a partida é `startCourtMatch`.
- **Um comando por vez**, na ordem enviada. O estado usado é o do momento da execução, nunca o de quando o toque foi feito.
- **Simular antes de gravar:** o log com os eventos novos precisa fazer replay; senão o resultado é `rejected` e nada é gravado.
- **Atômico:** os eventos de um comando vão numa transação. O fim do set decisivo grava `SetEnded` e `MatchEnded` juntos (`placar.md`).
- **Snapshot só depois do commit.** Se a gravação falha, o resultado é `write-failed`, e o controlador **recarrega o log do arquivo dentro da fila**, porque a falha pode ter vindo depois do COMMIT. Dois desfechos: o snapshot ganha o evento que já estava gravado (ou continua igual, se nada foi gravado) e o próximo comando funciona; ou, se a recarga também falha, o snapshot vira `failed` (hoje permanente até reabrir o app; o `retry()` é da parte 2).
- **Fim de set é sempre confirmado:** `confirm-set-end` é um comando do usuário; desfazer logo depois reabre o set (`undo` aponta para o evento anterior ao `SetEnded`).

## Começar uma partida

`startCourtMatch(deps, MatchStartedPayload)` é a única porta pública: abre a `CourtSession` se não existe, roda `startMatch`, grava o `MatchStarted` e devolve `{ route: "/court/<id>" }`. O pré-jogo (E4.7) a chama em "Começar". Na E4.9 quem a chama é a tela de desenvolvimento, com os times de exemplo das telas (`dev/sample-match.data.ts`: só IDs, os nomes ficam num `CourtRoster` à parte, nunca no SQLite).

## Falhas ao abrir

| Situação                                                                        | Estado do controlador          |
| ------------------------------------------------------------------------------- | ------------------------------ |
| Sessão que não existe                                                           | `failed` · `session-not-found` |
| Linha que o parser recusa (payload que não é JSON, `type` vazio, UUID inválido) | `failed` · `corrupted-log`     |
| `sequence` de um aparelho fora de 1..n, na ordem das posições                   | `failed` · `corrupted-log`     |
| Linhas válidas, mas o log não faz replay (inclusive payload com campo a mais)   | `failed` · `replay-failed`     |
| Erro do banco                                                                   | `failed` · `storage-failed`    |

Nada é apagado e nenhum valor do log aparece no erro. A tela de erro ("Não conseguimos abrir esta partida", com "Tentar de novo" e "Voltar ao início") aparece para qualquer `failed`, e "Tentar de novo" chama `retry()`: o controlador relê o log do arquivo dentro da fila de escrita, passa por `loading` e volta a `ready` se o log agora abre. Um log que continua quebrado continua `failed`, sem apagar nada. A reabertura da conexão depois de um `ROLLBACK` que falhou (ADR 0038, limitação conhecida) **não** foi feita: o `retry()` relê o log, mas a gravação seguinte ainda falha até reabrir o app.

## Paisagem (E4.17, parte 1)

O modo quadra fica **sempre em paisagem, travado** ([ADR 0052](../arquitetura/adr/0052-modo-quadra-em-paisagem.md)); o resto do app, em retrato. O `_layout` da quadra trava ao montar e destrava (volta a retrato) ao desmontar, pela porta `ScreenOrientation`; menu, correção, fim de set e fim de partida são rotas do mesmo layout e também ficam deitadas, com rolagem e largura máxima. O layout vem da janela (`computeCourtLayout`): `largura > altura` é paisagem, o resto é o retrato de reserva (tablet que ignora a trava, tela dividida, trava que falhou).

**Paisagem (esboço aprovado, 844 × 390).** Barra de cima (44): "2º set", bolinhas, a dica no centro ("Posições no momento do saque", set point), "Salvo no celular" e Menu. Meio (294): Time A (366) | rede (112) | Time B (366). A coluna do time fica na borda de fora (A em cima à esquerda, B embaixo à direita), o quadrado da meia quadra encosta na rede e a linha de ataque é vertical a 1/3 da rede. A rede tem a malha vertical, Desfazer alto e Corrigir embaixo. Fila (52): uma linha só. O placar tem 45% da altura da zona; em aparelho menos largo a coluna cresce e o quadrado cede.

**Círculo com número e nome pequeno.** Cada posição é um círculo na cor do time (28 a 32 na tela de 844 × 390, escalado pelo lado menor) com o número da posição dentro; o nome vai embaixo, em tamanho de legenda. `placeMarkers` (puro, `model/marker-placement.ts`): o **centro do círculo é sempre o ponto exato da formação** (`formations.json`) e nunca é empurrado; só um ponto fora da zona (o sacador atrás da linha de fundo) é trazido para dentro, inteiro, e para fora da coluna do time. O nome vai logo abaixo do círculo; onde ali cobriria outro círculo, outro nome, a coluna, a rede ou a borda da zona, tenta acima, à direita, à esquerda e nas diagonais, depois uma e duas linhas mais longe; se nada servir, o nome encurta (regra dos nomes abaixo) e, por fim, usa a posição de menor sobreposição, sempre evitando cobrir círculo. Selos: bola no sacador (círculo amarelo), "L" no levantador, "Lí" no líbero (círculo escuro). O leitor de tela lê, num elemento só, nome inteiro, posição e papel. No retrato de reserva as mesmas regras valem para os círculos; um nome pode apertar outro.

**Nomes curtos.** O chip e a pílula da fila mostram o primeiro nome; com dois iguais entre os 12 em quadra e a fila, "Ana C." (a inicial cresce, "Ana Ca.", "Ana Cl.", só para quem ainda repete); o que não cabe termina em "…" pela largura do chip. O leitor de tela lê o nome inteiro (`displayNamesOf` em `model/display-names.ts`).

**Sem toast.** O "+1" saiu da quadra por decisão do Gabriel ("ele sabe para quem marcou o ponto").

## Telas 09 e 10 (parte 2)

Código em `features/court/ui` (componentes), `features/court/model` (seletores, geometria, textos) e `src/app/court/[courtSessionId]` (rotas).

**Estado.** Um controlador por `CourtSession`, criado no `_layout` da rota e compartilhado pela quadra, pelo fim do set, pelo menu e pela correção (`CourtSessionProvider`). O hook `useCourtSession` entrega `loading | failed | ready { timeline }`, onde `timeline` é o replay do log (o `CourtReplayer` guarda o resultado por array, então a tela lê o que o toque já simulou). `selectCourtScreen(timeline, roster)` deriva tudo que a tela mostra e não guarda nada. Nomes e cor do time vêm do `CourtRoster` (na E4.9, a amostra), nunca do log.

**Layout.** A altura é repartida em pesos de flex do canvas (barra 44, zona 288, faixa 104, zona 288, fila 120, de 844). A meia quadra é um quadrado de 210/390 da largura, limitado a 210/288 da altura da zona. Tipografia, raios, espaços e bordas vêm de `tokens.court` (escalados pela janela; os alvos de toque seguem ≥ 44). A zona do time de cima é virada de costas: a geometria espelha os dois eixos (`placeOnHalfCourt`) e o sacador cai acima do quadrado. Os chips são posicionados em pixels por `layoutTeamChips` (ver "Paisagem" acima); a partir da E4.17 não há mais o suporte de 200% da largura.

**Placar sem teto.** Fonte = 45,8% da altura da zona (132/288) até 2 dígitos; 3 dígitos usam 70% disso; 4 ou mais, 50%; e nunca passa da largura da coluna do placar (uma conta por dígito, sem `onLayout`). `allowFontScaling={false}`: o tamanho já vem da zona, e a escala do sistema o empurraria para fora dela. `adjustsFontSizeToFit` e `numberOfLines={1}` ficam de segurança. O rótulo de acessibilidade da zona traz o número inteiro.

**Set point.** No Noite, o número fica amarelo (papel `scoreHighlight` do tema); no Sol, o número fica na cor do texto (amarelo sobre branco não chega a 3:1, testado) e só a etiqueta "Set point" é amarela, com borda preta (`serverOutline`). A etiqueta substitui a linha "Sacando"/"Em recepção", como na tela 10. Com os dois times em set point (sem vantagem), as duas etiquetas aparecem e a faixa diz "Quem fizer o próximo ponto fecha o set". O pulso e o "reduzir movimento" estão em "Recursos do aparelho" abaixo.

**Outros.** Bolinhas de sets: uma por set jogado ou em jogo, escondidas com `bestOf` 1. Fila: pílulas numeradas; "reservas" só com jogadores avulsos; "perde sai · saída parcial" sem time completo na fila e "perde sai" com time; sem ninguém na fila, a linha some. "Laranja venceu N seguidas": partidas terminadas seguidas, da mais recente para trás, vencidas por um time que tem a maioria do time atual (`win-streak.ts`); a linha some com N = 0. Chip do levantador: selo "L" quando o chip é `actingSetter` (nenhum no sistema Livre). Time com rotação desligada: sem chips e sem linha de rotação, só a fase. DESFAZER usa a resposta do próprio motor (`undoLastAction`): fica desabilitado quando não há o que desfazer.

**Rotas.** `court/[courtSessionId]` (as telas 09 e 10), e os espaços da E4.10: `set-end` (abre sozinha quando o set fica decidido; "Confirmar fim do set", ou "Laranja saca"/"Azul saca" antes do set decisivo; "Voltar" volta à quadra, onde DESFAZER reabre o set), `match-end`, `menu` e `corrections`. A navegação é efeito do **passo** que a fase pede (`nextCourtRoute(rota, fase, foco)`, função pura usada pela quadra e pelo fim do set): a quadra abre o fim do set quando o set fica decidido e abre o resultado quando a partida acaba, mas só com foco; o fim do set volta à quadra quando o próximo set começa e vai direto ao resultado quando a confirmação encerra a partida (o set decisivo grava `SetEnded` e `MatchEnded` juntos). O efeito só roda quando o passo muda, então voltar do fim do set não o abre de novo. O `_layout` da quadra bloqueia o gesto de voltar (`gestureEnabled: false`). O tema (Sol ou Noite) vem do parâmetro `theme` da rota até a E4.10 ter a preferência; sem parâmetro, Sol. O Menu abre **segurando** (800 ms, `HOLD_TO_OPEN_MENU_MS`).

**Retomada.** Decidida **uma vez por abertura do app**, no `DatabaseGate`, junto com o banco (`findResumableCourtSession`: fase `playing` ou `set-decided`). A home entrega o valor uma só vez (`ResumeOnce.take()`) e redireciona; depois de "Sair do modo quadra" a home nova não encontra mais nada e não prende o usuário. Partida encerrada não retoma (a E4.10 trata a próxima). Voltar do Android numa quadra de partida encerrada leva de novo ao resultado; o voltar do fim do set sem histórico (abertura a frio) cai na quadra.

**Fila longa.** A faixa mostra no máximo 4 pílulas (`MAX_QUEUE_PILLS`, times inteiros primeiro, depois reservas) e um "+k" para o resto, para ela não quebrar em duas linhas.

**Texto e abertura do banco.** O `Text` base não aplica a escala de fonte do sistema (`allowFontScaling={false}`), porque os tokens já a aplicam com teto de 1,3. Se o banco não abre, o `DatabaseGate` mostra "Não conseguimos abrir o armazenamento" com "Tentar de novo". **Pendência E4.7/E3.17:** o `CourtRoster` de amostra (nomes de teste) ainda é o que vai no build de produção. A E4.2 entregou o cache persistido (`sacou-cache.db`, ADR 0042, Parte 2), que já guarda os membros do grupo por `MemberId` e vale 7 dias sem rede; os nomes entram nele quando a E3.17 trouxer a rota de perfis, e a E4.7 troca a amostra por um `CourtRoster` que lê esse cache. O log da quadra continua sem nome.

**Tela de desenvolvimento.** `/dev/court`, atrás de `EXPO_PUBLIC_DEV_TOOLS=1` (`src/config/dev-tools.ts`; também vale para `/dev/catalog`, que deixou de usar `__DEV__`): "Nova partida (1 set)", "(melhor de 3)", "(com líbero)" e "(nomes longos)" (nomes como Maximiliano, Ana Carolina e Guilhermina, com três "Ana" e um "Maximiliano" na fila, para ver os nomes curtos e as reticências), tema, "Continuar partida" e "Encerrar quadra". Cada nova partida fecha a sessão aberta e chama `startCourtMatch` com os times de exemplo.

**Diferenças em relação ao design.** (1) O design não mostra o líbero; pela decisão do Gabriel (pergunta 14, opção 1), o chip do líbero ocupa o lugar do central que ele cobre, com as cores invertidas (preenchimento na cor do texto, nome e zona na cor do fundo) e o selo "Lí"; o "L" continua sendo do levantador e o rótulo de leitor de tela diz "líbero". O líbero aparece no fundo de quem recebe, não aparece na posição 1 de quem saca e some ao chegar na 4 (regra do motor, ADR 0028; o app só desenha o que o motor calcula). O contraste das cores invertidas é testado nos dois temas (`chip-colors.test.ts`). A amostra de desenvolvimento "Nova partida (com líbero)" põe o líbero do Laranja cobrindo os dois centrais (`replacedIndexes [2, 5]`). (1b) O pulso do set point é amarelo para amarelo claro, sem o desenho exato da animação (o design é estático). (2) A linha de ataque é uma linha SVG tracejada (`6 4`), não uma borda `dashed`, porque a borda tracejada de um lado só não é igual nos dois sistemas. (3) As posições do Azul na tela 09 vêm do catálogo (fonte única) e diferem do desenho até 0,4 em profundidade; as do Laranja batem com o design a 7%. (4) A tela 10 não é alcançável a partir de a1/b5 (com o Laranja sacando, os dois times giram o mesmo número de vezes); o teste usa as zonas iniciais 1 e 6. (5) O rótulo do cadeado travado é "Tela travada. Segure para destravar" (o design diz "Segure para sair"), porque segurar o cadeado destrava e não sai da quadra.

## Recursos do aparelho e proteções (parte 3)

Cada recurso tem uma interface em `features/court/ports/` (`ScreenAwake`, `CourtFeedback`, `BackGuard`, `ReducedMotion`, `Clock`), uma implementação real em `src/adapters/` e uma falsa para os testes. O app injeta as reais em `app/_layout.tsx` (`Services`).

**Proteção da quadra (sem trava).** O cadeado foi **removido em 13/11/2026 por decisão do Gabriel**: o usuário não saberia que precisa segurar o cadeado (teste no celular da E4.9). O **Menu** abre com um toque simples, sempre (rótulo "Menu da partida"). O botão voltar do Android fica bloqueado enquanto a quadra estiver em foco (`isBackBlocked` depende só de `focused`); no fim do set e no menu o voltar funciona, e sair é pelo Menu → "Sair do modo quadra". O estado vive em `guard/court-guard.reducer.ts` (reducer puro, `switch` exaustivo): só `cooldownUntil`; ações `point-accepted`, `undo-accepted` e `tick`. Um timer no hook `useCourtGuard` só acorda o componente quando algo vence; o reducer limpa.

**Bloqueio depois do ponto.** `POINT_COOLDOWN_MS` = 700 ms, contado do toque aceito (`point-accepted`), nas duas zonas. DESFAZER nunca é bloqueado e não conta como ponto. O bloqueio vale também se o motor recusar o ponto.

**Palma.** Um toque com dois dedos ou mais na zona é ignorado (`guard/palm.ts`): o pico de dedos do gesto vem de `onTouchStart` (um dedo sozinho começa um gesto novo) e o `onPress` confere o pico.

**Toast.** Removido em 13/11/2026 (E4.17): sem o "+1", sem `POINT_TOAST_MS`, sem `toastUntil` e sem `point-toast.ts`.

**Tela ligada.** O `_layout` da quadra liga a tela (`ScreenAwake.activate("sacou-court")`) quando monta e desliga quando desmonta. Como o `_layout` serve a quadra, o fim do set, o menu e a correção, a tela fica ligada em todas elas e apaga ao sair do modo quadra (inclusive por "Sair do modo quadra").

**Vibração.** `model/feedback.ts`, `deriveFeedback(antes, depois)`: função pura entre dois estados, que lista os tipos em ordem de força; o aparelho toca só o último (`strongestFeedback`). O `_layout` da quadra compara o estado antes e depois de cada mudança do log, **depois do commit** (o primeiro estado, ao abrir ou retomar, não vibra). `refused` não sai dos estados: o hook da tela o toca quando o motor recusa um comando.

| Tipo | Quando | Vibração (`expo-haptics`) |
|---|---|---|
| `point` | um ponto no mesmo set | `impactAsync` leve |
| `side-out` | o ponto trocou o saque | `impactAsync` médio |
| `set-point` | um time passou a ter set point | `notificationAsync` Warning |
| `set-ended` | o ponto que decide um set de série (a confirmação do fim do set é silenciosa) | `notificationAsync` Success |
| `match-ended` | o ponto que decide a partida (inclusive o set decisivo; confirmar é silencioso) | `notificationAsync` Success |
| `refused` | o motor recusou o comando | `notificationAsync` Error |

Desfazer não vibra como ponto (o placar volta). Bipe: fora (nenhuma tela o liga).

**Pulso do set point.** A etiqueta "Set point" alterna o amarelo do tema e o amarelo claro `#FFE08A` (700 ms cada), exceto com "reduzir movimento" do aparelho ligado (`ReducedMotion`), quando fica parada.

**Medição do Hermes.** `/dev/replay-benchmark` (só com `EXPO_PUBLIC_DEV_TOOLS=1`): cenários S1 (um set, cerca de 50 eventos), S2 (melhor de 5, 20 desfazer), S3 (rodada típica, 30 partidas) e S4 (limite, 200 partidas). Mede (a) ler e validar as linhas, (b) replay, (c) montar a tela, (d) `getOpenMatchStartIndex` × 10 e `getRecentPoints`, (e) o toque inteiro no SQLite de verdade e (f) a leitura das linhas, mais reabrir a quadra. Usa um arquivo de banco próprio (`sacou-benchmark.db`), nunca o das partidas. Resultado e orçamento no ADR 0038.

## Fim do set, fim da partida e a próxima (E4.10 Parte 2, ADR 0066)

- **Fases:** `playing` (quadra), `set-decided` (tela 25), `match-pending` (só o `SetEnded` do decisivo gravado: a 25 confirma de novo e grava o `MatchEnded`), `match-ended` (tela 11). A quadra abre a 25 nas duas do meio.
- **Lados:** A à esquerda nos sets ímpares, B nos pares; no set decisivo com tie-break, os lados trocam quando um time chega à metade do alvo arredondada para cima (8 com 15, 6 com 11). "Inverter lados" inverte o resultado. É função do placar: desfazer o ponto da troca volta os lados.
- **Saque do próximo set:** alterna sozinho (oposto de quem sacou primeiro no set, já corrigido por "Trocar sacador" no 0–0). Antes do set decisivo, sorteio na 25 ("Saca primeiro" ou "Sortear"); a escolha só vale ao confirmar.
- **Próxima partida:** plano do motor (`planNextMatch`) com a configuração da rodada; quem entra numa vaga da escalação aparece como "posição N" (slot da quadra pela zona do levantador no fim). Quem saca na partida seguinte é sorteado ao confirmar (resposta 81).

## Pendente

Teste no celular da parte 3 (roteiro em `docs/operacao/teste-no-celular.md`): vibração, tela ligada, trava do voltar, fechar e reabrir em modo avião e a medida do Hermes. E4.10: menu, correção, fim de set e de partida. Os nomes reais offline dependem da E4.2/E4.7.

**Lacuna de teste.** Os hooks de recursos do aparelho (`useCourtGuard`, `useBackGuard`, `useKeepAwakeWhileFocused`, `useCourtFeedback`) não têm teste de renderização, porque o projeto não tem um renderer de hooks. A lógica de decisão fica em funções puras testadas (reducer da trava, `deriveFeedback`, `feedbackOnChange`); a ligação com o React é conferida no roteiro do celular.
