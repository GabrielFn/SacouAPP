# ADR 0079 — Clareza do fluxo do M5 (R101)

Status: aceita (24/11/2026). Emenda a ADR 0070 (D1: onde o admin vê o link; D5: o que a página pública mostra) e a ADR 0072
(texto do MVP provisório). Plano em `docs/estado/tarefas/R101.md`. Perguntas 183 a 187 em `docs/estado/perguntas.md`.
Cada parte da R101 acrescenta a sua seção.

## Parte 1: app

1. **Link da rodada na tela 06 (D2, emenda a ADR 0070 D1).** A tela 06 de uma rodada aberta (antes de `startsAt`, não
   cancelada, não encerrada) ganha "Mandar no WhatsApp", que abre a folha de compartilhar com o texto da tela 20, e o "Copiar
   lista" leva "Confirma aqui: <link>" no fim. Só Admin e Co-admin (o servidor manda `shareUrl: null` aos demais) e só
   enquanto a rodada aceita resposta (`roundLinkOffer`, puro; nunca monta URL). A tela 26 não lê `shareUrl`. O link nunca vai
   a log nem a diagnóstico; a falha de abrir a folha é a nota "Use Copiar lista" (`shareNote` no reducer da tela).
2. **Janela dos avulsos explicada (D7, D8; 183 = opção 2).** Frase única da data (`dropInOpensPhrase`, fuso da rodada):
   "hoje, às 20h", "amanhã, às 20h" ou "na terça, 24/11, às 20h" ("no" para sábado e domingo; a data sempre vai). Substitui
   "ter, 20h". Tela 26: o avulso antes da janela lê a linha (com mensalista: "só os mensalistas confirmam"; sem: a janela e as
   horas), com o VOU desligado e a dica de acessibilidade "A lista ainda não abriu para você". Tela 06: "A lista dos avulsos
   abre {frase}." e "Mudar" (leva a Como jogamos, tela 18) para Admin e Co-admin, só antes da janela e com a rodada aberta.
   Quando a API devolve `dropInOpensAt` nulo (grupo sem mensalista, P3) a frase simplesmente não aparece. "Me avisa quando
   abrir" não entra: o servidor não manda esse push.
3. **"Encerrar rodada" sempre pergunta (D6, 187 = opção 1).** Telas 11 e 23 abrem a mesma folha: partidas terminadas
   nesta quadra, a partida em andamento que fica de fora do resumo e a consequência (sem outra partida; com votação do MVP
   ligada, "a votação do MVP abre por 24 h"). Botões "Encerrar rodada" e "Continuar jogando". O reducer não tem mais o atalho
   para `closing`. Na tela 11 o link desce para baixo de "Voltar ao início" (desvio de `FimPartida.dc.html`). A contagem é da
   sessão local do aparelho; o resumo conta as do servidor (pode divergir com outro celular na mesma rodada: é aviso, não regra).
   Sem a rodada no aparelho, a frase da votação é omitida nas duas telas.
4. **"Não vou mais" sempre pergunta (185 = opção 1; D4).** O corpo diz o que acontece: lista cheia com espera, "{Nome}
   (1º da espera) entra no seu lugar…"; cheia sem espera, "só volta se abrir vaga"; com vaga, "é só tocar em VOU de novo
   enquanto houver vaga". "Sair da espera" continua sem pergunta: não tira vaga de ninguém, e voltar é um VOU.
5. **MVP provisório (D5, 186 = opção 1; emenda a ADR 0072).** Com a votação aberta ou por abrir e o MVP pelo placar, o cartão
   diz "Na frente pelo placar" e, aberta, "A galera decide até {hoje|amanhã}, {12h44}" (relógio do celular). Fechada ou
   desligada, "MVP do dia". O texto do "Mandar pro grupo" segue a mesma tabela ("Na frente pelo placar: Leo (+7 de saldo). A
   galera decide o MVP até amanhã, 12h44."). Nenhum texto conta ou revela voto.
6. **Mensalistas fora de "Presença e vagas" (pedido do Gabriel, 23/11).** Desvio aprovado de `AjustesGrupo.dc.html`: a tela
   18 ganha a seção "Mensalistas" (interruptor `attendance.regularsEnabled`, e a janela dos avulsos só com mensalistas e
   presença ligados), logo abaixo de "Presença e vagas" (limite, espera e dia fixo). Os caminhos do catálogo não mudam; é só
   agrupamento e texto, e o teste do layout reprova se um campo de mensalista voltar para a seção de presença.

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
