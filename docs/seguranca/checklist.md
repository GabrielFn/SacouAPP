# Checklist de segurança

Baseado em **OWASP ASVS 5.0** (API e página web) e **OWASP MASVS 2.1.0** (app), por capítulo ou grupo de controles. A revisão de segurança de cada marco atualiza esta lista (`plano-mvp.md:225`) e detalha os requisitos do capítulo quando houver código.

**Última revisão:** 03/11/2026, sobre `abe25af` (M2, [parecer](revisoes/M2-2026-11-03.md)); antes, 01/11/2026, sobre `2242ad6` (M1, [parecer](revisoes/M1-2026-11-01.md), com o [complemento da E0.6](revisoes/M1-2026-11-01.md#complemento-da-e06-commit-851916e)). O motor da partida é código puro, sem endpoint: o que ele já cobre está como parcial em V2, V15 e MASVS-PRIVACY; o que falta para a E3.7 e a E3.8 está na lista 3.1 de [`modelo-de-ameacas.md`](modelo-de-ameacas.md). Nível do ASVS a seguir: a definir na E6.2.

## ASVS 5.0

| Capítulo | Status | Tarefas que cobrem |
|---|---|---|
| V1 Encoding and Sanitization | Pendente | E3.4, E3.12 |
| V2 Validation and Business Logic | Parcial (motor): envelope e 8 tipos com esquema fechado e falha fechada em TS e C#, chave repetida e UTF-8 inválido recusados, orçamento de 32 níveis e 4096 nós, erro sem eco do valor (E2.1 a E2.11, ADRs 0022 e 0033). API (E3.2, ADR 0039): corpo com chave repetida (em qualquer caixa), campo desconhecido, enum numérico ou com vírgula recusado com 400. Configuração (E3.3, ADR 0041): catálogo fechado, `PATCH` parcial com `null` recusado, folha desconhecida, tipo, faixa e texto recusados com 400 sem o caminho, JSON malformado (chave repetida, *surrogate* solto) como 400, documento de até 8 KiB no banco; o jsonb é lido só pelo parser. Nome do grupo (ADR 0040, D1): NFC, sem controle, formatação, direção, não atribuído, uso privado, *surrogate* solto nem preenchimento invisível, no máximo 4 marcas por grafema e pelo menos uma letra, número ou símbolo. Pendente: limites por bytes, contagem por partida, simulação antes de gravar e conferências de regra de negócio (E3.7, lista 3.1 do modelo de ameaças) | E3.4, E3.7, E3.8, E3.10 |
| V3 Web Frontend Security | Pendente | E3.12 |
| V4 API and Web Service | Parcial (E3.1, E3.2): política de fallback exige login em todo endpoint, `AllowAnonymous` só em `Program.cs` (guarda de texto); 401, 503 e 500 em `ProblemDetails` sem detalhe; erro de regra em `ProblemDetails` com `code` e sem eco do valor (`Sacou.Http`, ADR 0039); corpo com campo desconhecido ou enum numérico recusado em toda a API; corpo das rotas de grupo limitado a 4 KB, com o 413 testado no Kestrel; papel e tipo obrigatórios no corpo (`JsonRequired`); token de convite só no corpo, nunca na URL, e a resposta que o mostra com `Cache-Control: no-store`; sem CORS (app nativo). Pendente: SignalR, webhooks e limite de requisições | E3.7 (SignalR), E3.15, E5.3 |
| V5 File Handling | Pendente | E3.14 |
| V6 Authentication | Parcial (E3.1): senha e tentativas com o Firebase (bloqueio e proteção contra enumeração), só `password`, `google.com` e `apple.com`, sem anônimo nem telefone. Pendente: sessão da página web e login no app | E3.12, E4.3 |
| V7 Session Management | Parcial (E3.1): sessão é o ID token do Firebase (1 h), sem sessão própria na API; sem revogação, risco aceito até a E3.16. Pendente: guarda do token no app, sessão web, token de placar | E3.8, E3.12, E3.16, E4.3 |
| V8 Authorization | Parcial (E3.2): autorização por recurso no Groups, com filtro por grupo segura por padrão (membro ativo lido do banco a cada requisição, uma permissão por rota, teste de guarda sobre todas as rotas da API), 404 idêntico para não membro, tabela de permissões testada nas 40 combinações e matriz ator × rota sobre o Postgres real (M1, as 14 rotas; E3.3: mais 6 rotas de configuração e modelos, 60 linhas, e IDOR de modelo salvo). Regras de alvo no agregado (D4, M7), papel de quem age conferido de novo sob a trava por grupo, IDOR de membro (M6), último admin sob corrida (C1 a C3), IDOR de convite (M10), convites revogados de quem perde o poder, aceite sob a trava (C4 a C6). Pendente: Sessions, placar, pagamentos e planos | E3.4, E3.8, E3.10, E3.15 |
| V9 Self-contained Tokens | Parcial (E3.1): só RS256, `kid` obrigatório e só a chave dele, chaves só da URL fixa do Google, `aud` string única, `iss` exato, `exp`/`iat`/`auth_time` obrigatórios com 60 s, `nbf`, sem tenant, até 8 KB, JWE recusado; matriz R1 a R24 com controle positivo. Pendente: token de placar | E3.8 |
| V10 OAuth and OIDC | Parcial (E3.1): a API é só resource server do Firebase e confere emissor, audiência e provedor. Pendente: o fluxo no app (Google e Apple pelo SDK) | E4.3 |
| V11 Cryptography | Parcial (E3.2): token de convite de 256 bits de `RandomNumberGenerator`, em Base64url, guardado só como SHA-256 (vetor fixo testado), nunca em log nem em outra resposta (ADR 0040, D10). Pendente: token do placar e pagamentos | E3.8, E3.10 |
| V12 Secure Communication | Pendente | E5.1 |
| V13 Configuration | Parcial: CI e dependências conferidas; produção pendente | E0.9, E5.1, E5.3 |
| V14 Data Protection | Pendente | E3.10, E3.16, E5.3, E6.2 |
| V15 Secure Coding and Architecture | Parcial: dependências e análise estática conferidas; domínio C# sem infraestrutura e eventos só com `MemberId`, com testes de arquitetura e de reflexão (E2.10) | E0.9, E6.2 |
| V16 Security Logging and Error Handling | Pendente | E5.2 |
| V17 WebRTC | Pendente | Nenhum documento prevê WebRTC; confirmar se não se aplica na E6.2 |

## MASVS 2.1.0

| Grupo | Status | Tarefas que cobrem |
|---|---|---|
| MASVS-STORAGE | Pendente | E4.3, E4.9 |
| MASVS-CRYPTO | Pendente | E4.3, E4.9 |
| MASVS-AUTH | Pendente | E3.8, E4.3 |
| MASVS-NETWORK | Pendente | E4.2, E4.11 |
| MASVS-PLATFORM | Pendente | E4.9, E4.17 (E4.14 e E4.16 pós-piloto, ADR 0046) |
| MASVS-CODE | Parcial: dependências conferidas; versão mínima pendente | E0.9, E5.3 (versão mínima), E5.4 |
| MASVS-RESILIENCE | Pendente | E5.4, E6.2 |
| MASVS-PRIVACY | Pendente. Motor: eventos e estatísticas só com `MemberId`, sem nome nem nível (M2) | E3.16, E4.13, E5.2, E6.2 |
