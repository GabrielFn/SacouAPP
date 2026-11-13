# ADR 0052 · Modo quadra em paisagem

**Status:** aceito (13/11/2026). **Tarefa:** E4.17, parte 1. Plano em [`docs/estado/tarefas/E4.17.md`](../../estado/tarefas/E4.17.md); layout aprovado pelo Gabriel em [`E4.17-paisagem.html`](../../estado/tarefas/E4.17-paisagem.html).

## Contexto

No teste no celular de 13/11/2026 o retrato da quadra teve três defeitos: chips de nome sobrepostos e cortados na borda, a linha da faixa central cortada pela linha da quadra e o toast "+1" confuso. O celular fica apoiado durante o jogo, então o Gabriel decidiu que o modo quadra fica **sempre em paisagem, travado**, e o resto do app continua em retrato.

## Decisões

1. **Trava só em `court/**`.** O `_layout` da quadra chama `useLandscapeWhileMounted`: `lockLandscape` ao montar, `lockPortrait` ao desmontar, por uma porta `ScreenOrientation` (adaptador `expo-screen-orientation`, `OrientationLock.LANDSCAPE` nos dois lados e `PORTRAIT_UP` na volta, nunca `unlockAsync`, que deixaria o app inteiro girar). Menu, Corrigir, fim de set e fim de partida são rotas do mesmo `_layout`: o celular não gira entre elas. Elas também ficam em paisagem, com rolagem e largura máxima (`tokens.court.sizes.sheetMaxWidth`), sem redesenho. `app.json` mantém `orientation: "portrait"` (no Android a trava em tempo de execução vale mais que o manifesto). Quando o iOS entrar, precisa de `orientation: "default"` e do plugin com `initialOrientation: "PORTRAIT_UP"`.
2. **O layout vem da janela, não de uma cópia da orientação.** `computeCourtLayout` devolve `landscape` quando `largura > altura`, senão `portrait` (um quadrado conta como retrato). O retrato continua como **reserva**: tablet com Android 16 (que ignora a trava em telas largas), tela dividida e trava que falhou. A falha da trava não derruba a quadra.
3. **Escala pelo lado menor.** `ThemeProvider` passa `shortSide(largura, altura)` para os tokens: o mesmo aparelho dá os mesmos tokens em pé ou deitado (sem isso tudo cresceria 2,16 vezes na paisagem). Em retrato nada muda.
4. **Medidas da paisagem** (`court.data.ts`, do esboço aprovado, 844 × 390): altura barra 44, meio 294, fila 52; largura Time A 366, rede 112, Time B 366; coluna do time 122 (114 de texto mais 8 de folga que o placar pode usar), margem 12, quadrado 232 encostado na rede (medidas do esboço; veja os ajustes de 13/11/2026 abaixo, que valem hoje). O placar tinha 45% da altura da zona (hoje 38%); num aparelho menos largo (640 × 360) a coluna cresce e o quadrado cede a diferença.
5. **Chips sem sobreposição, sem medir depois de desenhar** (`model/chip-placement.ts`, `model/team-chips.ts`). A caixa do chip é conhecida: altura de `sizes.chip` e largura estimada pelo nome (letras × `CHIP_CHAR_WIDTH_EM`), no máximo `CHIP_MAX_WIDTH_RATIOS` do lado do quadrado (110/232 em paisagem; 0,3 no retrato de reserva); acima disso o nome termina em "…". O ponto da formação (`formations.json`) é virado para o lado da tela (`placeOnHalfCourt`, agora com `left` e `right`), e uma função pura mantém cada caixa dentro da zona, sem cruzar a rede, sem cobrir a coluna do time e afastada das outras. Os pares são empurrados pelo eixo mais curto (ou só em x, ou só em y); se ainda sobrar cobertura, cada chip, em ordem de `MemberId`, toma o ponto livre mais próximo. Sem aleatoriedade: o mesmo estado dá sempre a mesma tela. O sacador fica atrás da linha de fundo quando a coluna deixa; com a coluna alta (set point) é empurrado para dentro.
6. **Nomes curtos** (`model/display-names.ts`). Na quadra: o primeiro nome. Se dois dos 12 em quadra ou da fila têm o mesmo primeiro nome (sem acento e sem caixa), "Ana C."; se ainda repetir, o começo do segundo nome cresce uma letra por vez ("Ana Ca.", "Ana Cl."). Nome de uma palavra fica como está. O nome inteiro continua no modelo (`name`) e vai ao leitor de tela (rótulo do chip, rótulo da fila, `serverName` da zona).
7. **Sem toast "+1".** Removidos o toast, `POINT_TOAST_MS`, o `toastUntil` do guard e o texto: quem marca sabe para quem foi o ponto. A área central da barra de cima mostra a dica ("Posições no momento do saque", set point). O "+1" confuso (defeito c) deixa de existir.
8. **Build.** `expo-screen-orientation` é módulo nativo (SDK 58, funciona no Expo Go SDK 58). Um build de desenvolvimento ou APK **gerado antes** desta tarefa não o tem.

## Consequências

- A bateria baixa e "Inverter lados" ficam para a parte 2 (a faixa amarela toma o lugar da fila; "uma vez por quadra aberta", reducer próprio).
- A fila em uma linha limita a pílula (`QUEUE_PILL_MAX_WIDTH_RATIO`) e continua com `MAX_QUEUE_PILLS`.
- Sem renderer de componentes no projeto: o layout é conferido por funções puras (`computeCourtLayout`, `placeChips`) e pelo roteiro do celular.

## Ajustes do teste no celular de 13/11/2026 (E4.17)

- **Quadra maior a pedido do Gabriel, com placar menor.** Em 844 x 390 a zona do time passou de 366 para 382, a rede de 112 para 80 (nunca menos que `NET_MIN_WIDTH` = 68, para os botões terem 44 ou mais e não vazarem sobre as zonas) e a margem de 12 para 4. O placar passou de 45% para 38% da altura da zona (decisão do Gabriel, que prefere a quadra maior); a coluna do time encolheu de 122 para 103. O quadrado da meia quadra foi de 232 para 275 (cerca de 19%). O critério de 45% de `produto.md:134` vale agora só no retrato.
- **Encostada na rede.** O quadrado é ancorado à rede pelo próprio estilo (`right: 0` no time da esquerda, `left: 0` no da direita; `bottom`/`top` no retrato) e a coluna da rede tem largura exata (`layout.netWidth`), então não sobra vão; teste de layout com tolerância zero.
- **Nomes.** A largura estimada usa 0,72 da fonte por letra, 0,9 para maiúsculas, 1,04 para M e W e 1,0 para o "…" (a fonte é a mesma, `chipNameFontSize`, nos dois lados; `ellipsizeMode="tail"` fica como rede de segurança); só uma letra seguida de ponto conta como abreviação; a abreviação "Ana C." encurta o primeiro nome antes da inicial; o limite do chip nunca fica abaixo do necessário para 8 letras; o "…" é o caractere de reticências, calculado no modelo.
- **Sacador.** Os limites da zona têm margem (`CHIP_ZONE_MARGIN`) das bordas, para o chip não encostar na barra nem na fila.
- **Desfazer apagado** usa preenchimento sólido (`courtDisabledFill`, #767676, igual nos dois temas, AA contra os rótulos branco e preto), sem transparência, para a malha da rede não aparecer.
- **Desempenho.** `HalfCourt` guarda o posicionamento com `useMemo`; a busca em grade anda de 2 em 2 `chipGap` e as estratégias de empurrão são tentadas só até uma deixar tudo limpo.
