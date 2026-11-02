# Inventário de dados pessoais (LGPD)

Registra o que os documentos preveem. Nenhum desses dados é coletado ou guardado ainda; o único código que já toca um deles é o gerador puro do Pix (E1.4), que recebe a chave e não a guarda nem registra. Decisões no [ADR 0012](../arquitetura/adr/0012-personal-data-member-id.md).

**Pendências do Gabriel, em [`perguntas.md`](../estado/perguntas.md):**

- **Retenção e base legal: a definir** (item 2), para todas as linhas abaixo, inclusive backups. Por isso as tabelas não têm essas colunas preenchidas.
- **Encarregado de dados: a definir** (item 3). `produto.md:372` exige o canal, mas não diz quem é nem o contato.
- **Provedor de IA do resumo: a definir** (item 4).
- **Região de armazenamento de cada serviço e transferência internacional:** nenhum documento define; a definir na E6.2.

## Conta e perfil

| Dado | Onde fica | Por quê | Fonte | Na exclusão |
|---|---|---|---|---|
| E-mail, senha gerida pelo provedor, identificador Google ou Apple | Firebase Auth | Login | `decisoes.md:19` | Usuário apagado no Firebase (`produto.md:371`) |
| Dados de conta guardados na API | Postgres (Neon); quais: a definir na E3.1 | Vincular usuário e membro | `produto.md:250, 259` | A definir na E3.16 |
| Apelido | Postgres (Neon) | Identificar nas listas e times | `produto.md:63` | Perfil apagado; histórico como "Ex-jogador" (`produto.md:371`) |
| Posições | Postgres (Neon) | Sorteio e escalação | `produto.md:63` | Perfil apagado |
| Nível autodeclarado e rating (quadra e areia) | Postgres (Neon) | Sorteio e cartinha; privado | `decisoes.md:16` | Perfil apagado; projeções de rating a definir na E3.16 |
| Preferência de mostrar nível e foto; consentimento | Postgres (Neon) | Cartinha | `decisoes.md:16`; `produto.md:373` | A definir na E3.16 |
| Foto da cartinha (recorte, WebP sem EXIF) | Cloudflare R2 | Cartinha | `decisoes.md:18` | Foto apagada (`produto.md:371`) |
| Denúncia de foto | A definir na E3.14 | Moderação | `produto.md:374` | A definir na E3.14 |

## Grupo e rodada

| Dado | Onde fica | Por quê | Fonte | Na exclusão |
|---|---|---|---|---|
| Vínculo com o grupo, papel, mensalista ou avulso (`MemberId`) | Postgres (Neon) | Organização e autorização | `decisoes.md:10, 28` | Histórico como "Ex-jogador" (`decisoes.md:28`) |
| Convidado sem conta (nome informado pelo admin) | Postgres (Neon) | Incluir quem não instalou | `produto.md:64, 224` | Sem conta para excluir: pedido e aviso a definir na E3.5 e na E6.2 |
| Presença e lista de espera | Postgres (Neon) | Rodada | `produto.md:64` | Histórico como "Ex-jogador" |
| Eventos da quadra | Postgres (Neon) e expo-sqlite no aparelho | Placar, fila, desfazer. **Só IDs, nenhum dado pessoal** | `decisoes.md:26, 28`; `decisoes.md:29` | Eventos ficam; apontam para `MemberId` |
| ID do celular no envelope do evento | Postgres (Neon) e expo-sqlite | Sequência e sincronização | `decisoes.md:26` | A definir na E2.1 e na E6.2 (se identifica a pessoa) |
| Estatísticas, MVP e projeções | Postgres (Neon) | Cartinha, ranking e resumo | `revisao-mvp.md:111` | Histórico como "Ex-jogador" |
| Resumo da rodada com IA | A definir na E3.13 | Compartilhar | `produto.md:70` | A definir na E3.13 |

## Pagamentos

| Dado | Onde fica | Por quê | Fonte | Na exclusão |
|---|---|---|---|---|
| Chave Pix do organizador, que pode ser um dado pessoal | Postgres (Neon), criptografada | Gerar o copia e cola (gerador puro na E1.4: não guarda nem registra a chave, e erro só leva código). O código gerado contém a chave: nunca vai para log, evento, telemetria ou URL, e quem o recebe vê a chave, o que é inerente ao Pix e deve constar no aviso de privacidade (E3.10) | `produto.md:65, 375` | A definir na E3.16 |
| "Já paguei", confirmação e quem marcou | Postgres (Neon) | Controle do racha | `produto.md:65` | A definir na E3.16 |
| Assinatura dos planos | RevenueCat e lojas | Cobrança | `decisoes.md:20` | A definir na E3.15 e na E3.16 |

## Serviços externos

| Dado | Onde fica | Por quê | Fonte | Na exclusão |
|---|---|---|---|---|
| Token de push | Expo Push; onde a API guarda: a definir na E3.11 | Notificações | `decisoes.md:25` | A definir na E3.16 |
| E-mail do destinatário e conteúdo | Resend | E-mail transacional | `decisoes.md:31` | A definir na E6.2 |
| Erros e contexto técnico | Sentry | Observabilidade. Logs sem e-mails nem tokens (`produto.md:375`) | `decisoes.md:31` | A definir na E5.2 e na E6.2 |
| Eventos de uso; identificador: a definir na E5.2 | PostHog | Medir o portão da Fase 2 (`revisao-mvp.md:132`) | `decisoes.md:31` | A definir na E5.2 e na E6.2 |
| Dados enviados ao resumo com IA | Provedor a definir (`perguntas.md`, item 4) | Gerar o texto | `produto.md:70` | A definir na E3.13 |
| Cópia do banco | Cloudflare R2 (backup diário) | Restauração | `decisoes.md:31` | A definir na E5.3 e na E6.2 (`perguntas.md`, item 2) |
| IP e logs de acesso | API e Railway, limite de requisições, Firebase Auth, Sentry e o que Cloudflare e R2 registrarem | Segurança e operação | Revisão do M1 | Retenção e conteúdo a definir na E5.2 e na E6.2 (`perguntas.md`, item 2) |
| Autor e e-mail em commits e logs da CI, só de desenvolvedores | GitHub, repositório privado | Histórico e auditoria | Revisão do M1 | Não se aplica a jogadores |

## Direitos do titular

- **Exclusão:** dentro do app; apaga perfil, foto e usuário no Firebase; o histórico fica como "Ex-jogador" (`produto.md:371`, E3.16). O que restar em R2, backups e terceiros é conferido na E6.2.
- **Exportação:** prevista (`decisoes.md:28`); formato a definir na E3.16.
- **Ex-jogador:** o `MemberId` continua nos eventos. Se isso ainda é dado pessoal, e por quanto tempo: a definir na E6.2, com o item 2 de `perguntas.md`.
