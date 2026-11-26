# Teste no celular (Android)

Roteiro do modo quadra (E4.9, parte 3) e passo a passo do APK de teste. O APK usa o perfil `preview` do EAS: modo de produção (Hermes), com as telas de desenvolvimento ligadas (`EXPO_PUBLIC_DEV_TOOLS=1`). Não tem segredo nenhum no repositório.

Roteiro do fim do M5 (página da rodada, resumo, cartinha, votação e notificações): [`roteiro-celular-M5.md`](roteiro-celular-M5.md).

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

**Número do build:** o EAS sobe o `versionCode` sozinho a cada build `preview` ou `production` (`appVersionSource: remote`, ADR 0088); o `android.versionCode` do `app.json` não vale mais. Ele é o "build" que a API compara com o mínimo (ADR 0084); um APK com número igual ou menor que o de outro já instalado não o substitui. O `expo-application` entrou na E5.3 Parte 2: o primeiro APK depois dela já traz o número; um APK antigo sem ele nunca é bloqueado.

## Roteiro de 10 minutos

Veja `docs/estado/tarefas/E4.9.md`, seção 6 (é o mesmo texto). Anote o **modelo do celular** e a **versão do Android**.

## Depois do teste

O orquestrador registra os números em `docs/arquitetura/adr/0038-log-local-da-quadra.md` e o que falhou no `progresso.md`. A E4.9 só passa a "Feita" depois deste roteiro.

## Teste local pelo cabo (build de desenvolvimento)

Sem API publicada, o login, o perfil, a conta, exportar e excluir são testados com a API e o Postgres rodando no computador, e o celular ligado no USB. O perfil `development` do `eas.json` gera um APK com `expo-dev-client`. Nele `__DEV__` é verdadeiro, então o app aceita `http://localhost`. O `adb reverse` faz o `localhost` do celular apontar para o computador.

**Uma vez:**

1. Celular com depuração USB liberada para este computador (`adb devices` mostra `device`).
2. `.env` na raiz (cópia de `.env.example`, com senha própria) e `apps/mobile/.env` com `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. O segundo `.env` também pode ter `EXPO_PUBLIC_API_URL=http://localhost:5080`.
3. `apps/mobile/google-services.json` salvo localmente. Ele fica fora do Git (`.gitignore`), mas o `.easignore` deixa o EAS enviá-lo ao build na nuvem. Mantenha os dois arquivos com as mesmas exclusões.
4. Build: `cd apps/mobile && npx eas-cli@27.5.0 build --platform android --profile development`. Instale pelo cabo com `adb install <apk>`.
5. SHA-1 e SHA-256 do certificado desse build (`npx eas-cli@27.5.0 credentials --platform android`, perfil `development`) cadastrados no app Android do Firebase. Sem isso, o Google responde `DEVELOPER_ERROR`.

**A cada teste:**

```sh
docker compose up -d --wait
set -a; . ./.env; set +a   # lê o POSTGRES_PASSWORD sem imprimir
export ConnectionStrings__Sacou="Host=localhost;Port=5432;Database=postgres;Username=postgres;Password=$POSTGRES_PASSWORD"
export Database__MigrateOnStartup=true
ASPNETCORE_URLS=http://localhost:5080 ASPNETCORE_ENVIRONMENT=Development dotnet run --project apps/api/src/Sacou.Api
adb reverse tcp:5080 tcp:5080   # túnel da API
adb reverse tcp:8081 tcp:8081   # túnel do Metro
pnpm --filter @sacou/volley-rules --filter @sacou/match-engine run build   # o app lê o dist/ dos pacotes
CI=1 EXPO_PUBLIC_DEV_TOOLS=1 pnpm --filter @sacou/mobile start
```

**Neste PC o Metro só sobe com `CI=1`.** Sem ele, o `FallbackWatcher` do Windows (o observador de arquivos sem o Watchman) não termina a varredura em 4 minutos no HD, e o Metro nunca fica pronto. Com `CI=1` o Metro não observa mudanças: depois de editar o código, recarregue o app (ou reinicie o Metro com `--clear`). O `EXPO_PUBLIC_DEV_TOOLS=1` liga as telas de desenvolvimento.

