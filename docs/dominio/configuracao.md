# Configuração herdada e modelos

Regras de "Como jogamos" (tela 18), da configuração da rodada (tela 20) e da folha de pré-jogo (tela 08). Decisões técnicas no [ADR 0041](../arquitetura/adr/0041-configuracao-herdada-e-modelos.md). Fonte única dos campos e dos modelos: [`packages/match-engine/src/settings/settings-catalog.json`](../../packages/match-engine/src/settings/settings-catalog.json).

## Níveis

| Nível | O que guarda | Quem resolve |
|---|---|---|
| Grupo (`GroupSettings`) | Documento completo: toda folha tem valor. Nasce da cópia de um modelo | Groups |
| Rodada (`SettingsLayer`) | Camada parcial; folha ausente herda do grupo. Gravada pela E3.4 | App e servidor |
| Partida (`SettingsLayer`) | Camada parcial da folha de pré-jogo | Só o app (offline); congela no `MatchStarted` |

- **Herança por folha:** em cada folha vence o nível mais específico (partida, depois rodada, depois grupo). Mudar os pontos na rodada não muda os sets.
- **Ausente e `null` herdam.** "Voltar ao padrão" tira a folha da camada.
- **Nenhuma folha é nula.** "Sem limite de vagas" é `capacityLimited: false`, não `capacity: null`.
- **Interruptor por bloco:** `enabled` é uma folha como as outras. Bloco desligado guarda os valores de dentro (religar restaura); a rodada pode ligar um bloco só naquele dia.
- **Fonte de cada folha** (`SettingsSource`: `group`, `round` ou `match`): dá o cinza "do grupo" e o ponto laranja "nesta rodada". Uma folha da rodada igual ao grupo ainda vem da rodada; por isso o app normaliza ao salvar (abaixo).
- **Normalização:** ao salvar, a camada perde as folhas iguais ao que herdaria, e "N mudanças" conta só o resto. A rodada é normalizada contra o grupo; a partida, contra o grupo e a rodada já resolvidos.

## Campos

| Caminho | Valores | Do zero | Grupo | Rodada | Partida | Fato | Pro |
|---|---|---|---|---|---|---|---|
| `attendance.enabled` | sim/não | não | sim | sim | | | |
| `attendance.capacityLimited` | sim/não | não | sim | sim | | | |
| `attendance.capacity` | 2 a 300 | 12 | sim | sim | | sim | |
| `attendance.waitlistEnabled` | sim/não | não | sim | sim | | | |
| `attendance.regularsEnabled` | sim/não | não | sim | | | | |
| `attendance.dropInWindowEnabled` | sim/não | não | sim | sim | | | |
| `attendance.dropInOpensHoursBefore` | 1 a 168 | 24 | sim | sim | | | |
| `schedule.enabled` | sim/não | não | sim | | | sim | |
| `schedule.weekday` | 1 a 7 (1 = segunda) | 2 | sim | | | sim | |
| `schedule.startTime` | `HH:mm`, 00:00 a 23:59 | 20:00 | sim | | | sim | |
| `schedule.venue` | texto, 0 a 80 caracteres | vazio | sim | | | sim | |
| `format.modality` | `indoor-6x6`, `beach-4x4`, `beach-2x2` | `indoor-6x6` | sim | sim | | | |
| `scoring.enabled` | sim/não | não | sim | sim | | | |
| `scoring.bestOf` | 1, 3, 5 | 1 | sim | sim | sim | | |
| `scoring.pointsPerSet` | 1 a 99 | 25 | sim | sim | sim | | |
| `scoring.tieBreakEnabled` | sim/não | sim | sim | sim | sim | | |
| `scoring.tieBreakPoints` | 1 a 99 | 15 | sim | sim | sim | | |
| `scoring.winMargin` | 1, 2 (2 = vantagem) | 2 | sim | sim | sim | | |
| `queue.enabled` | sim/não | não | sim | sim | | | |
| `queue.exitCriterion` | `consecutive-matches`, `arrival-order`, `draw`, `manual` | `consecutive-matches` | sim | sim | | | |
| `rotation.enabled` | sim/não | não | sim | sim | | | |
| `rotation.system` | `livre`, `5x1`, `4x2`, `6x2` | `livre` | sim | sim | sim | | 5x1, 4x2, 6x2 |
| `rotation.ruleMode` | `fivb-2025-28`, `classic` | `fivb-2025-28` | sim | sim | | | |
| `rotation.liberoEnabled` | sim/não | não | sim | sim | | | |
| `draw.enabled` | sim/não | não | sim | sim | | | |
| `draw.balanceByLevel` | sim/não | não | sim | sim | | | |
| `mvp.enabled` | sim/não | não | sim | sim | | | |
| `mvp.byStats` | sim/não | sim | sim | sim | | | |
| `mvp.voting` | sim/não | não | sim | sim | | | |
| `mvp.individualPoints` | sim/não | não | sim | sim | | | sim |
| `money.enabled` | sim/não | não | sim | sim | | | |
| `money.dropInFeeCents` | 0 a 100000 (R$ 1.000) | 0 | sim | sim | | sim | |
| `money.monthlyFeeCents` | 0 a 100000 | 0 | sim | | | sim | |

