# 03 · Segurança dos dados (formulário do Play Console)

Respostas derivadas de [`docs/seguranca/dados-pessoais.md`](../seguranca/dados-pessoais.md), só com o que o **piloto** coleta. Regras do formulário conferidas em 19/11/2026 ([formulário](https://support.google.com/googleplay/android-developer/answer/10787469), [exclusão de conta](https://support.google.com/googleplay/android-developer/answer/13327111)).

**Quem responde no Console é o Gabriel**, depois da E6.2 (revisão de LGPD e exigências das lojas). Este arquivo é o rascunho; se o inventário mudar, este arquivo muda junto.

Definições do Google: **coletado** = sai do aparelho para o servidor ou para um SDK; **compartilhado** = repassado a terceiros. Prestador que processa em nosso nome (Firebase, Neon, Cloud Run, Sentry, Expo Push, Resend) **não** conta como compartilhamento. O que a pessoa manda por conta própria pela folha de compartilhar (lista, times, cartinha) também não.

## Perguntas gerais

| Pergunta | Resposta | Base |
|---|---|---|
| O app coleta ou compartilha dados de usuário? | **Sim** | Conta, perfil, presença |
| Todos os dados coletados são criptografados em trânsito? | **Sim** | API e Firebase só por HTTPS. Confirmar na E6.2 que não há rota sem TLS |
| Há como pedir a exclusão dos dados? | **Sim** | Tela 30b "Excluir minha conta" (`DELETE /v1/me`, ADR 0056) |
| O app permite criar conta? | **Sim**: informar a **URL de exclusão de conta** | Ver "Pendências" |
| Dados compartilhados com terceiros | **Nenhum** | Só prestadores de serviço |

## Tipos de dados

| Categoria do Google | Tipo | Coletado | Compartilhado | Obrigatório | Finalidades | O que é, no Sacou |
|---|---|---|---|---|---|---|
| Informações pessoais | **Endereço de e-mail** | Sim | Não | Obrigatório | Funcionalidade do app; Gerenciamento da conta | Login no Firebase Auth. A API do Sacou não guarda o e-mail |
| Informações pessoais | **Nome** | Sim | Não | Obrigatório | Funcionalidade do app; Gerenciamento da conta | Apelido (até 20 caracteres) e o nome que vem do provedor de login, no Firebase. Nome de convidado digitado pelo admin |
| Informações pessoais | **IDs de usuário** | Sim | Não | Obrigatório | Funcionalidade do app; Gerenciamento da conta | UID do Firebase, `UserId` e `MemberId` internos |
| Informações pessoais | **Outras informações** | Sim | Não | Opcional | Funcionalidade do app | Posições em quadra e nível sugerido pelo próprio jogador; nota dada pelo admin |
| Atividade no app | **Outro conteúdo gerado pelo usuário** | Sim | Não | Obrigatório | Funcionalidade do app | Nome do grupo, local e horário da rodada, presença (vou, não vou, espera), pontos e partidas, voto no MVP |
| Informações e desempenho do app | **Registros de falhas** | Sim | Não | Obrigatório | Análise | Sentry (E5.2). **Só marcar se o Sentry estiver no app publicado** |
| Informações e desempenho do app | **Diagnósticos** | Sim | Não | Obrigatório | Análise | Idem |
| IDs do dispositivo ou outros | **IDs do dispositivo ou outros** | Sim | Não | Obrigatório | Funcionalidade do app | `deviceId` aleatório por instalação (não é IMEI nem Android ID) e o token de push (E3.11) |

Nenhum desses dados é processado só de forma efêmera, e nenhum é usado para publicidade.

## O que **não** é coletado no piloto

| Categoria | Por quê |
|---|---|
| Localização (aproximada ou precisa) | O local da rodada é texto digitado; o app não pede permissão de localização |
| Telefone, endereço, contatos | Login sem telefone (`decisoes.md`); o app não lê a agenda |
| Fotos e vídeos | A cartinha do piloto usa avatar; foto é pós-piloto (ADR 0046) |
| Informações financeiras | Pix e assinatura são pós-piloto |
| Mensagens, áudio, arquivos, calendário, navegação | Não existem no app |
| Interações no app (análise de uso) | Sem PostHog no piloto; a métrica do portão é contada no banco |
| Saúde e condicionamento físico | Estatística de partida não é dado de saúde |

## Quando reabrir este formulário

| Mudança no produto | O que muda na declaração |
|---|---|
| Foto da cartinha (E3.14, E4.14) | Fotos e vídeos → Fotos, opcional, Funcionalidade do app |
| Planos e paywall (E3.15, E4.15) | Informações financeiras → Histórico de compras; "Compras no app" na ficha |
| Pix com "já paguei" (E3.10) | Avaliar "Outras informações financeiras" (chave Pix do organizador) |
| PostHog | Atividade no app → Interações no app, finalidade Análise |
| Resumo com IA (E3.13) | Rever se o provedor conta como prestador de serviço |

## Pendências antes de enviar

1. **Política de privacidade pública** (E6.1), citando que os dados ficam nos EUA (Neon `us-east-1` e Cloud Run `us-east4`; resposta 91 de `perguntas.md`), a retenção de 30 dias dos logs e o que sobra depois da exclusão (histórico como "Ex-jogador" e a marca de exclusão).
2. **URL de exclusão de conta.** O Google exige, além da exclusão dentro do app, uma página web que cite o nome do app, explique como excluir e aceite o pedido sem obrigar a reinstalar. Sugestão: uma seção da própria página de privacidade ("Como excluir sua conta") com o caminho no app e o e-mail do encarregado para quem não tem mais o app. Depende das perguntas 2 e 3 de `perguntas.md` (retenção e encarregado).
3. **SDKs:** conferir no Console o relatório de SDKs do pacote gerado (Firebase, Expo, Sentry) contra a tabela acima. Se algum SDK coletar o ID de publicidade, desligar no SDK ou declarar.
4. **Declaração de ID de publicidade:** responder "Não usa". Conferir se o manifesto final não traz a permissão `AD_ID`.
5. **Permissões:** só notificações (`POST_NOTIFICATIONS`), internet e vibração. Qualquer outra que aparecer no pacote precisa de explicação ou remoção.
