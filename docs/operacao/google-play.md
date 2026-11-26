# Google Play: exigências e respostas prontas

Escrito na E6.2 (25/11/2026). Respostas para colar na Play Console sem reler o código. Os dados vêm do inventário [`dados-pessoais.md`](../seguranca/dados-pessoais.md) (citado pelo nome da linha) e do checklist [`lgpd-checklist.md`](../seguranca/lgpd-checklist.md). Pacote: `com.sacou.app` (`apps/mobile/app.json`). **Quem muda o inventário confere a tabela do Data safety abaixo.**

## Exigências atuais (pesquisa de 25/11/2026)

| Exigência | O que vale | Fonte |
|---|---|---|
| Nível de API alvo | App novo e atualização: Android 16 (API 36) desde 31/08/2026 | [Target SDK](https://developer.android.com/google/play/requirements/target-sdk), [Ajuda da Play](https://support.google.com/googleplay/android-developer/answer/11926878) |
| Data safety | Obrigatório no teste fechado, no aberto e na produção; dispensado **só** no teste interno | [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469) |
| Exclusão de conta | Caminho no app **e** um link web que deixe pedir a exclusão sem reinstalar o app; o link vai no Data safety | [Exclusão de conta](https://support.google.com/googleplay/android-developer/answer/13327111) |
| Conta pessoal criada depois de 13/11/2023 | Teste fechado com 12 testadores por 14 dias seguidos antes de pedir acesso à produção | [Teste para contas pessoais](https://support.google.com/googleplay/android-developer/answer/14151465) |
| Verificação de desenvolvedor | Vale no Brasil desde 30/09/2026; o app da Play precisa estar registrado no Console | [Anúncio](https://android-developers.googleblog.com/2026/06/android-developer-verification.html), [Guia](https://developer.android.com/developer-verification/guides) |
| Conteúdo gerado por usuário | Aceitar os termos antes de criar conteúdo; denunciar conteúdo e usuário dentro do app; bloquear quando houver interação 1:1 | [UGC](https://support.google.com/googleplay/android-developer/answer/9876937), [Denúncia no app](https://support.google.com/googleplay/android-developer/answer/12923286) |

**Onde o Sacou está:** os termos já aparecem no login e no perfil rápido, antes de qualquer conteúdo (tela 02, E6.1); não há conversa 1:1, então bloquear não se aplica; "Denunciar" está feito (E6.6: na folha 19c de todo outro membro e em "Denunciar grupo" no fim da tela 18, com 4 motivos fechados; leitura e prazo em [denuncias.md](denuncias.md)) e a página web de exclusão falta (E6.4), que bloqueia o teste fechado, não o interno. Pela resposta 227, o piloto começa no **teste fechado** se houver 12 ou mais pessoas com Android, para o relógio dos 14 dias correr; senão, no teste interno.

## Data safety

Regras gerais da resposta:

- **Compartilhado:** `não` em todas as linhas. Os operadores (Google, Neon, Sentry, Expo) tratam em nome do Sacou, e a Play não conta prestador de serviço como compartilhamento.
- **Criptografado em trânsito:** `sim` (TLS do Cloud Run; banco com `VerifyFull`).
- **Pode pedir exclusão:** `sim`, pelo app (Conta, Excluir conta) e pelo link web da E6.4.
- **Coleta obrigatória ou opcional:** como na tabela.

| Tipo de dado da Play | Coletado | Compartilhado | Efêmero | Obrigatório ou opcional | Finalidade | Linha do inventário |
|---|---|---|---|---|---|---|
| Informações pessoais > E-mail | sim (Firebase Auth) | não | não | obrigatório | Gerenciamento da conta | "E-mail, senha gerida pelo provedor" |
| Informações pessoais > Nome | sim (apelido; e o nome da conta Google, que o Firebase Auth guarda no login com o Google) | não | não | obrigatório | Funcionalidade do app, gerenciamento da conta | "Perfil do jogador", "E-mail, senha gerida pelo provedor". O Firebase Auth copia o `displayName` do Google para o usuário ([Firebase, Data safety](https://firebase.google.com/docs/android/play-data-disclosure): "Display name" e "Contact information" do provedor) |
| Informações pessoais > IDs do usuário | sim (UID do Firebase, `MemberId`) | não | não | obrigatório | Gerenciamento da conta, funcionalidade do app | "Dados de conta guardados na API", "Vínculo com o grupo" |
| Informações pessoais > Outras informações | sim (URL da foto da conta Google no Firebase Auth; posições e nível autodeclarado do perfil; nota de nível dada pelo Admin ou Co-admin sobre a pessoa) | não | não | opcional (nível autodeclarado; URL da foto só no login com o Google), obrigatório (posições) | Funcionalidade do app (sorteio dos times), gerenciamento da conta | "E-mail, senha gerida pelo provedor", "Posições", "Nível sugerido pelo jogador", "Nota do membro definida pelo Admin ou Co-admin" |
| Atividade no app > Outro conteúdo gerado pelo usuário | sim (nome do grupo, local, nome do convidado) | não | não | opcional | Funcionalidade do app | "Nome do grupo", "Configuração do grupo", "Convidado sem conta" |
| Atividade no app > Interações no app | sim (presença, pontos, votos do MVP) | não | não | obrigatório | Funcionalidade do app | "Presença, lista de espera e rodada", "Stream da quadra no servidor", "Votos do MVP do dia" |
| Informações e desempenho do app > Registros de falhas | sim (API e app, Sentry; 90 dias) | não | não | obrigatório | Análise | "Erros da API", "Erros e travamentos do app" |
| Informações e desempenho do app > Diagnóstico | sim (logs de requisição do Cloud Run com IP, user agent e caminho, 30 dias; IP e user agent do login no Firebase Auth; versão do app, modelo e sistema do aparelho no Sentry do app; logs da API sem dado do usuário) | não | não | obrigatório | Análise, segurança, prevenção de fraude | "IP, user agent, caminho e query", "IP e logs de acesso", "Erros e travamentos do app", "Logs da própria API" |
| IDs do dispositivo ou outros | sim (token de push, `installation_id`, `deviceId`; ID de instalação do Firebase, o FID, gerado pelo SDK do FCM) | não | não | obrigatório (`deviceId`), opcional (push) | Funcionalidade do app | "Aparelhos do push", "ID do celular no envelope do evento"; [Firebase, Data safety](https://firebase.google.com/docs/android/play-data-disclosure) (Cloud Messaging e Installations) |
| Fotos e vídeos > Fotos | não: a imagem da cartinha só existe no aparelho e na folha de compartilhar; da foto da conta Google só a URL fica no Firebase Auth (linha "Outras informações") | — | — | — | — | "Imagem da cartinha" |
| Localização, contatos, mensagens, finanças, saúde, áudio, arquivos, agenda, histórico da web | não (o IP dos logs não é usado para localizar a pessoa) | — | — | — | — | Política, seção 3 |

**Quando mudar:** a foto, o Pix, o PostHog e a assinatura (fora do piloto, ADR 0046) acrescentam linhas. Antes de enviar, conferir de novo a [página do Firebase sobre Data safety](https://firebase.google.com/docs/android/play-data-disclosure) (Authentication, Cloud Messaging e Installations), conferida em 25/11/2026.

## Outras declarações da Play Console

| Declaração | Resposta |
|---|---|
| Público-alvo | 18 anos ou mais (pergunta 202, `termos-de-uso.md:28`). Não é para crianças, então fica fora do programa Families |
| Anúncios | Não tem |
| Questionário de classificação (IARC) | Sem violência, sexo, linguagem imprópria, drogas, apostas nem compras. Interação entre usuários: `sim` (apelidos, grupos e listas de rodada). Compartilha a localização do usuário: `não` |
| Acesso ao app para o revisor | Conta de e-mail de teste com um grupo de demonstração na produção (pergunta 226): e-mail, senha e o passo a passo "abra o grupo Demonstração, veja a rodada e o placar". A conta é criada pelo Gabriel |
| Permissões | `android.permission.VIBRATE` (`app.json`) e `POST_NOTIFICATIONS` (do `expo-notifications`, Android 13 ou mais). As de leitura de mídia e de armazenamento estão em `blockedPermissions` (`apps/mobile/app.json`); a cartinha grava na galeria só com permissão de escrita (ADR 0073) |
| App de finanças, saúde, notícias ou governo | Não |
| Política de privacidade (URL) | `https://<domínio da API de produção>/privacidade` (E6.1, ADR 0083), depois da revisão jurídica |
| Exclusão de conta (URL) | A página da E6.4 |

## Nível de API alvo

O app usa o Expo SDK 58 (`apps/mobile/package.json`), que gera o `targetSdkVersion` padrão do SDK. A Play pede 36 ou mais. A conferência é o passo 3 de "Builds e envio", em todo AAB antes do envio. Se vier menor, fixar `targetSdkVersion: 36` e `compileSdkVersion: 36` no `expo-build-properties` (`app.json`, já instalado) e gerar outro AAB antes de qualquer envio.

| Data | `versionCode` | `targetSdkVersion` |
|---|---|---|
| (a preencher no primeiro AAB) | | |

## Builds e envio

Perfil `production` de `apps/mobile/eas.json` ([ADR 0088](../arquitetura/adr/0088-builds-da-play-e-assinatura.md)): AAB, ambiente `production` do EAS, Sentry `production`, sem a tela de desenvolvimento. **Só depois do primeiro deploy de produção da API** (resposta 245): o AAB aponta para a API de produção. Os comandos rodam na pasta principal (`apps/mobile/`, que tem o `google-services.json`, fora do Git).

1. **Variáveis** (uma vez, e de novo se mudar a URL da API). `eas env:list --environment production` deve listar `EXPO_PUBLIC_API_URL` (a API de produção, `https://sacou-api-804880427435.us-east4.run.app` se o primeiro deploy confirmar o endereço), `EXPO_PUBLIC_INVITE_BASE_URL`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` e `EXPO_PUBLIC_SENTRY_DSN`, além de `SENTRY_AUTH_TOKEN` e `SENTRY_ORG`. No relatório vão só os nomes, nunca os valores. Faltou uma: criar e só então gerar o build.
2. **Contador** (uma vez, antes do primeiro build remoto). `eas build:version:set -p android` com **1**, o maior `versionCode` já usado nos APKs. Depois disso o EAS soma 1 a cada build `preview` ou `production` (`autoIncrement`); nunca subir o número no `app.json`, que o EAS ignora. Para ver o atual: `eas build:version:get -p android`.
3. **Build.** `eas build -p android --profile production`. No primeiro, o EAS pergunta se gera a chave de upload: **sim** (fica no EAS, porta 1). Em seguida o Gabriel baixa a cópia: `eas credentials` -> Android -> production -> Keystore -> Download, e guarda o arquivo e as senhas no gerenciador de senhas dele (nunca no repositório nem no chat). O AAB sai na página do build no expo.dev (botão de download); o primeiro deve ser `versionCode` 2, `versionName` 0.1.0.
4. **Alvo do SDK.** Baixar o `bundletool-all-<versão>.jar` da página de releases do `google/bundletool` no GitHub, para fora do repositório, e rodar com o Java do Android Studio:
   `"/c/Program Files/Android/Android Studio/jbr/bin/java" -jar bundletool-all.jar dump manifest --bundle=<arquivo>.aab --xpath=/manifest/uses-sdk/@android:targetSdkVersion`
   Tem de mostrar 36 ou mais; anotar data, `versionCode` e o número na tabela de "Nível de API alvo". Menor que 36 trava o envio. Depois do envio, o Explorador de pacotes de apps da Play Console mostra o mesmo número.
5. **Envio.** À mão pela Play Console (resposta 244, sem EAS Submit): passo 3 do "Roteiro do Gabriel" no primeiro, e depois Teste interno -> Criar nova versão -> arrastar o AAB.
6. **Sentry.** O primeiro erro real do app da Play aparece em `sacou-mobile` com ambiente `production` e release `0.1.0 (<versionCode>)`, com pilha simbolizada (o perfil não tem `SENTRY_ALLOW_FAILURE`: o build falha se os mapas não sobem).

## Roteiro do Gabriel (10 minutos, depois do primeiro AAB)

Pré-requisito: a API de produção publicada (resposta 248) e o AAB conferido nos passos 1 a 4 de "Builds e envio".

1. **Criar o app** (2 min). Play Console -> Todos os apps -> Criar app: nome `Sacou`, idioma padrão Português (Brasil), **App**, **Gratuito** (não volta a pago, porta 4 do ADR 0088), marcar as duas declarações -> Criar app.
2. **Lista de testadores** (2 min). Testar e lançar -> Teste -> Teste interno -> aba Testadores -> Criar lista de e-mails `Sacou interno` só com o seu e-mail (resposta 247) -> Salvar. Copiar o **link de inscrição** ("Participar na Web").
3. **Primeira versão** (3 min). Aba Versões -> Criar nova versão. Em "Assinatura de apps do Google Play", deixar a opção padrão (o Google gera e guarda a chave do app; porta 1) -> Continuar. Arrastar o `.aab` baixado da página do build no expo.dev. Nome da versão: o que a Play sugerir (`2 (0.1.0)`). Notas: "Primeira versão de teste." -> Próxima -> Salvar e publicar.
4. **Impressões da chave** (2 min). Testar e lançar -> Configuração -> Integridade do app -> Assinatura de apps: copiar SHA-1 e SHA-256 da **chave de assinatura do app** (a do Google, não a de upload). Firebase -> Configurações do projeto -> app Android `com.sacou.app` -> Adicionar impressão digital (as duas). Google Cloud -> APIs e serviços -> Credenciais -> chave de API do Android -> restrição de apps Android -> Adicionar `com.sacou.app` com o SHA-1 novo -> Salvar. Baixar de novo o `google-services.json` para a pasta principal (`apps/mobile/`), fora do Git. Sem este passo, o login com o Google no app da Play devolve `DEVELOPER_ERROR`.
5. **Instalar** (1 min). No celular: **desinstalar antes** o APK `preview` ou `development` (assinatura diferente; um não atualiza o outro). Abrir o link do passo 2 com a sua conta Google -> Aceitar -> Fazer o download no Google Play -> Instalar. Entrar com o Google e conferir que a aba de grupos carrega, sem "Não deu para carregar seus grupos". Tentar abrir a tela de desenvolvimento: o app volta para o início. A publicação no interno costuma levar alguns minutos; se a Store disser que o app não existe, esperar e tentar de novo.

## O que o Gabriel faz

Ações de conta e de dinheiro, que nenhum agente faz:

1. Criar e verificar a conta da Play Console (US$ 25, `plano-mvp.md`, pré-requisitos) e a verificação de desenvolvedor.
2. Registrar o pacote `com.sacou.app`.
3. Cadastrar os testadores (12 ou mais no teste fechado, pela resposta 227).
4. Criar a conta de teste e o grupo de demonstração para o revisor (pergunta 226).
5. Colar as respostas deste documento.
6. Publicar a política final, depois da revisão jurídica, e informar a URL pública da política e da página de exclusão (E6.4).
7. Criar o e-mail do encarregado (pergunta 199), que a página de exclusão e a política citam.

## App Store (depois do piloto)

Fora do piloto: o piloto é só no Android (resposta 58). Itens que já se sabe que mudam quando a App Store voltar, sem pesquisa nesta tarefa:

- **Sign in with Apple**, obrigatório quando o app oferece login com o Google.
- **Exclusão de conta dentro do app**, que já existe (tela 30b).
- **Rótulo de privacidade** (App Privacy), com as mesmas linhas do Data safety acima, mais o APNs como operador.
