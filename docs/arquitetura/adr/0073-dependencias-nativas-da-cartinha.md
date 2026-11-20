# ADR 0073 · Dependências nativas da cartinha (imagem e galeria)

**Status:** aceito (20/11/2026). **Tarefa:** E4.13 Parte 2 (tela 15). Plano em [`docs/estado/tarefas/E4.13.md`](../../estado/tarefas/E4.13.md).

## Contexto

A tela 15 exporta a cartinha como imagem: "WhatsApp" abre a folha de compartilhar do sistema e "Salvar" grava na galeria. O app não tinha como transformar uma view em PNG nem como escrever na galeria.

## Decisões

**D1 · `react-native-view-shot` para a captura.** Captura a view da cartinha (a que a pessoa vê, inclusive com o interruptor "Mostrar estatísticas" desligado) em PNG de 1080 px de largura, arquivo temporário no cache privado do app. É o pacote padrão do ecossistema Expo, com versão fixada pelo SDK (`expo install`). Alternativa descartada: desenhar a imagem de novo em canvas (duplicaria o desenho da cartinha).

**D2 · `expo-media-library` para o "Salvar", só escrita.** Pede apenas permissão de escrita (`writeOnly`); o app nunca lê a galeria. Nenhuma permissão de leitura entra no manifesto (`READ_EXTERNAL_STORAGE` e `WRITE_EXTERNAL_STORAGE` seguem em `blockedPermissions`; no Android 10 ou superior o MediaStore dispensa a de escrita). A recusa vira a mensagem com atalho para os ajustes.

**D3 · Portas.** `CardImageCapture`, `ImageShare` e `GallerySaver` são interfaces em `features/profile/ports/`, com adaptadores em `src/adapters/` e falsos para teste. A folha de compartilhar usa `expo-sharing` (já no app) por uma porta nova, `ImageShare`, porque a `FileShare` da E4.3 escreve texto JSON e não carrega imagem.

**D4 · Privacidade.** O PNG é apagado depois de compartilhar, salvar ou falhar. Sem rating, nível ou nota do admin na imagem (ADR 0047).

## Consequências

As duas dependências são nativas: o celular precisa de um **build de desenvolvimento novo** (`eas build --profile development`) para testar a tela 15. O Expo Go e builds antigos não têm os módulos.
