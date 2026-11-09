# Modo quadra: log local, controlador e telas

Regras do modo quadra no app (E4.9). As partes 1 (log local e controlador, sem tela) e 2 (telas 09 e 10) estão feitas; trava, vibração e tela ligada entram com a parte 3, e o líbero com a parte 4. Decisão técnica no [ADR 0038](../arquitetura/adr/0038-log-local-da-quadra.md). Código em `apps/mobile/src/features/court/`.

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

## Telas 09 e 10 (parte 2)

Código em `features/court/ui` (componentes), `features/court/model` (seletores, geometria, textos) e `src/app/court/[courtSessionId]` (rotas).

**Estado.** Um controlador por `CourtSession`, criado no `_layout` da rota e compartilhado pela quadra, pelo fim do set, pelo menu e pela correção (`CourtSessionProvider`). O hook `useCourtSession` entrega `loading | failed | ready { timeline }`, onde `timeline` é o replay do log (o `CourtReplayer` guarda o resultado por array, então a tela lê o que o toque já simulou). `selectCourtScreen(timeline, roster)` deriva tudo que a tela mostra e não guarda nada. Nomes e cor do time vêm do `CourtRoster` (na E4.9, a amostra), nunca do log.

**Layout.** A altura é repartida em pesos de flex do canvas (barra 44, zona 288, faixa 104, zona 288, fila 120, de 844). A meia quadra é um quadrado de 210/390 da largura, limitado a 210/288 da altura da zona. Tipografia, raios, espaços e bordas vêm de `tokens.court` (escalados pela janela; os alvos de toque seguem ≥ 44). A zona do time de cima é virada de costas: a geometria espelha os dois eixos (`placeOnHalfCourt`) e o sacador cai acima do quadrado. Cada chip fica num suporte de 200% da largura da quadra, centralizado no ponto (o nome nunca quebra linha), com `translateY` de -50%.

**Placar sem teto.** Fonte = 45,8% da altura da zona (132/288) até 2 dígitos; 3 dígitos usam 70% disso; 4 ou mais, 50%; e nunca passa da largura da coluna do placar (uma conta por dígito, sem `onLayout`). `allowFontScaling={false}`: o tamanho já vem da zona, e a escala do sistema o empurraria para fora dela. `adjustsFontSizeToFit` e `numberOfLines={1}` ficam de segurança. O rótulo de acessibilidade da zona traz o número inteiro.

**Set point.** No Noite, o número fica amarelo (papel `scoreHighlight` do tema); no Sol, o número fica na cor do texto (amarelo sobre branco não chega a 3:1, testado) e só a etiqueta "Set point" é amarela, com borda preta (`serverOutline`). A etiqueta substitui a linha "Sacando"/"Em recepção", como na tela 10. Com os dois times em set point (sem vantagem), as duas etiquetas aparecem e a faixa diz "Quem fizer o próximo ponto fecha o set". A animação de pulso e o "reduzir movimento" são da parte 3 (a cor `#FFE08A` já está em `palette.ballYellowLight`).

**Outros.** Bolinhas de sets: uma por set jogado ou em jogo, escondidas com `bestOf` 1. Fila: pílulas numeradas; "reservas" só com jogadores avulsos; "perde sai · saída parcial" sem time completo na fila e "perde sai" com time; sem ninguém na fila, a linha some. "Laranja venceu N seguidas": partidas terminadas seguidas, da mais recente para trás, vencidas por um time que tem a maioria do time atual (`win-streak.ts`); a linha some com N = 0. Chip do levantador: selo "L" quando o chip é `actingSetter` (nenhum no sistema Livre). Time com rotação desligada: sem chips e sem linha de rotação, só a fase. DESFAZER usa a resposta do próprio motor (`undoLastAction`): fica desabilitado quando não há o que desfazer.

