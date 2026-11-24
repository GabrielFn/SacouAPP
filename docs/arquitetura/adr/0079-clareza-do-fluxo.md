# ADR 0079 — Clareza do fluxo do M5 (R101)

Status: aceita (24/11/2026). Emenda a ADR 0070 (D1: onde o admin vê o link; D5: o que a página pública mostra) e a ADR 0072
(texto do MVP provisório). Plano em `docs/estado/tarefas/R101.md`. Perguntas 183 a 187 em `docs/estado/perguntas.md`.
Cada parte da R101 acrescenta a sua seção; esta é a da **Parte 2 (web e API)**.

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
