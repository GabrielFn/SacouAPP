# ADR 0079 — Clareza do fluxo do M5 (R101)

Status: aceita (24/11/2026). Emenda a ADR 0070 (D1: onde o admin vê o link; D5: o que a página pública mostra) e a ADR 0072
(texto do MVP provisório). Plano em `docs/estado/tarefas/R101.md`. Perguntas 183 a 187 em `docs/estado/perguntas.md`.
Cada parte da R101 acrescenta a sua seção: **Parte 2 (web e API)** e **Parte 3 (regra do servidor)**.

## Parte 2: a janela dos avulsos e o "Não vou mais" na página `/r`

1. **`PublicRoundSummary.DropInOpensAt`** (`DateTimeOffset?`, nulo com a janela desligada), calculado como o
   `RoundResponse.DropInOpensAt`. É regra do grupo (um instante), não dado de membro: `dados-pessoais.md` não muda. O teste
   por reflexão da lista fechada de campos passou a listar o campo, com esse motivo.
2. **Linha sob o contador:** "A lista dos avulsos abre {frase}." só com a rodada aberta ou lotada e antes de
   `DropInOpensAt` (relógio do servidor, página `no-store`). A frase é "hoje, às 20h", "amanhã, às 20h" ou "na terça, 24/11,
   às 20h" (no fuso da rodada; "no" para sábado e domingo; a data sempre vai porque a janela pode estar a uma semana).
3. **Recusa no VOU:** o texto da recusa diz o dia: com mensalista na lista "A lista abre para você {frase}. Até lá, só os
   mensalistas confirmam."; sem mensalista "A lista abre {frase}."; sem frase, o texto antigo. O servidor repassa à página
   `data-drop-in-phrase` e `data-has-regulars`, pelo codificador do Razor; o script lê por `dataset` e escreve por `textContent`.
4. **VOU antes do toque fica ativo para todos** (o anônimo pode ser mensalista; só o servidor sabe). Depois da recusa
   `dropInWindowClosed`, o VOU fica desligado enquanto a recusa for a última coisa dita (derivado do estado, sem campo novo).
5. **"Não vou mais" sempre pergunta** (pergunta 185, opção 1): novo passo `confirmingLeave` no reducer da página, com
   "Sair da lista?", "Se mudar de ideia, é só tocar em VOU de novo enquanto houver vaga.", "NÃO VOU MAIS" e "CONTINUAR NA
   LISTA". Só pergunta a quem tem lugar (vaga ou espera); o toque duplo na confirmação manda uma resposta só (o passo
   `answering` ignora a segunda). Sem o nome do 1º da espera: a página não tem a espera com nomes. O texto da pergunta é
   do servidor (`WebTexts`), como o resto da tela 01.
6. **Segurança:** superfície anônima; nada de dado pessoal novo; ver `modelo-de-ameacas.md` (linha da prévia e da página pública).

## Parte 3: a janela dos avulsos só vale com mensalista ativo

Pergunta 183, opção 2 (resposta do Gabriel em 23/11/2026). Num grupo sem mensalista todo membro é avulso, e a janela
travava todo mundo até abrir.

1. **Regra:** enquanto o grupo não tem nenhum membro **ativo** do tipo mensalista (`MemberType.Regular` na lista de
   `IGroupMembership.ListActiveAsync`), a janela dos avulsos não vale, mesmo com `attendance.dropInWindowEnabled` ligado.
   Convidado é sempre avulso e não conta. Removido, quem saiu ou quem voltou a avulso deixa de contar na hora.
2. **Um lugar só:** `AttendanceSettings.ForGroup(hasActiveRegular)` (domínio, puro) devolve as regras com a janela
   desligada nesse caso. `RoundGroupState` aplica ao resolver a rodada, então o reducer da presença (`AttendanceRules`), o
   `RoundResponse.DropInOpensAt` (nulo) e a página do link leem o mesmo valor. O resumo público
   (`StorePublicRoundSummary`) lê os membros ativos pelo mesmo contrato e chama `RoundGroupState.ForGroup`, então o
   `PublicRoundSummary.DropInOpensAt` da Parte 2 também vem nulo.
3. **Sem gravação:** a decisão é tomada a cada resposta e a cada leitura, com os membros lidos dentro do lock da rodada
   na escrita (ADR 0043, D5). Nada muda no banco nem nos ajustes: `RoundSettingsResponse` continua mostrando o que o
   admin escolheu, e a janela volta sozinha quando alguém vira mensalista.
4. **Custo:** o resumo público faz uma leitura a mais (membros ativos do grupo), sem dado pessoal na resposta: só o
   booleano entra na regra. `dados-pessoais.md` e o modelo de ameaças não mudam.
