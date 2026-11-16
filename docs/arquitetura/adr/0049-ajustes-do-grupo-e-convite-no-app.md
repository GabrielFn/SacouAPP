# ADR 0049 · Ajustes do grupo e convite no app

**Status:** aceito (10/11/2026), Parte 1; Parte 2 em 14/11/2026; Parte 3 em 15/11/2026. **Tarefa:** E4.5. Plano: [`E4.5.md`](../../estado/tarefas/E4.5.md). A Parte 2 (membros, convite e QR) acrescenta as decisões D7 abaixo.

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
- O modelo escolhido na tela 04 viaja como parâmetro da rota (`?template=`), conferido na tela 05. Para "Do zero" a rota leva também `&blocks=attendance,queue` (a lista da tela 04a, na ordem da tela, vazia se nenhum bloco). Parâmetro ilegível (modelo desconhecido, bloco desconhecido ou repetido, "Do zero" sem `blocks`) volta para a tela 04.
- **Dinheiro fora do piloto (ADR 0046):** a tela 05 não pergunta "Cobra?" nem valores, a tela 18 não tem o bloco Dinheiro, e o app não lê nem escreve `money.*`. O documento continua com as folhas; o "Racha organizado" segue com `money.enabled` ligado, escondido na interface, para a E3.10 do pós-piloto. O tipo `ShownPath` (todo `SettingsPath` menos `money.*`) faz o compilador impedir uma linha ou texto de dinheiro. `money-text.ts` foi apagado.
- Depois de criar o grupo a tela vai para "Nova rodada" (tela 20, E4.6, pergunta 48), não para Membros.
- **"Livre / 6x0":** um botão só para o sistema `livre` (resposta do Gabriel em 30/10/2026). O "6x0" não existe no catálogo (`settings.unknown-value`), então o rótulo do `livre` é "Livre / 6x0" e os sistemas continuam os 4 do catálogo.
- A linha "Regra" da fila vira link para a tela 18a (D10, Parte 4) e mostra o resumo da regra ("Automático · vencedor sai após 3").

**D3a · Tela 04a, "Monte do seu jeito".** "Do zero" na tela 04 deixa de ser opção do rádio e vira um botão tracejado que abre a 04a. Seis blocos, todos desligados: Presença e vagas (`attendance.enabled`), Jogo (`scoring.enabled`), Fila (`queue.enabled`), Rotação (`rotation.enabled`), Sorteio (`draw.enabled`) e MVP do dia (`mvp.enabled`). O canvas tem "Placar" e "Jogo" separados; o catálogo só tem `scoring.enabled`, então há **um bloco "Jogo"** ligado a ele (padrão adotado até o Gabriel responder a pergunta 34). A seta de cada bloco abre só o texto do que ele liga: o ajuste fino fica em "Como jogamos". O estado da tela é um reducer de dois campos (`enabled`, `expanded`). A tela 05 recebe a base `customBase(blocks)` e o envio é `createGroup(name, "do-zero")` mais um `PATCH` com os `*.enabled` ligados e as respostas.

**D10 · Tela 18a, "Regra da fila" (Parte 4).** Ao contrário da tela 18, tem botão "Salvar regra": o rascunho (`exitMode`, `fixedExitCount`, `winnerExitEnabled`, `winnerExitWins`) fica num reducer local (`queue-rule.reducer.ts`) e o botão faz **um** `PATCH` só com as folhas que mudaram (`queueRuleLayer`); sair sem salvar descarta e não chama a API. Os passos leem as faixas do catálogo da E2.12 (1 a 24 e 1 a 10) e se desligam nos limites; os passos só ficam ativos com o modo "Número fixo" ou o interruptor ligados, e desligar o interruptor guarda o número. Antes de enviar, o rascunho passa no `parseGroupSettings`. A 18 mostra o resumo ("Automático · vencedor sai após 3", "Sempre o time inteiro", "Número fixo: 2") e a linha só é toque para quem administra. Componentes novos: `ui/Stepper.tsx`, `MinusIcon`, tokens `radioDot` e `radioDotSelectedBorder`.

**D10a · `disabled` no `ui/Button.tsx`.** Visual desligado por opacidade (componente inativo, isento de contraste), `accessibilityState.disabled` e sem `onPress`. "Criar grupo" desliga com `isSubmitDisabled` (formulário inválido ou chamada em curso), "Tentar de novo" com `isRetryDisabled` e "Publicar" (E4.6) com `isPublishDisabled`; as condições são funções puras testadas.

