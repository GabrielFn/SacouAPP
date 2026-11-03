# Modelo de ameaças

STRIDE por componente: **S**poofing, **T**ampering, **R**epudiation, **I**nformation disclosure, **D**enial of service, **E**levation of privilege.

Já têm código a CI (seção 11), o gerador puro do Pix (E1.4, seção 6) e, no motor em TS, o parser do envelope, o replay e os parsers e aplicadores do placar (E2.1 e E2.2, seção 3), ainda sem servidor nem app que os use; os demais componentes não têm código. Fora da seção 11, "Mitigação" é o que os documentos **decidiram**, não o que já existe; o que está implementado é conferido no [checklist](checklist.md). Sem decisão, consta "a definir na E\<ID\>". Cada tarefa da lista atualiza sua seção.

## 1. Login (Firebase Auth, E3.1)

| | Ameaça | Mitigação |
|---|---|---|
| S | Token forjado ou de outro projeto | API valida com FirebaseAdmin (`produto.md:250`); token inválido é recusado (aceite da E3.1) |
| S | Tentativas repetidas de senha | Limite de requisições (`decisoes.md:31`) só na API; proteção específica a definir na E3.1 |
| T | Token alterado | Mesma validação |
| R | Negar uma ação feita com a conta | A definir na E5.2 (quais ações registrar nos logs estruturados) |
| I | Token ou e-mail em logs | Logs sem e-mails nem tokens (`produto.md:375`) |
| I | Token exposto no celular | A definir na E4.3 |
| D | Excesso de chamadas de login | Limite de requisições (`decisoes.md:31`); valores a definir na E5.3 |
| E | Conta de convidado reivindicada por outra pessoa | Reivindicação por link (`revisao-mvp.md:114`); proteção do link a definir na E3.5 |

## 2. API e autorização por recurso

| | Ameaça | Mitigação |
|---|---|---|
| S | Convite por link ou QR repassado a estranhos | A definir na E3.2 |
| T | Disputa pela última vaga | Concorrência otimista com `xmin` (`produto.md:310`) |
| T | Reconfigurar grupo ou rodada sem poder | Autorização por recurso (`decisoes.md:27`) |
| R | Admin nega uma alteração | A definir na E5.2 |
| I | Nível privado lido pela API | Privado garantido na API, não só na tela (`produto.md:373`) |
| I | Dados pessoais em respostas de erro | Erro de regra vira `ProblemDetails` (`produto.md:311`); conteúdo a definir com o primeiro endpoint |
| D | Abuso de requisições | Limite de requisições (`decisoes.md:31`); valores a definir na E5.3 |
| E | Acessar recurso de outro grupo | Policies verificam o papel no grupo (`produto.md:312`) |
| E | Papel Placar com mais poderes | Placar opera a quadra sem outros poderes (`produto.md:62`) |

## 3. Sincronização de eventos (E3.7)

