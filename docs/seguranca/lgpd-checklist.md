# Checklist LGPD do piloto

Revisão da E6.2 (25/11/2026, plano em [`.specs/features/E6.2/plan.md`](../../.specs/features/E6.2/plan.md)), com as respostas 219 a 227 de [`perguntas.md`](../estado/perguntas.md) aprovadas com a recomendação. **Fonte única dos dados:** o inventário [`dados-pessoais.md`](dados-pessoais.md); este checklist aponta para as linhas dele (pelo nome do `Dado`) e não copia o conteúdo. A política publicada é [`politica-de-privacidade.md`](../legal/politica-de-privacidade.md) (versão 0.2). As respostas da Google Play estão em [`google-play.md`](../operacao/google-play.md).

Estados: `ok` (o código e os documentos atendem), `lacuna Gn` (correção com tarefa na seção 10), `decisão do Gabriel (pergunta N)` (ação ou decisão dele, fora do código). Nada aqui substitui a revisão jurídica (perguntas 2 e 203).

## 1. Bases legais

| Item | Estado |
|---|---|
| Toda linha do inventário tem `Base legal` de uma lista fechada, travada pelo teste `scripts/lib/privacy-inventory.test.mjs` (`pnpm test:tooling`) | ok |
| Execução de contrato (art. 7, V): conta, perfil, grupos, rodadas, partidas, estatísticas, votos, push, página da rodada | ok |
| Legítimo interesse (art. 7, IX): logs, Sentry, limite de requisições, marca de exclusão, backup, nota do admin, rating, sorteio, convidado sem conta, autoria do lote da quadra | ok; o teste de balanceamento é do advogado (pergunta 201) |
| Nenhuma base é consentimento: o aceite da tela 02 não precisa ser registrado | ok (pergunta 201) |
| Nome do convidado sem conta: dado de um terceiro que não aceitou nada, incluído pelo admin | decisão do Gabriel (pergunta 201), com o advogado |
| Relatório de impacto (RIPD): não exigido por padrão para o porte e o tipo de dado do piloto | decisão do Gabriel (pergunta 203), item para o advogado |

## 2. Direitos do titular (art. 18)

| Inciso | Como o Sacou atende | Estado |
|---|---|---|
| I Confirmação da existência | A exportação responde; sem conta, o pedido vai ao canal do encarregado | ok, com o canal da seção 6 |
| II Acesso | `GET /v1/me/export` (`ExportMyDataEndpoint.cs`), folha 30a. Fora da exportação: a nota do admin e o rating (linhas "Nota do membro definida pelo Admin" e "Rating OpenSkill"); o pedido de acesso a eles vai pelo canal do encarregado, com o advogado. O e-mail e o provedor ficam no Firebase e aparecem na tela Conta; o `firebase_uid` é técnico | ok (pergunta 219, opção 1); sem G5 |
| III Correção | Tela 27 e `PUT /v1/me/profile` (`SaveMyProfileEndpoint.cs`); o convidado pede ao admin, que corrige pela 21a | ok |
| IV Anonimização, bloqueio ou eliminação do desnecessário | Retenção da seção 3; o `MemberId` do ex-jogador é pseudonimizado | ok, com a G3 e a G6 |
| V Portabilidade | O mesmo JSON da exportação (formato `sacou-personal-data`, versão 1), entregue à folha de compartilhar | ok |
| VI Eliminação | `DELETE /v1/me` (`DeleteMyAccountHandler.cs`), tela 30b; o app apaga o usuário no Firebase. Sobra: o backup por até 30 dias (G1) e os pendentes da quadra no aparelho (G7). Sem o app: página web de exclusão (G2) | lacuna G1, G2, G7 |
| VII Informação sobre compartilhamento | Política, seção 5 (operadores) | ok |
| VIII Possibilidade de não consentir | Não se aplica: nenhuma base é consentimento (pergunta 201) | ok |
| IX Revogação do consentimento | Não se aplica pelo mesmo motivo; desligar o push é pelo sistema (política, seção 9) | ok |
| Art. 20, revisão de decisão automatizada | Não se aplica no piloto: o rating não decide nada (ADR 0047); o sorteio é revisto e confirmado pelo admin | ok |
| Prazo de resposta (art. 19) | 15 dias, só depois de o canal existir | decisão do Gabriel (pergunta 199) |

## 3. Retenção e descarte

Toda linha do inventário tem a coluna `Retenção` com prazo concreto (em dias, "enquanto a conta existir" ou "enquanto o grupo existir"), travada pelo mesmo teste. Os itens que mudam o código:

| Item | Prazo | Estado |
|---|---|---|
| Conta, perfil, nota sobre a pessoa, push | Enquanto a conta existir; apagados no `DELETE /v1/me` | ok |
| Histórico do ex-jogador (`MemberId` em eventos, presenças, estatísticas, votos) | Enquanto o grupo existir (pergunta 223, `decisoes.md:35`) | ok |
| Grupo abandonado (sem rota de apagar grupo no piloto) | Enquanto existir | decisão do Gabriel (pergunta 200), depois do piloto |
| Cópia diária do banco (linha "Cópia do banco") | 30 dias; conta apagada depois do dump volta numa restauração até a G1 existir | lacuna G1 |
| Marca de exclusão (linha "Marca de exclusão") | 60 dias (pergunta 222); hoje sem prazo | lacuna G3 |
| Apelidos na página `/r` (linha "Perfil do jogador") | Até 7 dias depois da rodada (pergunta 224); hoje para sempre | lacuna G6 |
| Pontos pendentes de conta apagada no `sacou.db` (linha "Conta dona da sessão da quadra") | Apagados na exclusão feita no aparelho (pergunta 225); hoje ficam | lacuna G7 |
| Notificações e entregas | 30 e 7 dias (`NotificationRetention.cs`) | ok |
| Logs do Cloud Run e da API | 30 dias (retenção padrão do Cloud Logging) | ok |
| Erros no Sentry | 90 dias (plano grátis) | ok |
| Cache do app | 7 dias, ou até a saída da conta | ok |
| Marco Civil, art. 15 (guarda de 6 meses dos registros de acesso) | Hoje 30 dias; aplicabilidade a pessoa física sem fins econômicos | decisão do Gabriel (pergunta 200), com o advogado |

## 4. Operadores e suboperadores