**D5 · Chaves, cache e conflito.**

- `queryKeys.settings(groupId)` → `["groups", id, "settings"]` e `queryKeys.templates(groupId)` → `["groups", id, "templates"]`. As duas ficam sob o grupo, então um 404 `groups.group-not-found` as remove.
- A lista de chaves persistidas ganha `["groups", id, "settings"]`: o jogador vê "25 pontos · 1 set" sem rede. Isso põe o **local** (`schedule.venue`, texto livre) em `sacou-cache.db`, sem criptografia, com a mesma justificativa do nome do grupo ([modelo de ameaças, seção 12](../../seguranca/modelo-de-ameacas.md); [dados pessoais](../../seguranca/dados-pessoais.md)). `templates` e `invites` **não** são guardados.
- `MutationEvent` ganha `settingsReplaced` (com o documento, para `setQueryData`), `templatesChanged` e `settingsForbidden` (403 no meio: invalida o grupo e a configuração, e a tela vira só leitura sozinha). O efeito de cache ganha a ação `set`.
- `isConflict` passa a ser usado: `conflictEffects` mostra o texto do `code`, não repete e invalida só a consulta que o conflito diz estar velha (`last-admin` → `members`, `invite-limit` → `invites`, `template-limit` → `templates`).
- Quem não tem `ManageSettings` vê a tela só para leitura e não chama `listTemplates` (`enabled: false`), então o 403 não sai.

## Decisão (Parte 2): membros e convite

**D6 · Tela 19 e folha 19c, antes dos nomes (E3.17).** Linha com avatar neutro (tracejado sem conta), "Você" ou "Membro desde 12 out", o selo do papel ("Sem conta" amarelo para o convidado) e "Mensalista · você". Ordem: você, Admin, Co-admin, Placar, Jogador, e quem entrou antes. Abas "Mensalistas (N)", "Avulsos (N)" e "Convites" (só com `ManageInvites`; para os outros, `listInvites` nem é chamado) em `useState`, anunciadas como abas (`ui/TabSwitch`). A folha 19c vem de `memberActions(me, target, members)`, puro: os chips de papel que quem age não pode dar ficam desligados; convidado sem conta só tem "Jogador" e "Avulso"; o último Admin não sai nem se rebaixa ("Promova outro admin antes"); o Co-admin não se rebaixa; Placar e Jogador só abrem a própria linha, com "Sair do grupo". "Remover" de outra pessoa fica escondido até a Parte 3 (pergunta 30). O reducer da tela (`members-screen.reducer.ts`) guarda só a linha da folha aberta e a confirmação pendente (sair, revogar); a folha é derivada da lista do cache a cada render. As escritas de membro rodam em fila por grupo (`scope: members-<groupId>`). Depois de sair, a tela vai para a lista de grupos.

**D7 · Tela 19d, convite (sensível).**

- **Um lugar para o token:** a porta `InviteLinkStore` (`read`, `save`, `remove`, `clearAll`), real sobre `expo-secure-store` com uma chave por grupo e um índice dos grupos (o armazenamento do sistema não lista as próprias chaves), falsa em memória. O token nasce no resultado da única mutação da tela (`gcTime: 0`), que também é quem o segura na memória enquanto a tela está aberta; nunca no cache do Query, no reducer, em parâmetro de rota ou em log. O link é montado na hora de desenhar, copiar ou mandar.
- **Ao abrir:** se há link guardado e o `inviteId` ainda está em `listInvites`, usa ele; senão, apaga a cópia e cria outro. Uma falha ao gravar a cópia não perde o link: ele aparece, e outro é criado na próxima visita.
- **Desativar e gerar outro:** revoga o mostrado (um `invite-not-found` conta como feito), apaga a cópia e cria outro, nessa ordem; recusa no meio mostra o erro e "Tentar de novo", que relê o guardado. "Revogar" na aba "Convites" apaga a cópia quando é o mesmo convite. Sair do grupo ou virar Placar ou Jogador apaga a cópia (o servidor já matou os links).
- **Formato e endereço:** `{base}/c#{token}`, com a base em `EXPO_PUBLIC_INVITE_BASE_URL` (pergunta 33), só origem `https:` (`http:` só em `__DEV__`); valor ausente ou inválido não derruba o app, como faz o da API: só esconde os botões de convite da 19 e a 19d diz que o link fica disponível depois. A tela mostra `sacou.app/c#K7fQ2x…` (6 caracteres do token).
- **Copiar:** porta `Clipboard` (`setText`), real com `expo-clipboard`. Mostra "Link copiado" até o link mudar.
- **WhatsApp:** porta `ExternalLink` (`open(url)` devolve `false` quando nenhum app abre), real sobre `Linking.openURL`, sem `canOpenURL`. `whatsapp://send?text=`; sem WhatsApp, a `ShareSheet` da E4.6 recebe a mesma mensagem. Nunca `wa.me`.
- **QR:** porta `QrEncoder` sobre `qrcode-generator` (JS puro, versão exata), nível M, versão automática (link de 63 bytes → versão 5, 37 módulos); `ui/QrCode.tsx` recebe só a matriz e desenha um caminho SVG com margem de 4 módulos, `#0F1B2D` sobre branco, 60% da largura com `aspectRatio: 1`.
- **Sessão:** `clearSession({ cacheSession, inviteLinkStore })` limpa o cache do servidor e chama `clearAll()`; a E4.3 liga ao logout.
- **Componentes novos:** `ui/TabSwitch`, `ui/ConfirmSheet`, `ui/QrCode`, variantes `outline`, `danger`, `dangerOutline` e `dangerText` e ícone opcional no `ui/Button`, ícones `MoreIcon`, `LinkIcon` e `QrIcon`; cores `avatarSurface`, `infoFill`/`infoText` (selo Placar) e `danger` (`#B42318`), todas conferidas para AA.