| | Ameaça | Mitigação |
|---|---|---|
| S | Celular se passar por outro no envelope | O ID do celular não autentica. Quem pode escrever: a definir na E3.7, com o token de placar da seção 4 |
| T | Evento inconsistente ou forjado: o servidor aplica o resultado sem reimplementar a lógica (`decisoes.md:26`) | Validação do que chega a definir na E3.7. **O evento prova formato, não verdade (E2.2):** `SetEnded` falso passa no replay, e `MemberId` em UUID válido pode não ser do grupo. **Forjar evento vai além de marcar ponto:** marcar pontos não permite vencedor contrário ao placar, trocar `teams` nem baixar `scoring`, mas o replay aceita `MatchEnded` `sets-won` com `winner` contrário aos sets, e fila e estatísticas dependem desses campos. A E3.7 precisa simular o replay e conferir `teams` contra a escalação da rodada, `scoring` contra a configuração resolvida, `SetEnded` contra o placar, `nextSet.targetPoints` contra `scoring` e `MatchEnded` pela regra, com as funções portadas (ADR 0023). Conferir só o `MatchEnded` não basta: `SetEnded` com vencedor em 0–0, duas vezes, seguido de `MatchEnded` `sets-won`, é aceito com sets 2–0. O `winner` de `manual` não é verificável pela regra e precisa de regra própria de autoria ou permissão. O módulo Stats não confia no evento sem isso. **Saque e rotação (E2.3, ADR 0024):** `rotations`, `firstServer`, `nextSet.firstServer` e `nextSet.setterZones` passam no replay mesmo falsos e mudam quem saca. A E3.7 confere `rotations` contra a escalação, `nextSet.firstServer` contra a regra ou um sorteio autorizado e `setterZones` contra o estado. O `firstServer` do sorteio vem de fora do motor: a E3.7 define como autorizá-lo. Marcar ponto não define a rotação diretamente, porque o side-out é derivado do estado; mas o replay aceita ponto além do placar decidido, e pontos alternados levam o time a qualquer zona, ao custo de alterar o placar. A E3.7 recusa ponto em set já decidido na simulação. **Sistema e catálogo (E2.4, ADR 0026):** `rotations.*.system` forjado passa no replay e permitiria usar sistema Pro (4x2, 5x1, 6x2) em grupo grátis, sem vantagem em quadra, mas burlando o plano: a E3.7 confere `system` contra `IGroupPlan` na escrita. `formationsVersion` forjado só faz as posições sumirem para quem assiste àquela partida, porque versão desconhecida dá `null`: a E3.7 confere o número na escrita. **Banco e escalação (E2.5, ADR 0027):** um `LineupChanged` forjado escolhe quem está em quadra, quem saca e, por `setterZone`, a rotação, com efeito em saldo e rating; `rotations.*.bench` forjado no `MatchStarted` também define quem começa no banco. O replay só prova que é uma partição de `teams`. A E3.7 autoriza `LineupChanged` por papel e sessão, confere `MatchStarted.bench` contra a escalação e conta eventos por partida |
| T | Envelope malformado ou entrada não confiável, inclusive `__proto__` e `NaN` | Parser do envelope com esquema fechado e falha fechada (E2.1, só TS). A E2.10 porta para o C#; a E3.7 usa no servidor. `replayEvents` confia em quem chama: só aceita saída do parser. Parser estrito por tipo para `MatchStarted`, `PointScored`, `SetEnded` e `MatchEnded`, com esquema fechado em todos os níveis (E2.2, ADR 0023). **Lacuna:** os tipos das E2.3+ só com o parser de cada um; o envelope continua aceitando `type` livre de até 64 caracteres, e o que não tem aplicador é `unknown-event-type` |
| T | Reenvio duplicar pontos | Idempotência com ID gerado no celular (`produto.md:309`) |
| R | Negar uma correção | Desfazer é evento e nunca apaga (`decisoes.md:26`); autoria a definir na E3.7 |
| I | Dado pessoal gravado no stream | Eventos só com IDs (`decisoes.md:28`). Esquema fechado do envelope com teste de nomes proibidos (E2.1, achado A4). Os 4 tipos do placar têm esquema fechado em todos os níveis, com teste de nomes proibidos por tipo e nível (E2.2), inclusive nos níveis novos `rotations`, `rotations.a`, `rotations.b` e `nextSet.setterZones` (E2.3). `rotations.*.system` só aceita a lista `FORMATION_SYSTEMS`, e `formationsVersion` só inteiro ≥ 1, com erro que não ecoa o valor (E2.4). `rotations.*.lineup` só aceita `MemberId` em UUID contido em `teams` do próprio lado. `LineupChanged` tem esquema fechado, com teste de nomes proibidos, e `lineup` e `bench`, nele e no `MatchStarted`, só levam `MemberId` em UUID da partição de `teams`, com erro que não ecoa o valor; sem dado pessoal novo (E2.5). **Lacunas:** o payload dos tipos das E2.3+ é aberto até cada um ter parser, e a regra em C# fica na E2.10 ou E3.7 |
| I | Valor recebido devolvido em erro | Erro só com `code` e `eventId` ou `field`; nome de campo desconhecido não volta; teste canário (E2.1) |
| I | ID do celular rastreável | UUID aleatório por instalação, nunca de hardware (E4.9); autoria fora do evento ([inventário](dados-pessoais.md)) |
| I | Log de eventos no aparelho (expo-sqlite) | A definir na E4.9 |
| D | Lote grande ou volume alto de eventos | Limite de requisições (`decisoes.md:31`); tamanho do lote a definir na E3.7. O parser limita o payload a 32 níveis e 4096 valores, com referência repetida contada a cada visita, e o `type` a 64 caracteres (E2.1). `LineupChanged` só permuta membros: não aumenta o estado, e o payload tem no máximo 30 valores (E2.5). O estado para de crescer em 200 partidas terminadas (`MAX_FINISHED_MATCHES`, E2.2): novo `MatchStarted` é `event-rejected`, o que barra o crescimento quadrático de memória e tempo. **Lacunas:** o parser não limita o tamanho dos textos nem o total do payload, nem o número de eventos, a cargo do servidor (E3.7). A falta de memória continua possível de forma linear, que o `try/catch` não pega: cerca de 78 MB de log derrubam o parser com heap de 256 MB. Simular o stream inteiro a cada lote soma custo: a E3.7 limita o lote por bytes e por eventos e dimensiona o limite de requisições, ou usa snapshot. Com 64 mil eventos, parser e replay levaram cerca de 1 s no caso barato, só de pontos; o pior caso medido tem 4,2 vezes mais bytes e leva cerca de 5 vezes mais tempo. Com rotação ligada, 24 membros por time e side-out em todo ponto (E2.3, Node 22, sem Hermes), 64 mil eventos somam 18,9 MB de log e retêm 22,7 MB (372 B por evento, contra 292 B sem side-out); a mediana do replay sobe cerca de 30%, de 1,2 s para 1,57 s, em máquina ocupada, e o crescimento segue linear. Com heap de 256 MB, 192 mil eventos passam e 256 mil derrubam o processo. Quem tem token de placar pode gastar a cota de partidas com 400 eventos válidos (cerca de 160 KB), e novas partidas ficam recusadas até um `RevertedTo`: a E3.7 cobre isso com limite de requisições e as conferências acima |
| D | Evento ruim gravado trava a quadra, porque a falha fechada impede recalcular o stream. Inclui ponto de set já encerrado e, com a ordem por `batch`, evento anterior ao `MatchStarted` (E2.2) | A E3.7 simula o replay antes de persistir e rejeita ali; o mesmo no log local (E4.9) |
| E | Escrever em stream de outra quadra | Token de placar só daquele stream (`produto.md:357`); autorização do admin por recurso (`decisoes.md:27`) |

