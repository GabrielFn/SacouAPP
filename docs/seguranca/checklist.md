# Checklist de segurança

Baseado em **OWASP ASVS 5.0** (API e página web) e **OWASP MASVS 2.1.0** (app), por capítulo ou grupo de controles. A revisão de segurança de cada marco atualiza esta lista (`plano-mvp.md:225`) e detalha os requisitos do capítulo quando houver código.

**Última revisão:** 03/11/2026, sobre `abe25af` (M2, [parecer](revisoes/M2-2026-11-03.md)); antes, 01/11/2026, sobre `2242ad6` (M1, [parecer](revisoes/M1-2026-11-01.md), com o [complemento da E0.6](revisoes/M1-2026-11-01.md#complemento-da-e06-commit-851916e)). O motor da partida é código puro, sem endpoint: o que ele já cobre está como parcial em V2, V15 e MASVS-PRIVACY; o que falta para a E3.7 e a E3.8 está na lista 3.1 de [`modelo-de-ameacas.md`](modelo-de-ameacas.md). Nível do ASVS a seguir: a definir na E6.2.

## ASVS 5.0

| Capítulo | Status | Tarefas que cobrem |
|---|---|---|
| V1 Encoding and Sanitization | Pendente | E3.4, E3.12 |
| V2 Validation and Business Logic | Parcial (motor): envelope e 8 tipos com esquema fechado e falha fechada em TS e C#, chave repetida e UTF-8 inválido recusados, orçamento de 32 níveis e 4096 nós, erro sem eco do valor (E2.1 a E2.11, ADRs 0022 e 0033). Pendente: limites por bytes, contagem por partida, simulação antes de gravar e conferências de regra de negócio (E3.7, lista 3.1 do modelo de ameaças) | E3.4, E3.7, E3.8, E3.10 |
| V3 Web Frontend Security | Pendente | E3.12 |
| V4 API and Web Service | Pendente | E3.1, E3.7 (SignalR), E3.15 |
| V5 File Handling | Pendente | E3.14 |
| V6 Authentication | Pendente | E3.1, E3.12 |
| V7 Session Management | Pendente | E3.1, E3.8, E3.12 |
| V8 Authorization | Pendente | E3.2, E3.8, E3.10, E3.15 |
| V9 Self-contained Tokens | Pendente | E3.1, E3.8 |
| V10 OAuth and OIDC | Pendente | E3.1 |
| V11 Cryptography | Pendente | E3.8, E3.10 |
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
| MASVS-PLATFORM | Pendente | E4.14, E4.16 |
| MASVS-CODE | Parcial: dependências conferidas; versão mínima pendente | E0.9, E5.3 (versão mínima), E5.4 |
| MASVS-RESILIENCE | Pendente | E5.4, E6.2 |
| MASVS-PRIVACY | Pendente. Motor: eventos e estatísticas só com `MemberId`, sem nome nem nível (M2) | E3.16, E4.13, E5.2, E6.2 |
