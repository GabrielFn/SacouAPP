# Segredos

**Só nomes.** Nunca pedir nem aceitar valor pelo chat, nem colocar em código, log ou commit. O Gabriel cadastra os valores nos segredos do GitHub Actions, no Railway e no `.env` local, que está no `.gitignore`.

Nenhum segredo existe ainda: a CI atual não usa nenhum (ADR 0004). **Os nomes são propostos** até a tarefa que integra cada serviço, que confirma o nome e atualiza esta lista.

**Não são segredos** (E3.1, [ADR 0036](../arquitetura/adr/0036-verificacao-do-token-e-usuario.md)): `Firebase:ProjectId` (`sacou-79493`) é configuração pública, vai dentro do app e fica versionado em `apps/api/src/Sacou.Api/appsettings.json`; a variável `Firebase__ProjectId` só se um ambiente precisar trocar. `Database:MigrateOnStartup` também não.

| Nome proposto | Serviço | Onde fica | Tarefa |
|---|---|---|---|
| `POSTGRES_PASSWORD` | Postgres local do `docker-compose.yml`, só desenvolvimento; sem segredo no GitHub Actions (a CI usa o marcador de `.env.example`) | `.env` | E0.6 |
| `ConnectionStrings__Sacou` | Conexão da API com o Postgres. Local: exportada no shell a partir do `POSTGRES_PASSWORD` do `.env` ([`postgres-local.md`](../operacao/postgres-local.md)); produção: a E5.1 mapeia o `SACOU_DATABASE_URL` | Shell local; Railway (E5.1) | E3.1 |
| `SACOU_DATABASE_URL` | Postgres (Neon) | Railway; `.env` | E5.1 |
| `SACOU_FIREBASE_SERVICE_ACCOUNT` | Firebase (FirebaseAdmin), só para administrar contas. **Não é usada na E3.1** (a verificação do token não precisa dela). Formato: o JSON baixado do console, em **Base64 padrão numa linha só, sem aspas**. A E3.16 decodifica, confere `type = service_account` e `project_id` igual a `Firebase:ProjectId`, e nunca registra o valor nem o erro de parse. **Não cadastrar no GitHub Actions** | Railway; `.env` | E3.16 |
| `SACOU_R2_ACCESS_KEY_ID` | Cloudflare R2 | Railway; `.env` | E3.14 |
| `SACOU_R2_SECRET_ACCESS_KEY` | Cloudflare R2 | Railway; `.env` | E3.14 |
| `SACOU_REVENUECAT_API_KEY` | RevenueCat | Railway; `.env` | E3.15 |
| `SACOU_REVENUECAT_WEBHOOK_AUTH` | RevenueCat; só se a E3.15 usar webhook | Railway; `.env` | E3.15 |
| `SACOU_SENTRY_DSN` | Sentry | Railway; `.env` | E5.2 |
| `SENTRY_AUTH_TOKEN` | Sentry (envio de símbolos no build) | GitHub Actions | E5.2 |
| `SACOU_POSTHOG_API_KEY` | PostHog | Railway; `.env` | E5.2 |
| `SACOU_RESEND_API_KEY` | Resend | Railway; `.env` | E3.11 |
| `EXPO_TOKEN` | EAS | GitHub Actions | E5.4 |
| `SACOU_PIX_ENCRYPTION_KEY` | Chave de criptografia do Pix | Railway; `.env` | E3.10 |
| `SACOU_SCOREKEEPER_TOKEN_SIGNING_KEY` | Assinatura do token de placar; só se a E3.8 usar token assinado | Railway; `.env` | E3.8 |

**Testes de integração:** não leem `.env` nem variável de ambiente. As chaves RSA e os certificados que assinam os ID tokens de teste são gerados em memória a cada execução (`apps/api/tests/TestSupport/TestSigningKeys.cs`); nenhuma chave fica no repositório. O Testcontainers gera uma senha aleatória a cada execução, só em memória, e nunca a registra (ADR 0020).

## A definir

- **Provedor de IA do resumo:** nome depende de [`perguntas.md`](../estado/perguntas.md), item 4 (E3.13).
- **Backups no R2:** se usam credencial própria (E5.3).
- **Credenciais das lojas no EAS Submit:** quais e onde ficam (E5.4).
- **Rotação de segredos e resposta a vazamento:** o procedimento de vazamento está em [`varredura-ci.md`](varredura-ci.md), seção "Resposta a vazamento"; a rotação de cada segredo é da tarefa que o integra.