**Rotas.** `court/[courtSessionId]` (as telas 09 e 10), e os espaços da E4.10: `set-end` (abre sozinha quando o set fica decidido; "Confirmar fim do set", ou "Laranja saca"/"Azul saca" antes do set decisivo; "Voltar" volta à quadra, onde DESFAZER reabre o set), `match-end`, `menu` e `corrections`. A navegação é efeito do **passo** que a fase pede (`nextCourtRoute(rota, fase, foco)`, função pura usada pela quadra e pelo fim do set): a quadra abre o fim do set quando o set fica decidido e abre o resultado quando a partida acaba, mas só com foco; o fim do set volta à quadra quando o próximo set começa e vai direto ao resultado quando a confirmação encerra a partida (o set decisivo grava `SetEnded` e `MatchEnded` juntos). O efeito só roda quando o passo muda, então voltar do fim do set não o abre de novo. O `_layout` da quadra bloqueia o gesto de voltar (`gestureEnabled: false`). O tema (Sol ou Noite) vem do parâmetro `theme` da rota até a E4.10 ter a preferência; sem parâmetro, Sol. O Menu abre **segurando** (800 ms, `HOLD_TO_OPEN_MENU_MS`).

**Retomada.** Decidida **uma vez por abertura do app**, no `DatabaseGate`, junto com o banco (`findResumableCourtSession`: fase `playing` ou `set-decided`). A home entrega o valor uma só vez (`ResumeOnce.take()`) e redireciona; depois de "Sair do modo quadra" a home nova não encontra mais nada e não prende o usuário. Partida encerrada não retoma (a E4.10 trata a próxima). Voltar do Android numa quadra de partida encerrada leva de novo ao resultado; o voltar do fim do set sem histórico (abertura a frio) cai na quadra.

**Fila longa.** A faixa mostra no máximo 4 pílulas (`MAX_QUEUE_PILLS`, times inteiros primeiro, depois reservas) e um "+k" para o resto, para ela não quebrar em duas linhas.

**Texto e abertura do banco.** O `Text` base não aplica a escala de fonte do sistema (`allowFontScaling={false}`), porque os tokens já a aplicam com teto de 1,3. Se o banco não abre, o `DatabaseGate` mostra "Não conseguimos abrir o armazenamento" com "Tentar de novo". **Pendência E4.2/E4.7:** o `CourtRoster` de amostra (nomes de teste) ainda é o que vai no build de produção; o roster real, que funciona offline, vem com elas.

**Tela de desenvolvimento.** `/dev/court`, atrás de `EXPO_PUBLIC_DEV_TOOLS=1` (`src/config/dev-tools.ts`; também vale para `/dev/catalog`, que deixou de usar `__DEV__`): "Nova partida (1 set)" e "(melhor de 3)", tema, "Continuar partida" e "Encerrar quadra". Cada nova partida fecha a sessão aberta e chama `startCourtMatch` com os times de exemplo.

**Diferenças em relação ao design.** (1) O cadeado e o Menu ainda não têm a trava: o Menu abre segurando e o cadeado só aparece, com o rótulo "Tela travada" (sem prometer o "Segure para sair", que só existe na parte 3). (2) Sem o pulso do set point (parte 3). (3) A linha de ataque é uma linha SVG tracejada (`6 4`), não uma borda `dashed`, porque a borda tracejada de um lado só não é igual nos dois sistemas. (4) As posições do Azul na tela 09 vêm do catálogo (fonte única) e diferem do desenho até 0,4 em profundidade; as do Laranja batem com o design a 7%. (5) A tela 10 não é alcançável a partir de a1/b5 (com o Laranja sacando, os dois times giram o mesmo número de vezes); o teste usa as zonas iniciais 1 e 6.

## Pendente

Parte 3: trava e menu atrás do cadeado, bloqueio de 700 ms após o ponto, toque com a palma, toast do ponto, tela ligada, vibração, pulso do set point, tela de medição do Hermes. Parte 4: líbero na quadra (resposta à pergunta 14: o chip do líbero ocupa o lugar do central, cores invertidas e selo "Lí"; o modelo já marca `isLibero` no chip). E4.10: menu, correção, fim de set e de partida. Os nomes reais offline dependem da E4.2/E4.7.