**Limite do parser (E2.1):** `MAX_PAYLOAD_NODES` conta nós, não bytes. O corpo da requisição precisa de limite de tamanho antes do parser (E3.7).

## 4. QR do placar (E3.8)

Sessão daquela quadra, conforme `decisoes.md:21` e [ADR 0013](../arquitetura/adr/0013-scorekeeper-qr-token.md).

| | Ameaça | Mitigação |
|---|---|---|
| S | QR fotografado ou repassado | Código de uso único (`produto.md:357`); validade a definir na E3.8 |
| S | Adivinhar o código | Formato e tamanho a definir na E3.8; limite de requisições (`decisoes.md:31`) |
| T | Dois celulares escrevendo | Um celular escreve por vez (`decisoes.md:21`); celular antigo é recusado após a entrega (aceite da E3.8) |
| R | Identificar quem marcou com a sessão temporária | A definir na E3.8 |
| I | Token de placar em logs | Logs sem tokens (`produto.md:375`) |
| D | Admin perde o controle da quadra | O admin pode retomar (`decisoes.md:21`) |
| E | Token usado em outro stream ou outra ação | Válido só para aquele stream, sem outros poderes (`produto.md:121, 357`) |
| E | Token continua válido depois da sessão | Validade e revogação a definir na E3.8 |

## 5. Upload de foto (E3.14)

