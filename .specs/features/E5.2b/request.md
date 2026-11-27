# E5.2b · Falhas inesperadas de login no Sentry

Pedido literal, da conversa de 27/11/2026 entre o Gabriel e o orquestrador (passado pelo orquestrador no brief do analista):

- Gabriel: "o app nao tem observabilidade?"
- Orquestrador propôs: quando o login cair em "unexpected", enviar ao Sentry só o código do erro e de onde veio, sem a mensagem do SDK (pode ter o e-mail, ADR 0057).
- Gabriel: "sem a msg e possivel sempre identificar o erro?"
- Orquestrador: na maioria sim (códigos numéricos do Google Play Services como 10 DEVELOPER_ERROR, 7, 12500; `auth/...` do Firebase). Buracos: erro sem código (TypeError, módulo nativo, resposta do Google sem idToken), códigos genéricos (12500, auth/internal-error), e não saber o passo. Cobrir com: **etapa** (seletor do Google, credencial do Firebase, chamada à API, cadastro/entrada por e-mail), **código**, **nome do tipo do erro** e **pilha**, e sinais booleanos da resposta do Google (sem idToken, type cancelled), sem conteúdo. Mensagem filtrada por `scrub-event.ts` fica de fora por enquanto.
- Gabriel: "sim, abre a tarefa"

Contexto do brief (27/11/2026): o app do teste interno da Play não consegue entrar com Google; a tela mostra "Não deu para entrar agora. Tente de novo." (`apps/mobile/src/strings/auth.pt-BR.ts:35`, falha `unexpected`). O Sentry está ligado no build de produção (E5.2, ADR 0080), mas só recebe travamentos e erros não tratados: `apps/mobile/src/adapters/auth-failure-codes.ts` mapeia todo código desconhecido para `"unexpected"` e nada é reportado. `errorReporter.captureError` só é usado no botão de teste (`features/error-reporting/ui/ErrorTestSection.tsx`).

Capturas: nenhuma. A tarefa não muda tela.
