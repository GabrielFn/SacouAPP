# Checklist de segurança

Baseado em **OWASP ASVS 5.0** (API e página web) e **OWASP MASVS 2.1.0** (app), por capítulo ou grupo de controles. A revisão de segurança de cada marco atualiza esta lista (`plano-mvp.md:225`) e detalha os requisitos do capítulo quando houver código.

**Tudo está pendente:** esta lista ainda não atesta nada, mesmo onde já existe código de fundação ou configuração, porque nenhuma revisão com este checklist foi feita. Nível do ASVS a seguir: a definir na E6.2.

## ASVS 5.0

| Capítulo | Status | Tarefas que cobrem |
|---|---|---|
| V1 Encoding and Sanitization | Pendente | E3.4, E3.12 |
| V2 Validation and Business Logic | Pendente | E3.4, E3.7, E3.8, E3.10 |
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
| V13 Configuration | Pendente | E0.9, E5.1, E5.3 |
| V14 Data Protection | Pendente | E3.10, E3.16, E5.3, E6.2 |
| V15 Secure Coding and Architecture | Pendente | E0.9, E6.2 |
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
| MASVS-CODE | Pendente | E0.9, E5.3 (versão mínima), E5.4 |
| MASVS-RESILIENCE | Pendente | E5.4, E6.2 |
| MASVS-PRIVACY | Pendente | E3.16, E4.13, E5.2, E6.2 |
