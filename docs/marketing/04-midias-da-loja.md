# 04 · Mídias da loja

Tamanhos e regras conferidos na ajuda do Google Play em 19/11/2026 ([fonte](https://support.google.com/googleplay/android-developer/answer/9866151)). Reconferir no dia de publicar.

## Resumo das especificações

| Peça | Especificação | Situação |
|---|---|---|
| Ícone | PNG 32 bits com alfa, 512 × 512 px, até 1.024 KB | Pronto: `design/marca/icone-loja-512.png` (ADR 0059) |
| Imagem de destaque | JPEG ou PNG 24 bits **sem** alfa, 1.024 × 500 px | A produzir |
| Capturas de celular | 2 a 8, PNG ou JPEG, até 8 MB, lados entre 320 e 3.840 px, 9:16 ou 16:9. Para poder ser destacado: **pelo menos 4 com 1.080 px ou mais** (1.080 × 1.920 em pé) | A produzir: 8 |
| Capturas de tablet | Opcionais (mínimo 4 se enviar) | Não enviar no lançamento |
| Vídeo | URL do YouTube, público ou não listado, sem anúncios, sem restrição de idade, incorporável. Só os 30 primeiros segundos tocam sozinhos | Roteiro em `05-videos.md` |

Regras de conteúdo das imagens: mostrar o app de verdade; sem "melhor", "nº 1", "grátis", prêmio ou depoimento; sem "baixe agora"; **a legenda ocupa no máximo 20% da imagem**; sem marca de terceiros (inclusive logo do WhatsApp e selo do Google Play); barra de status limpa (bateria cheia, sinal cheio, sem notificações).

## Cores e tipografia

| Papel | Cor |
|---|---|
| Laranja Sacou (fundo principal) | `#FF5A1F` |
| Azul-marinho (texto e figura) | `#0F1B2D` |
| Creme (fundo claro) | `#F6F1E7` |
| Amarelo bola (detalhe) | `#FFC83D` |

Fonte das legendas: a mesma do app, ou uma sem serifa grossa de uso livre (por exemplo Inter ou Archivo, do Google Fonts, licença aberta). Peso negrito, no máximo 2 linhas.

## Ícone

Já decidido (ADR 0059): silhueta azul-marinho sacando, sobre laranja, bola amarela.

- Sem texto, sem selo, sem "novo" ou "grátis".
- **Pendência do Gabriel:** conferir os termos de uso comercial da ferramenta que gerou a silhueta, antes de publicar.
- Opcional, com gasto: redesenho por designer (ver `09-orcamento.md`). Não é necessário para lançar.

## Imagem de destaque (1.024 × 500)

Aparece no topo da ficha quando há vídeo e em destaques da loja.

- **Fundo:** laranja `#FF5A1F` liso (o Google pede para evitar branco puro, preto e cinza escuro).
- **Esquerda:** a silhueta do ícone, grande, em azul-marinho, com a bola amarela.
- **Centro e direita:** "Sacou" em azul-marinho e, embaixo, "O app do racha de vôlei." em creme.
- Elementos importantes dentro da faixa central (as bordas podem ser cortadas). Sem captura de tela, sem preço, sem chamada para baixar.
- Exportar em PNG 24 bits **sem transparência** ou JPEG.
- Texto alternativo (até 140 caracteres): `Sacou, o app do racha de vôlei: silhueta de jogadora sacando sobre fundo laranja.`

## Conjunto de capturas (8, em pé, 1.080 × 1.920)

A ordem conta: as 3 primeiras aparecem sem rolar. Começa pelo diferencial (a quadra) e fecha com a porta de entrada do jogador.

| # | Tela do app (`design/mvp/`) | Legenda (texto na imagem) | O que precisa aparecer |
|---|---|---|---|
| 1 | 09 Modo quadra · Sol (`QuadraSol`) | **Placar, rotação e fila na mesma tela** | Placar 18 × 15, time sacando, fila com 2 reservas |
| 2 | 11 Fim de partida (`FimPartida`) | **Quem perde sai. O app diz quem entra** | "Saem" e "Entram" com 2 nomes de cada lado |
| 3 | 07 Sorteio (`Sorteio`) | **Times equilibrados em um toque** | Dois times, medidor "ótimo" |
| 4 | 26 Rodada · visão do jogador (`RodadaJogador`) | **Lista de presença com espera automática** | Lista cheia e alguém na espera |
| 5 | 12 Resumo da rodada (`Resumo`) | **MVP do dia e resumo pra mandar no grupo** | MVP, time que mais venceu, sequência |
| 6 | 15 Compartilhar cartinha (`Cartinha`) | **Sua cartinha com os números do jogo** | Cartinha com avatar e estatísticas |
| 7 | 04 Criar grupo · modelo (`CriarModelo`) | **Seu racha, suas regras** | Os modelos: Pelada, Racha organizado, Treino, Areia |
| 8 | 01 Página da rodada (`Main`), no navegador | **A galera confirma pelo link, sem instalar** | Página web com VOU e NÃO VOU |

Reserva, se alguma não ficar boa: 10 Modo quadra · Noite (`QuadraNoite`, "Legível no sol e na quadra coberta") e 12b Resumo · areia (`ResumoAreia`, "Areia rei da quadra com ranking do dia").

**Atenção em cada captura**

- **Captura 1:** o modo quadra real é em **paisagem** (decisão de 13/11/2026), diferente do desenho 09. Montar a captura deitada dentro da arte em pé, sem girar o conteúdo (ver "Moldura"). Sem cadeado e sem toast "+1".
- **Captura 3:** a tela do admin mostra as notas. Usar notas inventadas e manter visível a frase "Só admins veem as notas", ou cortar a coluna de notas na composição.
- **Capturas 4 e 8:** não mostrar valor em reais, "Pagar" ou Pix (pós-piloto).
- **Captura 6:** sem nota nem faixa (Bronze, Prata...), que ficam escondidas no piloto.
- **Em todas:** nada de selo "Pro", preço ou recurso que não está no piloto.

## Dados fictícios (obrigatório)

Nunca capturar um grupo real. Criar no ambiente de teste um grupo só para as peças:

| Item | Usar |
|---|---|
| Grupo | "Racha de terça" (quadra) e "Areia de sábado" (areia) |
| Local | "Quadra do Parque" (genérico, sem nome de arena real) |
| Jogadores | Ana, João, Pedro, Lia, Marcos, Bia, Rafa, Duda, Caio, Nina, Léo, Gabi, Davi, Sofia (os mesmos das telas de `design/mvp/`) |
| Times | Laranja e Azul |
| Conta | Uma conta de teste, sem e-mail pessoal visível em nenhuma tela |

## Moldura e estilo

- **Formato:** arte 1.080 × 1.920. Faixa de cima (até 20% da altura, cerca de 380 px) com a legenda; embaixo, a captura dentro de um contorno simples de celular (retângulo de cantos arredondados, sem marca de aparelho).
- **Fundo:** alternar laranja e creme entre uma captura e a seguinte, para dar ritmo ao rolar. Legenda em azul-marinho nos dois fundos (contraste suficiente).
- **Captura 1 (paisagem):** celular deitado ocupando a largura, centralizado na metade de baixo; a legenda em cima. Não girar a captura em 90°.
- **Legenda:** até 2 linhas, até cerca de 40 caracteres, sem ponto final nas de uma linha.
- **Texto alternativo** de cada captura (até 140 caracteres): descrever a tela, por exemplo `Placar de vôlei 18 a 15 com a rotação dos dois times e a fila de reservas.`

## Como produzir sem gastar

1. **Preparar o app:** build de desenvolvimento apontando para o ambiente de teste, com o grupo fictício acima e uma rodada jogada até o fim (para ter resumo e cartinha).
2. **Barra de status limpa (modo demonstração do Android, pelo cabo):**

   ```sh
   adb shell settings put global sysui_demo_allowed 1
   adb shell am broadcast -a com.android.systemui.demo -e command enter
   adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 1900
   adb shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false
   adb shell am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4
   adb shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false
   ```

   Para sair: `adb shell am broadcast -a com.android.systemui.demo -e command exit`.
3. **Capturar:** `adb exec-out screencap -p > 01-quadra.png` (uma por tela), ou os botões do próprio celular.
4. **Montar:** Figma (plano gratuito) ou Canva (plano gratuito, só com elementos gratuitos e sem fotos de banco). Um arquivo com 8 pranchas de 1.080 × 1.920 e a de 1.024 × 500.
5. **Exportar:** PNG. Conferir tamanho (até 8 MB) e que a imagem de destaque não tem transparência.
6. **Guardar** os arquivos finais em `design/loja/` (pasta nova, em PR próprio), para refazer quando a tela mudar.

Alternativa sem ferramenta de design: uma página HTML simples que monta as 8 artes a partir das capturas, impressa pelo navegador em 1.080 × 1.920. Dá para pedir a um agente desenvolvedor numa tarefa curta, depois do M6.

**Quando refazer:** a cada mudança visível nas telas das capturas 1 a 3, e quando o Pro entrar.