| | Ameaça | Mitigação |
|---|---|---|
| S | Enviar foto para o perfil de outra pessoa | A definir na E3.14 |
| T | Arquivo que não é imagem, ou fora do formato | Validação a definir na E3.14 |
| R | Negar o envio de foto imprópria | A definir na E3.14 |
| I | Localização ou aparelho nos metadados | WebP sem EXIF, só o recorte (`decisoes.md:18`) |
| I | Foto mostrada sem consentimento | Consentimento na cartinha (`produto.md:373`) |
| I | Foto acessível por URL depois da exclusão | Exclusão apaga a foto (`produto.md:371`); acesso aos arquivos no R2 a definir na E3.14 |
| I | Foto imprópria de terceiro | Denúncia, bloqueio e remoção (`produto.md:374`) |
| D | Arquivos enormes gerando custo | Limite de tamanho a definir na E3.14 |
| E | Credencial do R2 exposta no app | Como o app envia o arquivo: a definir na E3.14 |

## 6. Pix copia e cola (E3.10)

| | Ameaça | Mitigação |
|---|---|---|
| S | Jogador marca pagamento que não fez | "Já paguei" exige confirmação do admin (`produto.md:65`) |
| T | Troca da chave Pix do organizador por outra | Autorização por recurso (`decisoes.md:27`); registro da alteração a definir na E3.10 |
| T | Código copia e cola adulterado | CRC16 detecta erro, mas não prova origem (E1.4); proteção contra adulteração a definir na E3.10 |
| R | Disputa sobre quem confirmou | Exibido como "pago (marcado por Fulano)" (`produto.md:65`) |
| I | Chave Pix vazada do banco | Criptografada no banco (`produto.md:375`); algoritmo e gestão da chave a definir na E3.10 |
| T | Campo forjado no código por entrada que não é string (array passa na regex por coerção) | Gerador rejeita o que não é string (E1.4). A E3.10 valida o tipo também na fronteira |
| T | Chave com formato certo, mas CPF ou CNPJ inexistente | O gerador só confere formato (E1.4). A E3.10 confere o dígito verificador de CPF e CNPJ |
| I | Chave Pix vazada por log, evento, telemetria ou URL | Gerador puro, sem log (E1.4): erro só com `code`. O teste canário cobre só o resultado do erro, **não log**. O código gerado contém a chave; a E3.10 não pode enviá-lo a esses destinos e precisa cobrir isso com teste próprio |
| I | Pagador vê a chave do organizador no código | Inerente ao Pix; deve constar no aviso de privacidade (E3.10) |
| I | Exposição de devedores | Lembrete neutro, nunca lista pública (`produto.md:65`) |
| D | Geração abusiva de códigos | Limite de requisições (`decisoes.md:31`) |
| E | Não admin confirma pagamento | Confirmação do admin (`produto.md:65`) com autorização por recurso (`decisoes.md:27`) |

## 7. Webhooks da RevenueCat (E3.15)

Nenhum documento descreve como a API recebe o estado da assinatura; o webhook é uma hipótese a confirmar na E3.15. No piloto o Pro é liberado de graça (`decisoes.md:20`).

| | Ameaça | Mitigação |
|---|---|---|
| S | Chamada forjada liberando o Pro | A definir na E3.15 |
| T | Conteúdo alterado | A definir na E3.15 |
| R | Disputa sobre o estado da assinatura | A definir na E3.15 |
| I | Dados pessoais vindos da RevenueCat | A definir na E3.15 |
| D | Repetição ou excesso de chamadas | Limite de requisições (`decisoes.md:31`); idempotência a definir na E3.15 |
| E | Plano aplicado a outro grupo | Ligação da assinatura ao grupo a definir na E3.15 |

## 8. Página web da rodada (E3.12)

| | Ameaça | Mitigação |
|---|---|---|
| S | Sessão roubada na página | Login na própria página (`decisoes.md:7`); sessão a definir na E3.12 |
| S | Confirmar presença por outra pessoa | VOU exige login (`produto.md:115`) |
| T | Conteúdo malicioso em apelidos ou textos | A definir na E3.12 |
| T | Ação disparada por outro site | A definir na E3.12 |
| R | Negar a confirmação | A definir na E3.12 |
| I | Prévia no WhatsApp ou página aberta mostrando demais: a prévia traz título e contagem (`produto.md:115`) | O que aparece sem login: a definir na E3.12. Nível nunca (`decisoes.md:16`) |
| D | Abuso da página pública | Limite de requisições (`decisoes.md:31`) |
| E | Ação de admin pela página | Autorização por recurso (`decisoes.md:27`) |

