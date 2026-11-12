# ADR 0049 · Ajustes do grupo e convite no app

**Status:** aceito (10/11/2026), Parte 1. **Tarefa:** E4.5. Plano: [`E4.5.md`](../../estado/tarefas/E4.5.md). A Parte 2 (membros, convite e QR) acrescenta as decisões D7 abaixo.

## Contexto

A E4.5 liga o app às rotas de configuração do grupo da E3.3 ([ADR 0041](0041-configuracao-herdada-e-modelos.md)): criar um grupo a partir de um modelo (telas 04 e 05) e mudar "Como jogamos" (tela 18). O contrato tipa o `settings` como JSON solto (`JsonNode`), o `PATCH` é parcial e não tem `409`, e o cache persistido (ADR 0042) ainda não guardava a configuração.

## Decisão (Parte 1)

**D4 · Cada mudança de "Como jogamos" é salva na hora.** Não há botão "Salvar" no canvas.

- O reducer da tela (`group-settings-form.reducer.ts`) guarda só o rascunho de cada folha: `pending` (o que a pessoa mudou e o servidor ainda não respondeu), o bloco aberto, a folha aberta e o texto da última recusa. O documento do servidor fica só no TanStack Query (regras 1 e 4 do `frontend.md`).
- Interruptor e chip disparam `PATCH` com uma camada de uma folha. Número, texto, dia e horário abrem antes uma folha com confirmar e cancelar.
- As mutações de configuração de um grupo usam `scope: { id: "settings-<groupId>" }`: rodam em fila, e uma resposta velha nunca chega depois da nova.
- A resposta é o documento inteiro, já mesclado no servidor. Ela entra por `setQueryData` (evento `settingsReplaced`) e só depois a folha sai de `pending`.
- Falha: a folha volta ao valor do servidor e a faixa de erro mostra o texto do `code`. Sem conexão: "Sem conexão. A mudança não foi salva.", sem fila (ADR 0042).
- O `PATCH` de configuração não tem `409`: a última escrita vale na mesma folha. Não se inventa versão nem ETag.
- A validação é a do servidor: `parseGroupSettings` do `match-engine`. O `settings` do contrato passa por ele no `queryFn` e em cada resposta de escrita. Documento recusado vira `ApiFailure` `unexpected` e não é guardado. Folha recusada pelo parser não sai em `PATCH`. O app não escreve regra de faixa nem tipo à mão: a faixa do texto de erro vem do catálogo. Para isso o pacote passa a exportar `checkDisplayText`.
- **Criar grupo** faz `POST /v1/groups` com `templateKey` e depois um `PATCH` só com as folhas que diferem do modelo (`normalizeLayer`). Se o `PATCH` falhar, o grupo já existe: a tela oferece repetir só o `PATCH` ("Tentar de novo") ou seguir ("Seguir assim"). Botão desligado durante a chamada (a API não tem chave de idempotência).
- O modelo escolhido na tela 04 viaja como parâmetro da rota (`?template=`), conferido na tela 05.
- Chave Pix e "Forma" do bloco Dinheiro ficam escondidas até a E3.10 (pergunta 31). Depois de criar o grupo a tela vai para "Como jogamos" (pergunta 32) até a Parte 2 e a E4.6.
- O "6x0" do canvas não está no catálogo (`settings.unknown-value`): a tela segue o catálogo, com Livre, 4x2, 5x1 e 6x2.

**D5 · Chaves, cache e conflito.**

- `queryKeys.settings(groupId)` → `["groups", id, "settings"]` e `queryKeys.templates(groupId)` → `["groups", id, "templates"]`. As duas ficam sob o grupo, então um 404 `groups.group-not-found` as remove.
- A lista de chaves persistidas ganha `["groups", id, "settings"]`: o jogador vê "25 pontos · 1 set" sem rede. Isso põe o **local** (`schedule.venue`, texto livre) em `sacou-cache.db`, sem criptografia, com a mesma justificativa do nome do grupo ([modelo de ameaças, seção 12](../../seguranca/modelo-de-ameacas.md); [dados pessoais](../../seguranca/dados-pessoais.md)). `templates` e `invites` **não** são guardados.
- `MutationEvent` ganha `settingsReplaced` (com o documento, para `setQueryData`), `templatesChanged` e `settingsForbidden` (403 no meio: invalida o grupo e a configuração, e a tela vira só leitura sozinha). O efeito de cache ganha a ação `set`.
- `isConflict` passa a ser usado: `conflictEffects` mostra o texto do `code`, não repete e invalida só a consulta que o conflito diz estar velha (`last-admin` → `members`, `invite-limit` → `invites`, `template-limit` → `templates`).
- Quem não tem `ManageSettings` vê a tela só para leitura e não chama `listTemplates` (`enabled: false`), então o 403 não sai.

## Alternativas descartadas

- Botão "Salvar" no fim da tela 18: o canvas não tem, e a perda de uma mudança no meio seria silenciosa.
- Guardar o documento no reducer: duplicaria o cache (regra 1).
- Tipar o `settings` à mão no app: a regra ficaria em dois lugares; o parser do motor é a fonte.
- Não guardar a configuração no cache persistido: a tela 18, a rodada (E4.6) e o pré-jogo precisam dela sem rede.

## Consequências

- O local do grupo passa a ficar no aparelho, sem criptografia, no sandbox do app com backup desligado. Rever se a configuração ganhar dado mais sensível.
- Um `PATCH` por toque; com o `scope`, o tráfego é pequeno (corpo de poucos bytes).
- Criar grupo continua não atômico: um tempo esgotado depois do `POST` pode criar o grupo sem a pessoa saber. Se acontecer no piloto, abrir tarefa de API com `Idempotency-Key`.
- Recusa do Pro fora do piloto (E3.15), nome e nível dos membros (E3.17) e Pix (E3.10) ficam em `pendencias.md`.