## Decisão (Parte 3): nomes, posições e nota do admin

**D9 · Telas 19, 19a, 19b e 19c com os dados da E3.17.**

- **Porta:** `listMemberLevels`, `setMemberLevel` (`null` é "Não sei") e `setMemberLevels` (lote de 1 a 50, tudo ou nada), pelos tipos gerados. Nenhuma rota nova na API.
- **Privacidade (ADR 0047):** `memberLevelsQuery` só com `canManageLevels` (Admin e Co-admin); Placar e Jogador nunca chamam a rota e não veem cartão de nota, faixa, linha de privacidade nem "Nota do sorteio". A chave `["groups", id, "member-levels"]` fica fora do cache persistido; um 403 invalida o grupo e as notas.
- **Escala:** `ui/skill-level.ts`, em décimos inteiros (10 a 50, de 5 em 5, padrão 30), igual ao `SkillLevel` de `perfil-e-nota.md`. Valor fora da escala vindo da API é tratado como ausente, nunca arredondado.
- **Linha da 19:** apelido, iniciais (duas primeiras letras ou dígitos), "Ponteiro · líbero · mensalista · você"; convidado com "entrou pelo WhatsApp". Sem perfil, continua "Você" ou "Membro desde 12 out" com o avatar neutro. Cartão de nota: confirmada, "sugeriu" tracejado amarelo, ou "– sem nota". As posições usam a forma masculina enquanto a pergunta 41 não é respondida; o título da 19a é "Nota de Bia" (a API não guarda gênero).
- **19a:** componente controlado `ui/LevelSheet.tsx` (sem estado próprio), reaproveitável na 21a. Na 19, o rascunho fica no reducer da tela (`level: { memberId, draft }`); `draft: null` mostra a nota do servidor, senão a sugestão, senão 3,0. Salvar faz um `PUT` com `scope` por grupo e fecha a folha no sucesso.
- **19b:** cartões derivados do cache (quem tem `reviewed: false`); o reducer `rating-review.reducer.ts` guarda só o rascunho por `MemberId`. "Confirmar" e "Não sei" usam a rota de um membro; "Confirmar todas (N)" usa a rota em lote, de 50 em 50, contando todos os cartões: o rascunho, senão a sugestão, senão "Não sei" (como no canvas, que conta 3 com o Léo). Lote recusado mantém os cartões e mostra quantas notas não entraram. "Não sei" grava `null` (revisado), para o membro sair da faixa; o sorteio continua usando a sugestão ou 3,0.
- **Remover (pergunta 30):** "Remover do grupo" na 19c de outra pessoa, com confirmação; Admin remove qualquer um, Co-admin só Placar e Jogador. O sucesso invalida membros e notas.
- **Componentes novos:** `ui/Avatar`, `ui/LevelSheet`, `StepButton` exportado com tamanho, ícones `LockIcon` e `WarningIcon`; cores `noticeFill`, `suggestBorder` e `suggestText`, conferidas para AA.

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
