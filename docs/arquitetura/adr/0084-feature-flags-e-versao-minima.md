# ADR 0084 · Feature flags por ambiente e versão mínima do app (E5.3, Parte 2)

Status: aceita. Perguntas 196 e 197 (padrões adotados).

## Contexto

O piloto sobe com APKs instalados à mão. Duas coisas precisam poder mudar sem um APK novo: ligar ou desligar uma função por ambiente e recusar um app velho demais para a API. Sem isso, um defeito numa função nova só some com um APK novo em todos os celulares, e um app antigo fala com uma API que mudou.

## Decisões

**D1 · Fonte única: o `appsettings`.** Seção `AppConfig` (`MinimumBuild:{Android,Ios}`, `UpdateUrl:{Android,Ios}`, `Features:{<Flag>}`), por ambiente (`appsettings.Staging.json` sobrepõe o padrão). Mudar é um PR (e um deploy); numa emergência, a variável `AppConfig__Features__MvpVote=false` no console do Cloud Run, que o próximo deploy desfaz. Sem banco, sem serviço de terceiros, sem painel.

**D2 · Lista fechada.** `AppFeature` (enum) e `AppFeatures` (nome na configuração e padrão `true`). Os valores são texto `true`/`false`; a partida falha com: build menor que 1, URL que não seja HTTPS (ou vazia), flag de nome desconhecido, valor que não seja booleano. A resposta é um objeto fechado (um campo por flag), não um mapa livre. Uma flag nova é uma linha no enum e no nome, um campo na resposta e uma linha no app. O nome do tipo é `AppFeature` porque a regra CA1711 recusa o sufixo `Flag`.

**D3 · `GET /v1/app-config`.** Anônima (o app pergunta antes do login), sem tocar o banco, `Cache-Control: public, max-age=60`, política `app-config` por endereço do cliente (60 / 60 s; 10 vezes no teste), a mesma partição da `/r` (último item do `X-Forwarded-For`, ADR 0070 D6) e 429 em JSON. Única rota anônima de `/v1`. Resposta: `minimumBuild`, `updateUrl` (nulo se vazio) e `features`. Nenhum dado de pessoa.

**D4 · Versão mínima.** O app manda `X-Sacou-App-Build` (número) e `X-Sacou-App-Platform` (`android` ou `ios`) em todo pedido. Um middleware (`UseSacouAppBuildGate`, antes de `UseAuthentication`) responde **426** `api.app-outdated` em qualquer rota de `/v1` menos `/v1/app-config` quando os dois cabeçalhos são válidos e o build é menor que o mínimo da plataforma. Os cabeçalhos **não são confiáveis**: ausente, repetido, maior que 16 caracteres, plataforma desconhecida ou número que não seja inteiro sem sinal passam em silêncio. Quem mente o número só se bloqueia ou se libera a si mesmo; o gate não é controle de acesso. `/health` e as páginas (`/r`, `/c`, `/termos`) nunca recebem 426.

**D5 · Flag na rota.** `RequireFeature(AppFeature)` põe um `FeatureRequirement` nos metadados da rota; o middleware `UseSacouFeatureGate` (depois da autorização, antes do filtro do grupo e do limitador) responde 404 `api.feature-disabled` com a flag desligada. Fica no pipeline, não num filtro de endpoint, porque o filtro do grupo roda antes dos filtros da rota e leria o banco à toa. Sem a flag no `appsettings`, vale o padrão `true`. Rotas com a flag `MvpVote`: `GET .../mvp-voting`, `POST .../mvp-voting/vote`, `GET .../mvp-voting/result`. O resumo da rodada segue de pé (o app esconde a entrada da votação).

**D6 · No app.** `AppBuild` (porta: plataforma e `build: number | null`) lido de `expo-application` (`nativeBuildVersion`: `versionCode` no Android, `CFBundleVersion` no iOS; muda só com o binário, nunca com atualização OTA). Sem build legível, o app nunca é bloqueado e não manda os cabeçalhos. A config vive **só** no cache do TanStack Query (`["app-config"]`, `staleTime` 5 min, relida ao voltar ao primeiro plano, persistida), e "abaixo do mínimo" e as flags são derivadas a cada renderização (`isBelowMinimum`, `isFeatureOn`). Sem transição de estado na tela, não há reducer: a justificativa é de que nada é guardado fora da consulta. `AppVersionGate` fica entre o `FontGate` e o `DatabaseGate` (não precisa do banco) e **só bloqueia com resposta conhecida**, da rede ou do cache persistido; carregando, sem rede e sem cache, ou com a leitura falha, mostra o app. A quadra offline nunca fecha por dúvida. Enquanto a tela de atualização aparece, o botão de voltar do Android é bloqueado (`BackGuard`). Um 426 em qualquer chamada, consulta ou mutação, invalida `["app-config"]` (um lugar só, `query-client`), e o ponto sem rede continua a ser tratado como `app-outdated` pelo sincronizador da quadra (espera, os pontos ficam no log). Um 404 `api.feature-disabled` mostra o texto do catálogo; a entrada da votação do MVP some com a flag desligada.

**D7 · Tela "Atualize o Sacou" (pergunta 196, padrão).** Tela cheia no tema do app, sem sair; título "Atualize o Sacou", texto "Esta versão não funciona mais. Baixe a nova para continuar.", botão "Baixar a versão nova" que abre o `updateUrl` da plataforma (só HTTPS); sem endereço, sem botão e o texto manda falar com quem organiza o grupo. Usa o `ErrorScreen` do app (tokens escalados, toque ≥ 44).

**D8 · Primeira flag (pergunta 197, padrão): `MvpVote`**, ligada nos dois ambientes.

**D9 · Versões.** `app.json` ganha `version` (0.1.0), `android.versionCode` (1) e `ios.buildNumber` ("1"); `eas.json` usa `appVersionSource: local`, então **cada APK que o Gabriel gera sobe o `versionCode`** à mão. O mínimo só sobe depois que o APK novo estiver instalado em todos.

## Onde mudou o código

`Sacou.Http/AppConfig/` (e não `Sacou.Api`: os módulos precisam de `RequireFeature` e não referenciam o projeto da API); a rota é mapeada no `Program.cs` com `AllowAnonymous` e o limitador. App: `features/app-config/`.

## Consequências

- Cada rota anônima nova de `/v1` reprova o teste da tabela de rotas até ser listada.
- Tirar uma função do ar não exige APK; subir o mínimo exige o APK novo instalado antes, senão o jogador fica preso na tela de atualização.
- O mínimo e as flags só mudam com deploy; a latência é o `max-age` de 60 s mais os 5 min do app.
- Em produção sem `UpdateUrl`, a tela de atualização não tem botão: preencher antes de subir o mínimo.