| Operador | Dado que recebe | Região | Fonte da região | Estado |
|---|---|---|---|---|
| Google Firebase Authentication | E-mail, nome, URL da foto e ID da conta Google, senha protegida, IP e user agent do login, ID do Firebase Auth (linha "E-mail, senha gerida pelo provedor"; [Firebase, Data safety](https://firebase.google.com/docs/android/play-data-disclosure)) | EUA, definida pelo Google | [Firebase, privacidade](https://firebase.google.com/support/privacy) | ok |
| Google Cloud Run e Cloud Logging | Toda requisição; logs com IP e user agent por 30 dias (linhas "IP, user agent, caminho" e "Logs da própria API") | `us-east4`, EUA | ADR 0068, resposta 91 | ok |
| Google Cloud Storage (backup) | Cópia diária de todo o banco (linha "Cópia do banco") | `us-east1`, EUA | ADR 0082; `scripts/gcp/setup-backups.sh` | ok |
| Neon sobre AWS | Todo o banco (linha "Todos os dados do banco") | `us-east-1`, EUA | ADR 0068 | ok |
| Sentry (API) | Erros da API, sem usuário, `MemberId` nem IP; 90 dias (linha "Erros da API"), projeto `sacou-api` | EUA | Pergunta 208; `Sentry.AspNetCore` no `Sacou.Api.csproj` (ADR 0080) | ok |
| Sentry (app) | Erros e travamentos do app com versão, modelo e sistema do aparelho, sem usuário, `MemberId` nem IP; 90 dias (linha "Erros e travamentos do app"), projeto `sacou-mobile` | EUA | Perguntas 208 a 210; `@sentry/react-native` no `apps/mobile/package.json` (ADR 0080, D9 a D13) | ok |
| Expo Push | Token de push e o texto de cada push (linha "Token de push") | EUA, definida pela Expo | [Expo, privacidade](https://expo.dev/privacy) | ok |
| Google FCM | Token e push, repassados pelo Expo; o SDK gera o ID de instalação do Firebase (FID) e lê a versão do app ([Firebase, Data safety](https://firebase.google.com/docs/android/play-data-disclosure)) | EUA, definida pelo Google | [Firebase, privacidade](https://firebase.google.com/support/privacy) | ok |
| GitHub | Só dados de desenvolvedores (linha "Autor e e-mail em commits") | EUA | ADR 0058 | ok |
| Resend, PostHog, RevenueCat, Cloudflare R2, provedor de IA | Não usados no piloto: nenhum pacote em `apps/` (grep de 25/11/2026); R2 trocado pelo Google Cloud Storage (ADR 0082) | — | ADR 0046 | ok (não usado no piloto) |
| Apple APNs | Não usado no piloto: só Android (resposta 58) | — | — | ok (não usado no piloto) |
| Contrato de tratamento com cada operador | Termos padrão de cada provedor (DPA do Google Cloud, Neon, Sentry, Expo) | — | — | decisão do Gabriel (pergunta 203), com o advogado |

## 5. Transferência internacional (art. 33)

| Item | Estado |
|---|---|
| Todos os operadores do piloto tratam nos EUA; transferência aceita no piloto (resposta 91) e dita na seção 6 da política | ok |
| Hipótese do art. 33 (cláusulas-padrão da Resolução CD/ANPD 19/2024 ou outra) e texto final da seção 6 | decisão do Gabriel (pergunta 203), com o advogado |

## 6. Encarregado e canal

| Item | Estado |
|---|---|
| Canal do encarregado (e-mail dedicado): **não existe** até a pergunta 199 ser resolvida. Sem ele, o titular sem o app não tem como pedir nada, e a página de exclusão da G2 não tem para onde mandar | decisão do Gabriel (pergunta 199) |
| **A E7 (piloto com jogadores reais) fica bloqueada** até o canal existir e estar na seção 13 da política | decisão do Gabriel (pergunta 199) |
| Dispensa do encarregado para agente de pequeno porte (Resolução CD/ANPD 2/2022), mantendo o canal | decisão do Gabriel (pergunta 203), com o advogado |
| Identificação do controlador na política (art. 9, III) | decisão do Gabriel (pergunta 198) |

## 7. Segurança e incidente (art. 46 e 48)

| Item | Estado |
|---|---|
| Medidas técnicas: [`checklist.md`](checklist.md) (ASVS nível 1, MASVS) e [`modelo-de-ameacas.md`](modelo-de-ameacas.md) | ok |
| Logs sem e-mail, token nem apelido; Sentry sem IP nem usuário (ADR 0080) | ok |
| Comunicação de incidente à ANPD e ao titular (art. 48, prazo de 3 dias úteis da Resolução CD/ANPD 15/2024): quem avisa é o Gabriel, pelo canal da seção 6; roteiro em [`operacao/`](../operacao/) a escrever com o canal | decisão do Gabriel (pergunta 199) |
| Restauração do backup sem reaplicar exclusões | lacuna G1 |

## 8. Crianças e adolescentes (art. 14)

| Item | Estado |
|---|---|
| Idade mínima de 18 anos (pergunta 202), declarada nos termos (`termos-de-uso.md:28`) e na seção 11 da política | ok |
| Público-alvo da Play: 18 anos ou mais, fora do programa Families ([`google-play.md`](../operacao/google-play.md)) | ok |
| O app não coleta idade (nenhuma coluna de data de nascimento; teste de modelo de `player_profiles`) | ok |

## 9. Decisões automatizadas (art. 20)

| Item | Estado |
|---|---|
| O rating OpenSkill não aparece e não decide nada no piloto (ADR 0047 e 0071) | ok |
| O sorteio equilibrado é uma sugestão que o admin revê, troca e confirma (tela 07) | ok |

## 10. Lacunas

As que mudam código viraram tarefas em [`plano-mvp.md`](../plano-mvp.md) (seção E6). A G5 não virou tarefa: a resposta 219 manteve a nota do admin e o rating fora do app.

| Lacuna | O que falta | Tarefa | Bloqueia |
|---|---|---|---|
| G1 | Reexclusão a partir de `identity.deleted_accounts` depois de restaurar o backup (ADR 0082, D10) | E6.3 | piloto com jogadores reais |
| G2 | Página web de exclusão de conta, estática (pergunta 220, opção 1) | E6.4 | teste fechado e produção da Play |
| G3 | Prazo de 60 dias da marca de exclusão (pergunta 222) | E6.5 | não |
| G4 | "Denunciar" no app (pergunta 221) | E6.6 | teste fechado e produção da Play |
| G5 | Nota do admin e rating no acesso do titular | nenhuma (pergunta 219, opção 1) | — |
| G6 | Apelidos da página `/r` escondidos 7 dias depois da rodada (pergunta 224) | E6.7 | não |
| G7 | Pontos pendentes de uma conta apagada no `sacou.db` (pergunta 225) | E6.8 | não |
| G8 | Conferir `targetSdkVersion` 36 no AAB | aceite da E5.4 | envio à Play |
