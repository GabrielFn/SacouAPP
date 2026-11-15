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

## Login e sessão (E4.3, Parte 1)

APK novo: a Parte 1 traz módulos nativos (Firebase, Google Sign-In). O teste real só funciona depois dos passos do console do [ADR 0057](../arquitetura/adr/0057-login-e-sessao-no-app.md), seção "Configuração do build" (pergunta 57). Nenhum valor passa pelo chat.

**Antes do build (Gabriel, uma vez):**

1. Firebase `sacou-79493` → Authentication → Provedores: **Google** e **E-mail/senha** ligados, e a **proteção contra enumeração de e-mails** ligada.
2. SHA-1 e SHA-256 do certificado do APK de teste: `npx eas-cli@27.5.0 credentials --platform android` (perfil `preview`, "Keystore"), e cadastrar os dois no app Android `com.sacou.app` do Firebase.
3. Baixar o `google-services.json` de novo e restringir a chave de API do Android ao pacote `com.sacou.app` e ao SHA-1 no Google Cloud → Credenciais. Só então o arquivo entra no repositório, em `apps/mobile/google-services.json`, com a exceção do gitleaks (ADR 0057).
4. `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (o "client ID web" do Firebase, em Authentication → Google) no `apps/mobile/.env` local (fora do Git) e nas variáveis do EAS do perfil `preview`. Opcional: `EXPO_PUBLIC_TERMS_URL` e `EXPO_PUBLIC_PRIVACY_URL` (`https:`); sem elas a frase de Termos fica sem link.

**Roteiro (10 minutos):**

1. Abrir sem login → tela 02 direto, sem piscar o Início. "Entrar com Google" → seletor de contas → escolher a conta → Início. (Com `DEVELOPER_ERROR`, o SHA-1 está errado ou faltando.)
2. Tocar duas vezes rápido em "Entrar com Google": abre um seletor só. Fechar o seletor: volta sem mensagem de erro.
3. Eu → "Sair" → tela 02. "Entrar com Google" de novo → o seletor **aparece** (troca de conta) → outra conta → Início sem nenhum grupo da conta anterior.
4. "Usar e-mail e senha" → "Criar conta" com senha de 5 caracteres (botão desligado, "Pelo menos 6 caracteres") e de 6 (entra). Sair e entrar com a senha errada → "E-mail ou senha incorretos.", com a senha apagada e o e-mail mantido.
5. "Esqueci a senha" com um e-mail que existe e com um que não existe → a mesma frase nos dois. O e-mail de redefinição chega (modelo do Firebase).
6. Com a API ligada: entrar, abrir Grupos, pôr em modo avião, fechar e abrir o app → a lista de grupos abre do cache com a faixa "Sem conexão".
7. Fechar o app logado e abrir de novo → entra direto (a sessão fica no SDK). Fonte no máximo, aparelho pequeno: nada corta na 02; o TalkBack lê os botões e não lê a senha.
8. (Opcional, com o ambiente local) API apontada para um servidor que responde 302 para outra origem: a chamada falha com o texto genérico e o destino **não** recebe o cabeçalho `Authorization` (pendência da E4.2).

Anote modelo do celular e versão do Android. O que falhar vai para o `progresso.md`.
