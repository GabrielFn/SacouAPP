# Modelo de ameaças

STRIDE por componente: **S**poofing, **T**ampering, **R**epudiation, **I**nformation disclosure, **D**enial of service, **E**levation of privilege.

Só a CI (seção 11) já está implementada; os demais componentes ainda não têm código. Neles, "Mitigação" é o que os documentos **decidiram**, não o que já existe; o que está implementado é conferido no [checklist](checklist.md). Sem decisão, consta "a definir na E\<ID\>". Cada tarefa da lista atualiza sua seção.

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
| T | Evento inconsistente ou forjado: o servidor aplica o resultado sem reimplementar a lógica (`decisoes.md:26`) | Validação do que chega a definir na E3.7 |
| T | Reenvio duplicar pontos | Idempotência com ID gerado no celular (`produto.md:309`) |
| R | Negar uma correção | Desfazer é evento e nunca apaga (`decisoes.md:26`); autoria a definir na E3.7 |
| I | Dado pessoal gravado no stream | Eventos só com IDs (`decisoes.md:28`) |
| I | Log de eventos no aparelho (expo-sqlite) | A definir na E4.9 |
| D | Lote grande ou volume alto de eventos | Limite de requisições (`decisoes.md:31`); tamanho do lote a definir na E3.7 |
| E | Escrever em stream de outra quadra | Token de placar só daquele stream (`produto.md:357`); autorização do admin por recurso (`decisoes.md:27`) |

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

## 11. CI e cadeia de suprimentos (E0.4, E0.9)

Revisado em 01/11/2026 ([parecer](revisoes/M1-2026-11-01.md)). Aqui, "Mitigação" é o que já existe.

| Ameaça | Mitigação | Lacuna |
|---|---|---|
| T: action comprometida ou movida | SHA obrigatório e lista de actions na configuração do repositório | Nenhuma: a configuração não muda por PR |
| T: dependência npm maliciosa | Lockfile congelado e `allowBuilds` | `resolution` não é checada |
| T: dependência NuGet alterada | Auditoria | Sem lockfile nem mapeamento de fontes |
| T: binário do gitleaks trocado | SHA-256 fixado | Nenhuma |
| T, E: PR edita a própria barreira ou adiciona workflow | Leitura do revisor e `contents: read`, sem segredos | Sem proteção de branch |
| I: vazamento pelo log da CI | `--redact`, sem artefato | O e-mail do autor aparece no achado |
| I: valor preso em `refs/pull` | Revogar o segredo; a sonda usa valor fictício | Nenhuma |
| D: abuso de minutos ou cache | Timeouts, cancelamento em PR e cache isolado por ref | Nenhuma com um único colaborador |
| R: exceção eterna do audit | `test:tooling` cobra a validade | Formas que escapam da política (SEC-M1) e cobrança só em execução com código |
