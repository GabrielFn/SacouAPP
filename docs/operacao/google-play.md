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

**Onde o Sacou está:** os termos já aparecem no login e no perfil rápido, antes de qualquer conteúdo (tela 02, E6.1); não há conversa 1:1, então bloquear não se aplica; "Denunciar" falta (E6.6) e a página web de exclusão falta (E6.4). As duas bloqueiam o teste fechado, não o interno. Pela resposta 227, o piloto começa no **teste fechado** se houver 12 ou mais pessoas com Android, para o relógio dos 14 dias correr; senão, no teste interno.

## Data safety

Regras gerais da resposta:

- **Compartilhado:** `não` em todas as linhas. Os operadores (Google, Neon, Sentry, Expo) tratam em nome do Sacou, e a Play não conta prestador de serviço como compartilhamento.
- **Criptografado em trânsito:** `sim` (TLS do Cloud Run; banco com `VerifyFull`).
- **Pode pedir exclusão:** `sim`, pelo app (Conta, Excluir conta) e pelo link web da E6.4.
- **Coleta obrigatória ou opcional:** como na tabela.

| Tipo de dado da Play | Coletado | Compartilhado | Efêmero | Obrigatório ou opcional | Finalidade | Linha do inventário |
|---|---|---|---|---|---|---|
| Informações pessoais > E-mail | sim (Firebase Auth) | não | não | obrigatório | Gerenciamento da conta | "E-mail, senha gerida pelo provedor" |
| Informações pessoais > Nome | sim (apelido) | não | não | obrigatório | Funcionalidade do app, gerenciamento da conta | "Perfil do jogador". O nome do Google fica só no aparelho ("E-mail e nome do provedor no aparelho") e não é coletado |
| Informações pessoais > IDs do usuário | sim (UID do Firebase, `MemberId`) | não | não | obrigatório | Gerenciamento da conta, funcionalidade do app | "Dados de conta guardados na API", "Vínculo com o grupo" |
| Atividade no app > Outro conteúdo gerado pelo usuário | sim (nome do grupo, local, nome do convidado) | não | não | opcional | Funcionalidade do app | "Nome do grupo", "Configuração do grupo", "Convidado sem conta" |
| Atividade no app > Interações no app | sim (presença, pontos, votos do MVP) | não | não | obrigatório | Funcionalidade do app | "Presença, lista de espera e rodada", "Stream da quadra no servidor", "Votos do MVP do dia" |
| Informações e desempenho do app > Registros de falhas | sim (só a API, Sentry) | não | não | obrigatório | Análise | "Erros da API" |
| Informações e desempenho do app > Diagnóstico | sim (logs da API, sem dado do usuário) | não | não | obrigatório | Análise, segurança | "Logs da própria API" |
| IDs do dispositivo ou outros | sim (token de push, `installation_id`, `deviceId`) | não | não | obrigatório (`deviceId`), opcional (push) | Funcionalidade do app | "Aparelhos do push", "ID do celular no envelope do evento" |
| Fotos e vídeos > Fotos | não: a imagem da cartinha só existe no aparelho e na folha de compartilhar | — | — | — | — | "Imagem da cartinha" |
| Localização, contatos, mensagens, finanças, saúde, áudio, arquivos, agenda, histórico da web | não | — | — | — | — | Política, seção 3 |

**Quando mudar:** o Sentry no app (E5.2 Parte 2) muda "Registros de falhas" para incluir o app; a foto, o Pix, o PostHog e a assinatura (fora do piloto, ADR 0046) acrescentam linhas.

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

O app usa o Expo SDK 58 (`apps/mobile/package.json`), que gera o `targetSdkVersion` padrão do SDK. Para conferir no AAB do EAS: `bundletool dump manifest --bundle=app.aab | grep targetSdkVersion` deve mostrar 36 ou mais. **A conferir na E5.4**, quando o primeiro AAB existir (lacuna G8, no aceite da E5.4). Se vier menor, fixar `targetSdkVersion` pelo `expo-build-properties`, já instalado.

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
