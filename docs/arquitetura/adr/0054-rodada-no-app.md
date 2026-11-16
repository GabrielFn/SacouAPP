# ADR 0054 · Rodada no app

**Status:** aceito (14/11/2026). **Tarefa:** E4.6, parte 1 (telas 20 e 06 sem a lista). Plano em [`docs/estado/tarefas/E4.6.md`](../../estado/tarefas/E4.6.md). As partes 2 (telas 26 e 21) e 3 (21a, cards, edição) completam este ADR.

## Contexto

A API de rodadas (E3.4) e o motor de configurações (E3.1) estão prontos; falta a tela de marcar a rodada (20) e a de detalhe do admin (06). O canvas `design/mvp/` ainda traz dinheiro, o selo "Pro" e o campo "Avulso", que o ADR 0046 tirou do piloto.

## Decisões

1. **Uma rota para o detalhe.** `groups/[groupId]/rounds/[roundId]` serve a 06 e, na Parte 2, a 26: a tela sai do papel no `groupQuery` (`admin`/`coAdmin` gerenciam). O papel tem um lugar só. Até a Parte 2, quem não gerencia vê a mesma página sem botões. `rounds/new` é a tela 20.
2. **"Criar grupo" vai para a tela 20** (pergunta 48): `afterCreateGroupHref` devolve `createRoundHref`.
3. **Chaves e persistência.** `queryKeys.rounds(groupId)` e `queryKeys.round(groupId, roundId)` ficam sob o grupo (o 403/404 do grupo já os limpa). `rounds` entra na lista permitida do cache persistido, e a chave de 4 posições do detalhe também (a rodada abre sem rede na quadra). Só IDs, contagens, local e camada. `staleTime` de 15 s. Mutações com `scope` por rodada (`round:<id>`) e por grupo na criação.
4. **Efeitos de cache** (`cacheEffectsOf`): `roundCreated` e `roundUpdated` gravam o detalhe com a resposta e invalidam a lista; `attendanceChanged` invalida o detalhe e a lista (a posição dos outros só o servidor sabe). Os nomes seguem o camelCase dos outros eventos (Parte 2). A lista é invalidada com `exact: true` (efeito `invalidateExact`): invalidar `["groups", id, "rounds"]` por prefixo também derrubaria o detalhe recém-gravado e as outras rodadas abertas.
5. **Camada da rodada no rascunho** (`create-round.reducer.ts`). O estado guarda só o que a pessoa mexeu (data, hora, local, vagas em texto, mapa caminho para valor das três folhas do "Personalizar", repetir, abas e folha aberta). A base nunca é copiada: vem do `getGroupSettings`. O corpo do `POST` leva a camada **mais** as vagas (`attendance.capacity` com `capacityLimited: true`) quando o campo difere do grupo; sem diferença, `settings: null`. O contador "N mudanças" conta só as linhas do "Personalizar". Um valor igual ao do grupo tira a folha da camada. O reducer usa um mapa de tratadores tipado (uma ação sem tratador não compila), no lugar de um `switch`, porque o `switch` passaria do limite de complexidade do lint.
6. **Folhas.** O dia vem de uma folha com 14 datas seguidas a partir da próxima ocorrência do dia fixo do grupo; o horário, de uma folha com o campo `HH:mm`. As pílulas "Como vai ser" usam o mesmo resolvedor do servidor (`resolveSettings`); a pílula com ponto laranja é a folha cuja fonte é `round`.
7. **"Repetir toda semana"** vem ligado só quando o grupo tem dia fixo e nenhuma rodada futura de série. Por isso `RoundSummaryResponse` ganhou `seriesId` (nulo fora de série).
8. **Compartilhar** (pergunta 45): porta `ShareSheet` (adaptador `Share` do React Native, falso para teste). Depois de publicar, abre o compartilhamento com "Grupo · Ter, 3/11 · 20h30 · Local · 14 vagas. Confirma no app Sacou."; o link da página entra com a E3.12. Falha ao abrir não é erro de tela.
9. **O que sai do canvas (ADR 0046):** pílula "R$ 10", campo "Avulso", selo "Pro" e células "Avulsos pagaram" e "Mensalidade". Nada de rodada lê `money.*`.
10. **Rodapé da 06** pelo `PENDING_ROUND_SCREENS` (`draw`, `court`): botão de tela pendente some; com os dois pendentes não há rodapé.
11. **`Venue` do C# igual ao `schedule.venue` do TS** (pendência da E3.4). O C# contava caracteres percebidos (`StringInfo`: a família de emoji valia 1) e o TS conta pontos de código que não são marca, junção nem tom de pele (a família vale 4). Agora os dois usam a mesma regra, em `DisplayText.IsWithinCountedLength` e `HasFewMarksInARow` (também usadas pelo `SettingsText`). Casos `V10-venue-*` no golden `settings-resolver.json`, rodados no Vitest (`checkDisplayText`) e no xUnit (`Venue.Create`; o texto que o `Venue` teria de normalizar conta como recusado, como nas configurações, porque o app envia o texto já aparado e em NFC).

