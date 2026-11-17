# ADR 0059 · Ícone do app

**Status:** aceito (17/11/2026). **Decidido por:** Gabriel (escolha da opção A).

## Contexto

O app usava o ícone padrão do Android, visto no seletor de contas do Google durante o teste no celular (16/11). Não havia ícone no repositório nem nas telas de `design/mvp/`. O Gabriel quis uma silhueta de alguém sacando. Duas tentativas desenhadas em código (figura de palito e silhueta montada com traços) foram recusadas; uma imagem de banco de vetores sugerida como referência não foi copiada, porque esses bancos costumam proibir o uso como logo ou marca.

## Decisão

1. **A figura é a silhueta que o Gabriel gerou no Gemini** (`design/marca/silhueta-origem.jpg`), sem redesenho: o script `design/marca/gerar_icones.py` separa a figura e a bola e aplica as cores da marca.
2. **Opção A:** figura azul-marinho sobre laranja, bola amarela. As opções B (creme sobre azul-marinho) e C (sobre círculo laranja em creme) foram descartadas; a C perdia o contraste da bola.
3. **Android:** `icon` com o ícone completo; `adaptiveIcon` com a figura em fundo transparente (cerca de 96% do raio da zona segura de 66/108, conferido) sobre `backgroundColor` laranja; a mesma camada como `monochromeImage`.

## Consequências

- Trocar o ícone pede APK novo.
- Origem e direitos: imagem gerada pelo Gabriel numa ferramenta de IA; antes de publicar na loja, ele confere os termos de uso da ferramenta para uso comercial.
- Um ícone definitivo feito por designer pode substituir este sem mudar o código: basta trocar os dois PNG.
