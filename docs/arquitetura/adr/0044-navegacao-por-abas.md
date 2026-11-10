# ADR 0044 · Navegação por abas no app

**Status:** aceito (10/11/2026). **Tarefa:** E4.4. Plano: [`E4.4.md`](../../estado/tarefas/E4.4.md).

## Contexto

As telas 03, 17 e 30 do canvas têm uma barra de três abas (Início, Grupo, Eu) com um desenho próprio: ícone sobre rótulo e uma pílula laranja atrás do ícone da aba ativa. O `Tabs` padrão do `expo-router` usa `@react-navigation/bottom-tabs`, que não está no app e desenha outra barra.

## Decisão

As abas usam o `Tabs`, `TabList`, `TabTrigger` e `TabSlot` de `expo-router/ui`, que já vêm no `expo-router` 58.0.30 (**sem dependência nova**), com a barra própria de `src/ui/TabBar.tsx` (`TabBarFrame` e `TabBarItem`). O grupo `src/app/(tabs)/` tem `index` (Início), `groups` (Grupo) e `me` (Eu). A tela de notificações fica fora das abas, em `src/app/notifications.tsx`, e abre pelo sino do Início.

- `TabBarItem` recebe `isFocused` e `onPress` do `TabTrigger asChild`, tem `accessibilityRole="tab"` e `accessibilityState.selected`, alvo de pelo menos 44 e respeita a área segura de baixo.
- O estado da aba ativa é do roteador (regra 1 do `frontend.md`): nada o copia.
- A retomada da quadra (E4.9) continua no efeito do Início; as outras abas não a disparam.

## Alternativas descartadas

`Tabs` do `expo-router` com `@react-navigation/bottom-tabs` (pacote novo e barra diferente do canvas); `Stack` com `router.replace` entre abas (perde a rolagem de cada aba).

## Consequências

A API de `expo-router/ui` é mais nova que a de abas do React Navigation: ao subir a versão do Expo Router, conferir `TabTrigger asChild`.
