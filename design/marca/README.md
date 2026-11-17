# Marca: ícone do app

O ícone do Sacou é a **opção A** escolhida pelo Gabriel em 17/11/2026: silhueta azul-marinho (`#0F1B2D`) de uma jogadora sacando no salto, sobre laranja (`#FF5A1F`), com a bola amarela (`#FFC83D`). Decisão no [ADR 0059](../../docs/arquitetura/adr/0059-icone-do-app.md).

| Arquivo | O que é |
|---|---|
| `silhueta-origem.jpg` | A silhueta original, gerada pelo Gabriel no Gemini (Google), em preto. O "fundo transparente" xadrez está pintado na própria imagem |
| `gerar_icones.py` | O script que separa a silhueta (pixels escuros, borda suave) e a bola, aplica as cores e gera as três variações e as camadas do ícone adaptativo |
| `icone-loja-512.png` | O ícone em 512 px, para a ficha da Play Store |

No app: `apps/mobile/assets/icon.png` (ícone completo, 1024 px) e `apps/mobile/assets/adaptive-icon.png` (só a figura e a bola, fundo transparente, dentro da zona segura de 66/108; o fundo laranja vem do `backgroundColor` do `app.json`). A mesma camada serve de ícone monocromático do Android 13.

Para refazer: `python -I design/marca/gerar_icones.py design/marca/silhueta-origem.jpg <pasta de saída>` (Pillow e NumPy). Trocar o ícone pede APK novo.
