# Segredos

**Só nomes.** Nunca pedir nem aceitar valor pelo chat, nem colocar em código, log ou commit. O Gabriel cadastra os valores nos segredos do GitHub Actions, no Railway e no `.env` local, que está no `.gitignore`.

Nenhum segredo existe ainda: a CI atual não usa nenhum (ADR 0004). **Os nomes são propostos** até a tarefa que integra cada serviço, que confirma o nome e atualiza esta lista.

| Nome proposto | Serviço | Onde fica | Tarefa |
|---|---|---|---|
| `SACOU_DATABASE_URL` | Postgres (Neon) | Railway; `.env` | E5.1 |
| `SACOU_FIREBASE_SERVICE_ACCOUNT` | Firebase (FirebaseAdmin) | Railway; `.env` | E3.1 |
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

## A definir

- **Provedor de IA do resumo:** nome depende de [`perguntas.md`](../estado/perguntas.md), item 4 (E3.13).
- **Backups no R2:** se usam credencial própria (E5.3).
- **Credenciais das lojas no EAS Submit:** quais e onde ficam (E5.4).
- **`.env` local:** a E0.6 define o que o Postgres de desenvolvimento precisa, sem valor real no repositório.
- **Rotação de segredos e resposta a vazamento:** o procedimento de vazamento na CI é escopo da E0.9, ainda sem merge; a rotação de cada segredo é da tarefa que o integra.
