# Regras do front-end (app)

Restrições definidas pelo Gabriel em 07/11/2026. Valem para todo código em `apps/mobile` e são conferidas pelo analista no plano, pelo revisor e pelo testador. Desvio só com ADR aprovado pelo Gabriel.

## 1. Estado com registro único

Cada informação tem **um único lugar** onde é guardada. Ninguém mantém uma cópia dela.

- O que pode ser calculado a partir de outro estado é **derivado** (função pura ou seletor) e nunca guardado. Exemplos: o placar vem do log de eventos pelo `match-engine`, o "time completo?" vem da escalação e o rótulo de status vem do status.
- Dado do servidor fica só no cache do TanStack Query, sem cópia em `useState`, contexto ou store.
- Estado local de tela (campo em edição, aba aberta) fica no componente dono, e quem precisa recebe por props ou callback, sem espelhar.
- Estado do modo quadra fica só no log de eventos persistido (SQLite), e o estado da partida é sempre o replay desse log.
- Proibido: `useEffect` que copia uma prop ou um dado de consulta para outro estado, o mesmo dado em duas stores e flags que repetem o que outro estado já diz (como `isLoading` ao lado de um `status`).

## 2. Layout só com unidades relativas

O layout se adapta ao tamanho do aparelho, sem medidas fixas soltas.

- Estrutura com `flex`, porcentagens e `aspectRatio`. Nada de `width` ou `height` fixos em contêiner.
- Espaçamento, raio, tamanho de ícone e tipografia vêm dos **tokens**, e os tokens são **escalados** a partir das dimensões da janela (`useWindowDimensions`), tendo como base a largura do quadro do canvas. O componente nunca escreve um número em pixel.
- A tipografia respeita a escala de fonte do sistema (`fontScale`), com teto definido nos tokens para não quebrar o layout.
- **Exceção única, de acessibilidade:** os pisos mínimos ficam em dp, porque são exigência do `CLAUDE.md` e das diretrizes das lojas, e a escala nunca os reduz: alvo de toque ≥ 44 e linha fina de borda (hairline). Ficam declarados num lugar só, nos tokens.
- Testes conferem a escala em pelo menos três larguras (aparelho pequeno, médio e grande) e que os pisos se mantêm.

## 3. Programação orientada a interfaces

Quem usa depende de um **contrato** (`interface` ou tipo em TS), nunca de uma implementação concreta.

- Serviços (cliente da API, armazenamento local, relógio, vibração, tela ligada, compartilhamento, recorte de foto) são definidos como interface e entram por injeção (provider ou parâmetro). As telas e os hooks não importam o SDK ou o módulo nativo direto.
- Cada serviço tem uma implementação real e uma falsa para teste, ambas cumprindo a mesma interface.
- Props de componente são declaradas como `interface` com nome (`ButtonProps`), exportada junto do componente.
- A interface fica junto de quem a consome (na fatia ou em `src/ui`), e a implementação fica num adaptador separado.

## 4. Reducer pattern para estado com transições

Definida pelo Gabriel em 07/11/2026.

- Todo estado de tela com mais de um campo que muda junto, ou com transições (formulário de várias etapas, fluxo de sorteio, edição com confirmar e cancelar), usa `useReducer` com **ações tipadas** (união discriminada por `type`) e um **reducer puro**, num arquivo próprio e testado sem React.
- O reducer não tem efeito colateral: chamada à API, armazenamento, vibração e navegação ficam fora dele, nos serviços da regra 3, disparados pelo componente ou hook.
- O reducer é exaustivo: o `switch` cobre todas as ações, e o TS reprova ação nova sem tratamento.
- O estado do reducer segue a regra 1: guarda só o que não pode ser derivado.
- **Modo quadra:** usa só o reducer do motor (`EventApplier` e `replayEvents` do `match-engine`). A tela despacha eventos e mostra o estado do replay, sem um reducer próprio que repita as regras.
- **Dados do servidor:** ficam no TanStack Query, nunca copiados para um reducer.
- Estado simples, de um campo isolado (como um interruptor ou um texto de busca), pode usar `useState`.
