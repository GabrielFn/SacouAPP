# Padrões do app

Como organizar e escrever o código de `apps/mobile/src`. Decisões e motivos no [ADR 0034](../arquitetura/adr/0034-arquitetura-do-app-e-metricas.md). As regras de código gerais estão em [`codigo.md`](codigo.md).

## Pastas

```
apps/mobile/src/
  app/                    rotas do Expo Router: só montam a tela
  features/<feature>/
    screens/              telas da feature
    components/           componentes só da feature
    hooks/                a ponte entre a tela e os dados
    api/                  chamadas da API da feature
    state/                estado de interface compartilhado (Zustand)
  ui/                     design system
    tokens/               cores, tipografia, espaçamento, raios
    theme/                temas Sol e Noite
    <Componente>.tsx      componentes base (botão, campo, cartão...)
  lib/                    infraestrutura: cliente da API, Query, SQLite
  strings/                textos da interface em pt-BR
```

Nome da feature em kebab-case (`court`, `round-presence`). O que duas features usam sobe para `ui/` (se é interface) ou `lib/` (se é infraestrutura).

## Imports e fronteiras

Quem sai da própria pasta importa pelo alias `@/` (`@/ui/Button`, `@/features/court/hooks/useScore`). `./` só para a mesma pasta. `../` reprova.

| Pasta | Não pode importar |
|---|---|
| `ui/` | `@/features`, `@/lib`, `@/app` |
| `features/<a>/` | `@/features/<b>` (outra feature) |
| `features/*/screens/` e `features/*/components/` | `@/lib` e `@/features/*/api`: dados chegam pelos `hooks/` da feature |
| `app/` | qualquer `@/` fora de `@/features/*/screens` |
| `packages/*` | React, Expo, React Native, o app (já valia, ADR 0002) |

`app/` também não importa `ui/` nem `strings/`: a rota só monta a tela, e a tela cuida do resto.

## Componentes

- **Um componente por arquivo**, com o nome do arquivo igual ao do componente, em PascalCase (`ScoreBoard.tsx` exporta `ScoreBoard`). Subcomponente vai para arquivo próprio na mesma pasta. Reprovado por `react/no-multi-comp`; o nome do arquivo fica com o revisor.
- **Tamanho:** `.tsx` com até 200 linhas de código e funções com até 80; `.ts` com até 300 e 50. Passou, divide.
- **Sem estilo inline:** `style={{ ... }}` reprova, também dentro de array (`style={[styles.a, { ... }]}`). Estilo só por Unistyles, com tokens do tema. Variantes e estilos dinâmicos (`styles.button({ size })`) passam.
- **Sem cor solta:** `#hex`, `rgb(`, `rgba(`, `hsl(` e `hsla(` em texto reprovam fora de `ui/tokens/`. A cor vem do tema.
- **Toque e acessibilidade pelo design system:** fora de `ui/`, `Pressable`, `TouchableOpacity`, `TouchableHighlight` e `TouchableWithoutFeedback` reprovam (de `react-native` e de `react-native-gesture-handler`), e `import * as` desses pacotes também. A feature usa os componentes de `ui/`, que garantem alvo de 44 px e rótulo de acessibilidade.
- **Textos:** sempre de `strings/`, nunca escritos no componente.

## Estado

| Dado | Onde |
|---|---|
| Dado da API | TanStack Query, chamado pelos `hooks/` da feature, com a chamada em `api/` |
| Estado de interface compartilhado entre telas | Zustand, em `features/<feature>/state/` |
| Estado de uma tela só | `useState` no próprio componente |
| Log de eventos da quadra | expo-sqlite, por `lib/` |
| Motor da partida (`@sacou/match-engine`) | só pelos `hooks/` da feature da quadra |

## Tokens e temas

A E4.1 extrai das telas (`design/telas/`) as cores, a tipografia, o espaçamento e os raios para `ui/tokens/`, com os temas Sol e Noite em `ui/theme/`. As 7 cores dominantes do design são `#0F1B2D`, `#4A5566`, `#FFFFFF`, `#FF5A1F`, `#F6F1E7`, `#1F5BFF` e `#FFC83D`; fontes Barlow Condensed e Inter. Contraste AA e alvo de toque de 44 px são conferidos nos componentes de `ui/`.

## Testes

React Native Testing Library, instalada na E4.1 com os primeiros componentes. Ver [`testes.md`](testes.md).

## Conferido por

`pnpm lint` (regras acima) e `pnpm lint:regression` (casos que reprovam e que passam). A lista de regras está em [`codigo.md`](codigo.md).
