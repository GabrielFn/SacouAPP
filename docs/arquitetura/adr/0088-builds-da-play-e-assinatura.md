# ADR 0088 · Build da Play: assinatura, contador de versão e app gratuito

**Status:** aceito (26/11/2026), E5.4 S1. **Decidido por:** Gabriel, ao aprovar o plano (respostas 245: esperar a produção, 246: Google + EAS, 247: só ele) ([plano](../../../.specs/features/E5.4/plan.md)), e o desenvolvedor dentro dele. **Emenda:** [ADR 0084](0084-feature-flags-e-versao-minima.md), D9.

## Contexto

O Sacou só chegava ao celular por APK solto (`preview` e `development`), instalado com "fontes desconhecidas" e com o `versionCode` subido à mão. A Play pede AAB, recusa para sempre um `versionCode` igual ou menor que um já enviado e fixa a chave de assinatura do app no primeiro envio.

## Decisão

- **Porta 1 · Assinatura (resposta 246).** Play App Signing: a **chave de assinatura do app** é gerada e guardada pelo Google. A **chave de upload** é a credencial remota do EAS (gerada no primeiro build `production`), e o Gabriel baixa uma cópia (`eas credentials` -> Android -> production -> Download keystore) para o gerenciador de senhas dele. Rejeitado: chave do app própria exportada com `pepk` (se vazar ou sumir, não há volta) e chave de upload só no disco local (nenhum agente gera build).
- **Porta 2 · Contador de `versionCode`.** `eas.json`: `cli.appVersionSource: "remote"` e `autoIncrement: true` no `production` e no `preview`. O EAS guarda um contador só, que sobe a cada build dos dois perfis; antes do primeiro build, `eas build:version:set` com 1 (o maior já usado). O `android.versionCode` do `app.json` fica, ignorado pelo EAS (a CLI avisa). Rejeitado: `local` à mão, que gera AAB recusado quando alguém esquece e repete número entre APK e Play.
- **Porta 4 · App gratuito.** No "Criar app" da Play Console: **Gratuito**, que não volta a pago. A assinatura futura (ADR 0046) é compra dentro do app.
- **Perfil `production`:** `environment: "production"` (lê as variáveis do ambiente `production` do EAS), `distribution: "store"`, `android.buildType: "app-bundle"`, `EXPO_PUBLIC_SENTRY_ENVIRONMENT: "production"` e **sem** `EXPO_PUBLIC_DEV_TOOLS`, `SENTRY_DISABLE_AUTO_UPLOAD` nem `SENTRY_ALLOW_FAILURE` (o build falha se os mapas de código não sobem). Conferido por `scripts/lib/eas-config.test.mjs`, no `pnpm test:tooling`.
- **API do AAB (resposta 245):** o `EXPO_PUBLIC_API_URL` do ambiente `production` do EAS é a API de **produção** (`https://sacou-api-804880427435.us-east4.run.app`, a confirmar no primeiro deploy). O AAB só é gerado e enviado depois do primeiro deploy de produção, que é decisão do Gabriel (resposta 248).

## Consequências

- O APK solto e o app da Play têm assinaturas diferentes e não se atualizam um sobre o outro: quem tem o APK desinstala antes.
- O login com o Google no app da Play exige a impressão SHA-1 da chave do Google no Firebase e na restrição da chave de API do Android ([`google-play.md`](../../operacao/google-play.md), "Roteiro do Gabriel").
- A versão mínima (ADR 0084) continua lendo o `nativeBuildVersion`, que é o número real do binário.
