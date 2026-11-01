# ADR 0008 · Stack: back-end, app, página web e serviços

**Status:** aceito (decidido em 30/10/2026, registrado em 31/10/2026). **Tarefa:** E0.8.

**Fontes:** `decisoes.md:7, 25, 29, 31`; `produto.md:240-266, 362-363, 367, 393, 400`; `revisao-mvp.md:125-137`. O monorepo está no [ADR 0001](0001-monorepo-pnpm-turborepo.md) e a estrutura dos módulos, no [ADR 0005](0005-estrutura-modular-api.md).

## Contexto

O produto precisa de um app para a quadra (vibração, push e tela ligada, inclusive no iOS), de uma página web para o jogador confirmar sem instalar e de uma API com tempo real e tarefas em segundo plano.

## Decisão

**Back-end.** Monólito modular em ASP.NET Core .NET 10 com Minimal APIs; PostgreSQL no Neon com EF Core; SignalR; Hangfire; Razor Pages para a página da rodada, no mesmo projeto; FirebaseAdmin; Expo Push; Railway plano Hobby.

**App.** Nativo desde a Fase 1: Expo, TypeScript strict, Expo Router, EAS, TanStack Query, Zustand, React Hook Form + Zod, cliente gerado do OpenAPI, Unistyles, expo-sqlite para o log de eventos offline, Reanimated, view-shot, expo-keep-awake e expo-haptics.

**Página da rodada.** Web, para quem não instalou o app, com login uma vez na própria página e meta tags para a prévia no WhatsApp.

**Serviços.** Cloudflare R2 (fotos e backups), RevenueCat, Sentry, PostHog, Resend, rate limiting nativo do ASP.NET Core, feature flags e versão mínima do app, backup diário e varredura de segurança na CI. A varredura é o escopo da E0.9, cujo ADR 0007 ainda não foi mesclado.

**Custo do Hangfire.** Intervalo de consulta alto, para o Neon grátis poder dormir.

## Conflitos entre as fontes

- **Neon:** `produto.md:363` e `revisao-mvp.md:137` oferecem "ou mover o banco para o Railway". Vale `decisoes.md:25`: Neon, com intervalo de consulta alto.
- **E-mail transacional:** `revisao-mvp.md:133` diz "ex.: Resend". Vale `decisoes.md:31`, que fixa o Resend.

## Alternativas

- **Mover o banco para o Railway:** citada acima, não adotada.
- **PWA:** `revisao-mvp.md:84` cita os limites do PWA como risco resolvido pelo app nativo; `produto.md:393` registra a escolha.
- As demais escolhas não têm alternativa documentada.

## Consequências

- Os padrões, inclusive evitar MediatR e AutoMapper, estão no [ADR 0011](0011-backend-patterns.md).
- A compatibilidade do Unistyles com o React Native 0.88 ainda precisa ser validada na E4.1 (ADR 0001).
- **A definir:** valor do intervalo de consulta do Hangfire (E3.11); ferramenta de feature flags e de versão mínima (E5.3); configuração dos ambientes de teste e produção (E5.1). Provedor de IA do resumo: aberto em [`perguntas.md`](../../estado/perguntas.md), item 4.
