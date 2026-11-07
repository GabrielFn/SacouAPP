# ADR 0034 · Estilos, temas e escala no app

Data: 07/11/2026 · Tarefa: E4.1 · Status: aceito

## Contexto

A E4.1 precisava de um motor de estilos com temas. A candidata era o `react-native-unistyles` 3.8.1 (peer `react-native >=0.85`, então o RN 0.88 está dentro do declarado). Em 07/11 o Gabriel também fixou regras de front-end (`docs/padroes/frontend.md`): tokens escalados pela largura da janela, estado com registro único e serviços atrás de interfaces.

## Prova do P0 e decisão

A prova de resolução e de suporte declarado passou, mas o Unistyles 3 exige quatro módulos nativos de peer (`react-native-nitro-modules`, `react-native-reanimated`, `react-native-edge-to-edge`, que o npm marca como **deprecated**, e `@react-native/normalize-colors`) e um dev build. A compilação nativa não pode ser provada sem celular (`expo export` só empacota JS). Além disso, o ganho do Unistyles (estilos resolvidos no C++ sem re-render) não vale aqui: os tokens passam a depender de `useWindowDimensions` e `fontScale`, ou seja, de um hook de qualquer forma.

**Escolha: plano B.** `StyleSheet` do React Native com um `ThemeProvider` próprio (`apps/mobile/src/theme/theme-context.tsx`). O provider recebe só o **nome** do tema (registro único da escolha), deriva as cores (`themes.ts`) e os tokens escalados (`scale.ts`) e os entrega em `useTheme()`. Os componentes de `src/ui` só leem papéis e tokens, nunca hex nem número solto. Trocar por Unistyles depois fica restrito a `src/theme/`.

Gatilho para revisitar: medir jank real de re-render do tema no modo quadra num aparelho de entrada, ou o Unistyles remover a dependência de `react-native-edge-to-edge`.

## Temas (perguntas 9 e 10 de `perguntas.md`)

- `app` (Areia), `courtSun` e `courtNight`. Sol/Noite só no modo quadra; o resto do app é sempre Areia.
- Fundo do Noite `#000000`, como no canvas (tela 10), e não `#0F1B2D` de `produto.md:151`. Muda um token (`courtPalette`).

## Adaptação às regras de front-end

- Os pixels do canvas (largura de quadro 390) são a **base** da escala, não tamanhos literais: `createScaledTokens({ windowWidth, fontScale })` multiplica espaçamento, raio, borda, ícone e fonte por `largura/390` (limitado a 0,85 a 1,4). A fonte respeita `fontScale` com teto 1,3.
- Pisos de acessibilidade em dp, declarados uma vez em `accessibilityFloors` (alvo de toque 44, linha fina 1) e nunca reduzidos pela escala. Testes em três larguras (320, 390, 600).
- Layout só com `flex`; alturas dos controles são `minHeight` vindas dos tokens.
- Serviços atrás de interface: `FontLoader` (`src/services`), com adaptador real (`expo-font`) e falso, injetado por `ServicesProvider`. Props são `interface` exportadas.

## Fontes

Inter 4.1 (rsms/inter, `extras/ttf`) e Barlow Condensed (jpt/barlow), TTF estáticos e licença OFL em `apps/mobile/assets/fonts/`, carregadas do bundle (sem Google Fonts). SHA-256:

- BarlowCondensed-SemiBold `31f11ff391c790a36b977fc01e0880656762ac26f6634a0e6ff4f80c7d4c534f`
- BarlowCondensed-Bold `84b4ccb588c419b8236907d021101bd517d7a05b33d4f0d21ee57ea39f36c885`
- BarlowCondensed-ExtraBold `fc79e7e0bc036a5471fd6b52b7d8d102062aad00d55a85ce28cc2d0511de5cec`
- Inter-Regular `40d692fce188e4471e2b3cba937be967878f631ad3ebbbdcd587687c7ebe0c82`
- Inter-Medium `97ad806f526e41546d46365bb3a393145f75b7b1568913db74549ad8b8dba872`
- Inter-SemiBold `78a843fade9d4612a5567302fb595b56976eb5fcebf4fea5a5912d638bafcde3`
- Inter-Bold `288316099b1e0a47a4716d159098005eef7c0066921f34e3200393dbdb01947f`

## Consequências

- Sem teste de render nesta tarefa; "iguais ao canvas" fica em tokens golden, contraste e revisão. O catálogo (`/dev/catalog`, só em `__DEV__`) é conferido no primeiro dev build.
- `decisoes.md` e `adr/0001` ganham a referência a este ADR.