- **A partida** aceita só pontos, sets, tie-break, vantagem e sistema. **A rodada** aceita tudo menos mensalistas, dia fixo e mensalidade.
- **Pro** só é marcado aqui (o app mostra o selo). A recusa fora do piloto é da E3.15; no piloto o Pro é liberado.
- **Horário** é local; o fuso do MVP é `America/Sao_Paulo` (a E3.4 confirma).
- **Local** (`schedule.venue`): mesma regra do nome do grupo, com vazio permitido. Chega já aparado e em NFC. Conta como caractere cada ponto de código que não é marca, ZWJ nem tom de pele. Texto livre que pode identificar alguém: nunca vai a log.

## Regras da partida derivadas

O que a partida congela no `MatchStarted` sai de `deriveMatchRules`:

- `tieBreakPoints` vira `null` quando `tieBreakEnabled` é falso.
- `liberoAllowed` só com `rotation.liberoEnabled` e sistema `5x1` ou `6x2` (ADR 0028). Líbero ligado no grupo com sistema `livre` na rodada não é erro: só não tem líbero.

## Modelos

| Modelo (chave) | O que liga |
|---|---|
| Pelada (`pelada`) | Presença sem limite; jogo de 1 set de 25 com vantagem; fila por mais partidas seguidas; rotação Livre; sorteio rápido; MVP pelos dados; sem cobrança |
| Racha organizado (`racha-organizado`) | Presença com limite, espera e avulsos 24 h antes; mensalistas; jogo com tie-break de 15; fila; rotação Livre; sorteio por nível; MVP; dinheiro ligado |
| Treino (`treino`, Pro) | Presença sem limite; jogo; rotação 5x1; sem fila, sorteio nem MVP |
| Areia rei da quadra (`areia-rei-da-quadra`) | Areia 2x2; 1 set de 21 com vantagem; fila por ordem de chegada; sem rotação; sorteio rápido; MVP do dia |
| Do zero (`do-zero`) | Tudo desligado |

- **Fatos do grupo** (dia fixo, horário, local, vagas e valores em dinheiro): modelo nunca os traz e aplicar modelo nunca os apaga. Trocar de "Racha" para "Treino" não zera a mensalidade.
- **Cópia, não vínculo:** aplicar um modelo copia os valores; o que o modelo não diz volta a "Do zero". Mudar o catálogo numa versão futura não mexe em grupo nenhum.
- Nomes em pt-BR só no app (E4.5), pela chave. Os valores seguem o padrão adotado da pergunta 21 do plano da E3.3.

## Recusas

Cada recusa tem código e caminho (folha, bloco, ou `""` para a raiz; chave desconhecida é reportada pelo pai). A API devolve todas como `groups.settings-invalid`.

| Código | Quando |
|---|---|
| `settings.unsupported-version` | `schemaVersion` ausente ou diferente de 1, no documento ou na camada |
| `settings.unknown-field` | Bloco ou folha que o catálogo não tem |
| `settings.missing-field` | Folha ou bloco faltando no documento do grupo |
| `settings.wrong-type` | Tipo errado, `null` no documento, número não inteiro ou infinito, horário fora da forma `HH:mm` |
| `settings.out-of-range` | Número ou horário fora da faixa, texto longo demais |
| `settings.unknown-value` | Valor fora da lista (`bestOf` 2, sistema `6x0`) |
| `settings.invalid-text` | Texto com caractere invisível, sem letra, com espaço nas pontas ou fora de NFC |
| `settings.not-allowed-at-level` | Folha que o nível não aceita (mensalidade na rodada, vagas na partida) |

## Onde fica e quem muda (E3.3, parte 2)

- **Grupo:** `groups.group_settings`, uma linha por grupo, com o documento completo. Ver é `ViewGroup` (todo membro ativo); mudar, aplicar modelo e gerir modelos salvos é `ManageSettings` (Admin e Co-admin, pergunta 23). Rotas e códigos em [`grupos.md`](grupos.md).
- **Modelos salvos:** `groups.saved_templates`, até 20 por grupo. O retrato leva só os campos que não são fato; o nome tem de 1 a 40 caracteres visíveis. Aplicar um modelo salvo é o mesmo que aplicar um pronto: copia os valores e mantém os fatos.
- **Rótulo "Modelo usado":** `templateKey` (pronto) ou `savedTemplateId` (salvo), o último aplicado, nunca os dois. Editar um campo não muda o rótulo; apagar o modelo salvo apontado limpa o rótulo.
- **Grupo antigo sem linha** lê como "Do zero" (rótulo vazio) e ganha a linha na primeira escrita.
- **Dado pessoal:** o local (`schedule.venue`) e o nome do modelo salvo são texto livre e nunca vão a log (`docs/seguranca/dados-pessoais.md`).