Abra o app no celular: ele carrega o JavaScript do Metro pela porta 8081. Com o `dist/` dos pacotes desatualizado, o app abre com `Cannot read property ... of undefined`: compile os pacotes e reinicie o Metro com `--clear`. A conexão segue [`postgres-local.md`](postgres-local.md).

## Login e sessão (E4.3, Parte 1)

APK novo: a Parte 1 traz módulos nativos (Firebase, Google Sign-In). O teste real só funciona depois dos passos do console do [ADR 0057](../arquitetura/adr/0057-login-e-sessao-no-app.md), seção "Configuração do build" (pergunta 57). Nenhum valor passa pelo chat.

**Antes do build (Gabriel, uma vez):**

1. Firebase `sacou-79493` → Authentication → Provedores: **Google** e **E-mail/senha** ligados, e a **proteção contra enumeração de e-mails** ligada.
2. SHA-1 e SHA-256 do certificado do APK de teste: `npx eas-cli@27.5.0 credentials --platform android` (perfil `preview`, "Keystore"), e cadastrar os dois no app Android `com.sacou.app` do Firebase.
3. Baixar o `google-services.json` de novo e restringir a chave de API do Android ao pacote `com.sacou.app` e ao SHA-1 no Google Cloud → Credenciais. Só então o arquivo entra no repositório, em `apps/mobile/google-services.json`, com a exceção do gitleaks (ADR 0057).
4. `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (o "client ID web" do Firebase, em Authentication → Google) no `apps/mobile/.env` local (fora do Git) e nas variáveis do EAS do perfil `preview`. Os links de Termos e Política saem de `EXPO_PUBLIC_INVITE_BASE_URL` (`{origem}/termos` e `/privacidade`, ADR 0083); `EXPO_PUBLIC_TERMS_URL` e `EXPO_PUBLIC_PRIVACY_URL` (`https:`) são só sobreposição opcional. Sem nenhuma delas, a frase fica sem link.

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

## Sentry no app (E5.2 Parte 2, ~10 min)

APK novo: `@sentry/react-native` é dependência nativa ([ADR 0080](../arquitetura/adr/0080-sentry-e-logs-estruturados.md), D9 a D13). Antes, o passo do Gabriel da seção 6 do [plano da E5.2](../estado/tarefas/E5.2.md): conta e projeto `sacou-mobile` (região EUA), filtros do painel e limite de 300 eventos/hora na chave, e no expo.dev as variáveis `EXPO_PUBLIC_SENTRY_DSN` ("Plain text", preview e production), `SENTRY_ORG` ("Plain text", o slug da organização) e `SENTRY_AUTH_TOKEN` ("Secret"). Depois, `eas build --profile preview --platform android`.

1. No log do build no EAS, a etapa do Sentry diz que enviou o bundle e o mapa de fontes (sem erro do `sentry-cli`; o token aparece como `***`).
2. Instalar o APK, entrar, abrir Início → "Catálogo de componentes (desenvolvimento)". No topo, "Erros (Sentry)" com dois botões.
3. Tocar "Enviar erro de teste" → aparece "Erro de teste enviado. Confira no painel do Sentry." Em até 1 minuto, no `sacou-mobile`: um evento `DeliberateFailure`, ambiente `staging`, tag `area = dev-catalog`, pilha **simbolizada** (arquivo `ErrorTestSection.tsx` e linha do TS).
4. Abrir o evento e conferir: sem usuário, sem IP, sem captura de tela, sem hierarquia de views, sem nome do aparelho; breadcrumbs sem linhas de `console`, sem apelidos e sem códigos (`/r/{code}`, `[id]`).
5. Tocar "Travar o app (teste)" → o app fecha. Abrir de novo (o evento nativo sai na abertura seguinte) → no painel, um evento nativo no ambiente `staging`, com as mesmas ausências do passo 4.
6. Em "Releases", a versão `com.sacou.app@<versão>+<versionCode>` com sessões (saúde da versão).
7. Um APK `development` ou sem `EXPO_PUBLIC_SENTRY_DSN` não manda nada: os botões não dão erro e o painel não recebe evento.
