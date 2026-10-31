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
- Lateral: 4 à esquerda de 3, 3 à esquerda de 2; 5 à esquerda de 6, 6 à esquerda de 1. **Não pode empatar.**
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
- Saque inicial: sorteio no 1º e no 5º set; nos outros, alterna.

## Sistemas de jogo

Escalação base, na ordem das posições 1 a 6 na rotação 1: Levantador, Ponteiro 1, Central 1, Oposto, Ponteiro 2, Central 2. Cada função fica na diagonal do seu par (convenção de treinador, não regra).

| Sistema | Composição | Quem levanta | Rotações |
|---|---|---|---|
| Livre / 6x0 (grátis) | 6 jogadores sem função | Quem estiver na posição 3 | Uma formação base |
| 4x2 (Pro) | 2 levantadores em diagonal, 2 ponteiros, 2 centrais | O levantador da rede | Levantador na rede (4, 3, 2), repetidas |
| 6x2 (Pro) | 2 levantadores-atacantes em diagonal, 2 ponteiros, 2 centrais | O do fundo (infiltra); o da rede ataca | Levantador no fundo (1, 6, 5), repetidas |
| 5x1 (Pro) | 1 levantador, 1 oposto, 2 ponteiros, 2 centrais, líbero | Sempre o mesmo; infiltra no fundo | As 6 |

### Numeração das rotações
Existem duas convenções. O app guarda a posição do levantador (`setterZone`, 1–6) e chama de "rotação N" o levantador na posição N. Girando, a sequência é **1 → 6 → 5 → 4 → 3 → 2**. Treinadores americanos numeram em sequência (rotação 1 = levantador sacando, rotação 2 = levantador na 6…); as duas só coincidem na 1 e na 4.

### Recomendação para pelada
Times sorteados: Livre/6x0 ou 4x2 com recepção em W de 5 passadores. 5x1 com 3 passadores só para times fixos e com líbero.

## O que o motor valida

**Erro (bloqueia):**
- Seis jogadores por time, cada posição ocupada uma vez.
- Girar só quem venceu recebendo; nunca quem venceu sacando.
- Sacador é sempre quem está na posição 1 depois do giro.
- Sobreposição só nas 6 relações oficiais, só no time que recebe (modo FIVB), com tolerância configurável (padrão 0,02 ≈ 18 cm).
- Líbero só no fundo, nunca sacando, sai ao chegar na 4, troca só com quem substituiu.
- Tie-break: troca de lado aos 8 sem girar.

**Aviso (só informa):**
- Levantador na rede (2, 3, 4): não infiltra; pode bloquear e atacar.
- Levantador no fundo: não bloqueia nem ataca acima da rede na zona de frente.
- Rotação 4 sem empilhar: corrida longa do levantador. Rotação 1: infiltração mais longa.
- Funções fora da diagonal (dois levantadores lado a lado).
- Regras da casa (entra no saque, substituições livres) sempre como configuração, nunca como regra.

## Erros comuns de implementação
- Misturar as duas numerações de rotação.
- Guardar o líbero dentro da ordem de rotação.
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
