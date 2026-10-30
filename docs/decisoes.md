# Decisões consolidadas (30/10/2026)

Fonte da verdade quando os outros documentos divergirem. Atualize este arquivo quando o Gabriel decidir algo novo.

## Produto

- **Nome:** Sacou. App nativo desde a Fase 1 (Expo); página da rodada na web para quem não instalou (login uma vez na própria página).
- **Configuração herdada:** grupo → rodada → partida. Tudo opcional (cobrança, limite de vagas, sets, pontos, tie-break, placar, rotação, fila, sorteio). Modelos: Pelada descontraída, Racha organizado, Treino, Areia rei da quadra, Do zero.
- **Padrão de partida:** 1 set, com opção de mudar.
- **Membros:** mensalista x avulso. **Convidado é sempre avulso, nunca mensalista.** Papéis Admin, Co-admin, Placar.
- **Fila "quem perde sai":** saída parcial. Se há menos gente esperando que um time, sai do perdedor só o número de quem espera, pelo critério configurável (padrão: mais partidas seguidas). Quem entra assume a posição de quem saiu. Ninguém esperando → ninguém sai. Avulsos que saíram e somam um time formam time por ordem de chegada.
- **Rotação:** cada time tem a sua (sistema, escalação, levantador, rotação atual, banco). Gira só quem ganha o side-out. Livre/6x0 grátis; 4x2, 5x1 e 6x2 no Pro. Posições mostradas **no momento do saque**, nunca depois. Id interno da rotação: `setterZone`. Modo de regra: FIVB 2025–28 (padrão; só o time que recebe tem restrição de sobreposição) ou Clássico. Detalhes em `docs/dominio/rotacoes.md`.
- **Banco no MVP:** "sai quem saca" e manual.
- **Ponto individual (Pro, opção do grupo):** "De quem foi?" fica aberto sem limite de tempo; o próximo ponto fecha. Sem resposta, o ponto fica sem autor e pode ser preenchido depois (Corrigir ou fim de set).
- **MVP do dia:** padrão calculado por dados (saldo +/− em quadra, aproveitamento, sequência, ganho de rating). Votação = opção do grupo.
- **Rating:** Glicko-2, separado quadra x areia. Conversão: 1500 = 3,0; cada 100 pontos = 0,5; limitado a 1–5. Nível autodeclarado é a semente. Privado no app; aparece na cartinha por padrão (o jogador pode esconder). Admin vê os níveis no sorteio, nunca na imagem compartilhada. Ranking do grupo nunca por nível.
- **Faixas da cartinha:** Bronze ≤ 2,4 · Prata 2,5–3,4 · Ouro 3,5–4,4 · Elite ≥ 4,5.
- **Foto da cartinha (Fase 1):** recorte da silhueta no celular (Vision no iOS, ML Kit no Android, módulo nativo Expo); pincel apagar/restaurar; enquadramento. Salva em R2 como WebP sem EXIF. ONNX no servidor fica para depois. Denúncia de foto.
- **Login:** Google, Apple (obrigatório no iOS) e e-mail/senha via Firebase Auth. Sem telefone. Botões de login só aparecem para quem está deslogado.
- **Planos:** Pro do Grupo e Sacou+ do Jogador (o plano do jogador está confirmado). Preços **propostos, ainda não confirmados**: Pro do Grupo R$ 12,90/mês ou R$ 99/ano; Sacou+ R$ 5,90/mês ou R$ 44,90/ano. Cobrança pelas lojas via RevenueCat. Pix copia e cola só para mensalidade/diária do racha. Nada pago dá vantagem em quadra. No piloto, Pro liberado de graça. Controle por `IGroupPlan` e `IUserPlan`.
- **Placar por QR:** sessão temporária de Placar daquela quadra; um celular escreve por vez; o admin pode retomar. No MVP pede-se instalar o app.

## Arquitetura

- **Backend:** monólito modular ASP.NET Core .NET 10, Minimal APIs, DDD enxuto + Vertical Slice, Clean Code. PostgreSQL (Neon) + EF Core, SignalR, Hangfire (intervalo de consulta alto por causa do Neon), Razor Pages (página da rodada), FirebaseAdmin, Expo Push, Railway Hobby.
- **Event sourcing por `CourtSession`** (quadra da rodada), com as partidas dentro. Eventos gravam o **resultado** das regras (quem saiu, quem entrou, nova posição); o servidor aplica eventos sem reimplementar toda a lógica. `SchemaVersion` nos eventos, `rulesVersion` na partida, cópia congelada de configurações e formações no início. Desfazer é evento (`RevertedTo`), nunca apaga. Envelope com ID do celular, sequência e lote.
- **Padrões:** Strategy (`IRotationSystem`, `IQueueExitCriterion`, `IBenchRule`, `ITeamBalancer`), SettingsResolver em jsonb, Outbox, idempotência, concorrência otimista (`xmin`), Result pattern, autorização por recurso, CQRS leve, testes golden compartilhados TS/C#. Sem MediatR e AutoMapper.
- **Dados pessoais:** nada pessoal nos eventos; tudo aponta para `MemberId`. Exclusão e exportação de conta (LGPD); quem sai vira "Ex-jogador" no histórico.
- **App:** Expo + TypeScript strict, Expo Router, EAS, TanStack Query, Zustand, React Hook Form + Zod, cliente gerado do OpenAPI, Unistyles, expo-sqlite (log de eventos offline), Reanimated, view-shot, expo-keep-awake/haptics.
- **Monorepo:** pnpm + Turborepo — `apps/mobile`, `apps/api`, `packages/match-engine` (TS puro), `packages/volley-rules` (formações, faixas, Pix, testes golden).
- **Serviços:** Cloudflare R2 (fotos e backups), RevenueCat, Sentry, PostHog, Resend, rate limiting nativo do ASP.NET Core, feature flags e versão mínima do app, backup diário, varredura de segurança na CI.

## Processo

- Agentes: analista → desenvolvedor → revisor (novo) → revisor de segurança (tarefas sensíveis) → testador (novo) → merge.
- **Merge automático** na `main` quando revisão e testes passam.
- Sessões contínuas (o plano previa uma tarefa agendada a cada 4 horas; no PC, rodar sessões quando quiser — ver `LEIA-ME.md`).