## 9. SignalR, placar ao vivo (E3.7)

| | Ameaça | Mitigação |
|---|---|---|
| S | Espectador sem permissão | Quem pode assistir: a definir na E3.7 |
| T | Cliente envia pontos pelo canal ao vivo | A definir na E3.7 |
| R | Sem registro do que foi transmitido | Stream é a fonte (`decisoes.md:26`) |
| I | Dado pessoal no canal | Eventos só com IDs (`decisoes.md:28`); o que mais é enviado: a definir na E3.7 |
| D | Excesso de conexões | A definir na E3.7 |
| E | Entrar no canal de outra quadra | A definir na E3.7 |

## 10. Outras superfícies em aberto

| Superfície | Ameaça | Mitigação |
|---|---|---|
| Resumo com IA (E3.13) | I: dados enviados ao provedor | Provedor ainda não definido ([`perguntas.md`](../estado/perguntas.md), item 4); dados enviados a definir na E3.13 |
| Resumo com IA (E3.13) | T: texto de usuário alterando o resumo | A definir na E3.13. Falha usa texto padrão (aceite da E3.13) |
| Resumo com IA (E3.13) | D: custo por uso abusivo | Cota por grupo (`revisao-mvp.md:116`) |
| Sentry, PostHog e logs (E5.2) | I: dado pessoal enviado a terceiros | Logs sem e-mails nem tokens (`produto.md:375`); o que vai para Sentry e PostHog a definir na E5.2 |
| Backups no R2 (E5.3) | I: cópia do banco exposta | Criptografia e acesso a definir na E5.3; retenção em `perguntas.md`, item 2 |
| CI e repositório | I: segredo em commit | Varredura de segurança na CI (`varredura-ci.md`) |

## 11. CI e cadeia de suprimentos (E0.4, E0.6, E0.9)

Revisado em 01/11/2026 ([parecer](revisoes/M1-2026-11-01.md)). Aqui, "Mitigação" é o que já existe.

| Ameaça | Mitigação | Lacuna |
|---|---|---|
| T: action comprometida ou movida | SHA obrigatório e lista de actions na configuração do repositório | Nenhuma: a configuração não muda por PR |
| T: dependência npm maliciosa | Lockfile congelado, `allowBuilds` e `tarball:` só de `registry.npmjs.org` (`test:tooling`) | `resolution` do tipo `git` não é checada |
| T: dependência NuGet alterada | Auditoria, `packages.lock.json` com `RestoreLockedMode` na CI e `nuget.config` com fonte única mapeada | Atualizar o lockfile localmente aceita o que a fonte entregar; a barreira é a leitura do diff |
| T: binário do gitleaks trocado | SHA-256 fixado | Nenhuma |
| T: imagem do `docker.io` trocada (E0.6) | Postgres e Ryuk fixados por digest; a CI confere o digest do Ryuk | Atualizar é decisão manual |
| E: Ryuk privilegiado com acesso ao socket do Docker (E0.6) | Imagem fixada pelo pacote `Testcontainers` `[4.16.0]`; só em teste | Risco aceito |
| T, D: porta do Ryuk sem autenticação, em todas as interfaces (E0.6) | Container dura só a execução | Risco aceito pelo Gabriel em 01/11/2026 |
| T: árvore NuGet do Testcontainers com acesso ao Docker (E0.6) | Versão exata, auditoria do projeto, lockfile e mapeamento de fontes (SEC-M1) | A árvore segue acessando o Docker em teste |
| T, E: PR edita a própria barreira ou adiciona workflow | Leitura do revisor e `contents: read`, sem segredos | Sem proteção de branch |
| I: vazamento pelo log da CI | `--redact`, sem artefato | O e-mail do autor aparece no achado |
| I: valor preso em `refs/pull` | Revogar o segredo; a sonda usa valor fictício | Nenhuma |
| D: abuso de minutos ou cache | Timeouts, cancelamento em PR e cache isolado por ref | Nenhuma com um único colaborador |
| R: exceção eterna do audit | `test:tooling` cobra a validade | Formas que escapam da política (SEC-M1) e cobrança só em execução com código |