## Parte 2 · telas 26 e 21, lista e "Copiar lista" (15/11/2026)

12. **A rota única mostra a 26** para Placar e Jogador (`RoundScreen` escolhe pelo papel do `groupQuery`). O cartão "Sua presença" sai de `presenceCard`, uma função pura com uma linha por estado da D7 (pergunta 46, padrão 1). O app só prevê ("você entra na espera", "Lista cheia"); o servidor decide, e nada é otimista: toda resposta invalida o detalhe e a lista.
13. **Hora local sem tabela de fuso.** "Avulsos confirmam a partir de sex, 19h" usa o deslocamento da própria rodada (`localDate` + `localTime` contra `startsAt`) aplicado ao `dropInOpensAt`, sem `Intl` com fuso no Hermes. Uma troca de horário de verão entre os dois instantes fica fora das zonas do piloto. A janela e o "já começou" usam o relógio do aparelho (risco 4): relógio errado mostra o botão ligado, e o servidor recusa com texto.
14. **Uma folha por vez.** Lista de confirmados (`ConfirmedSheet`, comum à 06 e à 26), confirmação do "Tirar" (pergunta 47, padrão 1) e confirmação do "Não vou mais" com a lista cheia ficam num reducer (`round-screen.reducer.ts`, `switch` exaustivo): o "Tirar" troca a lista pela confirmação, porque dois `Modal` não se empilham no Android. O reducer guarda só o `memberId`; o nome vem da consulta de membros.
15. **Presença marcada por outra pessoa** (21 e "Tirar"): `PUT /attendance/{memberId}` só com IDs; a permissão (`ManageRounds`) e a vaga são do servidor. O app esconde "Tirar" e a 21 de quem não gerencia, mas isso é só interface. As duas mutações usam o `scope` da rodada (`round:<id>`), então duas respostas seguidas vão em ordem. Um 409 relê o detalhe; `member-not-found` relê os membros.
16. **"Copiar lista"** escreve na porta `Clipboard` só no toque, com cabeçalho da rodada, "Confirmados (14/14)", lista numerada e "Espera": só apelidos ("Sem apelido" sem apelido), sem ID, posição no grupo, nota nem telefone (`roundListText`, testado como golden).
17. **Textos de tipo de membro** ("Mensalista", "Avulso", "Sem conta") na 21 vêm de `membersStrings`: os textos de rodada nunca dizem "Avulso" (o campo saiu do piloto, item 9, e um teste confere).
18. **Tokens do painel escuro:** `panelSurface`, `onPanel` e `panelAccent` (noite, areia e amarelo) no tema, no lugar de `colors.text` e `palette.ballYellow` direto; contraste conferido em teste.
19. **Fica para a Parte 3:** a 21a e o bloco do convidado na 21, os cards de rodada (E4.4) e o "Editar rodada". "Abrir no WhatsApp do grupo" some no piloto (pergunta 49).

## Consequências

- A Parte 2 acrescenta a 26, a 21 e a lista; a Parte 3, a 21a, os cards e a edição.
- O corpo do `POST /rounds` com `repeatWeekly` ligado cria uma série; o app só liga o padrão quando é seguro.
