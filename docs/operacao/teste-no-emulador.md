# Teste no emulador (Android)

Pedido do Gabriel em 24/11/2026: **toda mudança de tela é conferida no emulador antes do merge**, para adiantar o teste no aparelho. O celular fica para o que o emulador não cobre: recorte de foto, câmera, vibração, push real, tela ligada e desempenho. A conferência entra na definição de pronto (item 6 do `CLAUDE.md`).

**Escopo: só o que a tarefa mexeu.** O roteiro cobre as telas e os estados que o PR alterou (e o caminho mínimo para chegar até eles), não o app inteiro. O resto já está coberto pelos testes e pela CI; a regressão geral fica para o percurso completo no fim do marco.

## Quem faz

O orquestrador manda a conferência a um `testador` (Sonnet) depois da revisão, com um roteiro curto: os passos da tela, o que tem de aparecer (texto exato) e o que capturar. O testador só usa o app e relata; não muda código.

## Ambiente

- AVD `Medium_Phone_API_37.0` do Android Studio (Android 17, imagem Google Play, aceleração WHPX), ligado com `-no-snapshot-load` quando o relógio do PC mudou.
- APK `development` do EAS instalado com `adb install` (traz x86_64). Dependência nativa nova exige APK novo.
- Banco (`docker compose up -d --wait`), API em `localhost:5080` e Metro em `localhost:8081`, como em [`teste-no-celular.md`](teste-no-celular.md); `adb reverse tcp:5080 tcp:5080` e `adb reverse tcp:8081 tcp:8081`.
- Abrir o app apontando para o Metro: `adb shell am start -a android.intent.action.VIEW -d "exp+sacou://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" com.sacou.app`.
- Login por e-mail e senha com conta de teste (`@example.com`), fora do repositório; o Google também funciona com uma conta logada no emulador.

## Como dirigir

`uiautomator dump` lista os textos visíveis e as coordenadas (mais barato que captura de tela); `adb shell input tap X Y`, `input text`, `input swipe`; `adb exec-out screencap -p` para a captura, reduzida antes de ler. Não usar `input keyevent 111` (ESC): fecha as folhas do app.

## Problemas já vistos

- **Relógio do Windows errado:** a API recusa todo token como `Expired` ("Sua sessão acabou"). Deixar o serviço de horário em automático (`w32tm /resync`) e reiniciar o emulador a frio.
- **Arquivos com data no futuro** depois de um relógio errado: o .NET e o Metro deixam de recompilar e a API roda um build antigo. Corrigir as datas (`touch` nos arquivos fora de `.git`) e recompilar.
- **Token do Google com data errada** guardado pelo Play Services: o login falha com "stale" até o token vencer; usar e-mail e senha nesse meio tempo.
- **Cache do app** gravado contra uma API velha: `adb shell pm clear com.sacou.app` e entrar de novo.
