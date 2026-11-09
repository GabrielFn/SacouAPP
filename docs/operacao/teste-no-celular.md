# Teste no celular (Android)

Roteiro do modo quadra (E4.9, parte 3) e passo a passo do APK de teste. O APK usa o perfil `preview` do EAS: modo de produção (Hermes), com as telas de desenvolvimento ligadas (`EXPO_PUBLIC_DEV_TOOLS=1`). Não tem segredo nenhum no repositório.

## Gerar o APK (uma vez, no computador)

Pré-requisito: conta grátis em https://expo.dev (perguntas.md, pergunta 15). No Git Bash, na raiz do repositório:

```sh
cd apps/mobile
npx eas-cli@27.5.0 login                              # pede e-mail e senha da Expo, direto no terminal
npx eas-cli@27.5.0 init                               # liga o projeto à conta e grava o projectId no app.json (commitar)
npx eas-cli@27.5.0 build --platform android --profile preview
```

O build roda na nuvem (fila grátis, 10 a 30 minutos). No fim, o terminal mostra um link e um QR code: abra o link no celular Android, baixe o APK e instale (o Android pede para permitir "fontes desconhecidas" uma vez). Ficha: pacote `com.sacou.app`, sem backup automático, só em retrato.

Depois do build, confira as permissões do APK (o `aapt` vem no Android SDK build-tools): `aapt dump permissions <apk>`. O esperado é `com.sacou.app` com `android.permission.VIBRATE` (e as que o Expo adiciona sozinho, como `INTERNET`), sem `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE` nem `WRITE_EXTERNAL_STORAGE`.

Se o build falhar, mande o link da página do build (ou a última tela de erro) para o orquestrador.

## Roteiro de 10 minutos

Veja `docs/estado/tarefas/E4.9.md`, seção 6 (é o mesmo texto). Anote o **modelo do celular** e a **versão do Android**.

## Depois do teste

O orquestrador registra os números em `docs/arquitetura/adr/0038-log-local-da-quadra.md` e o que falhou no `progresso.md`. A E4.9 só passa a "Feita" depois deste roteiro.
