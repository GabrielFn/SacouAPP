# Perguntas para o Gabriel

## Abertas
1. Preços dos planos (propostos): Pro do Grupo R$ 12,90/mês ou R$ 99/ano; Sacou+ do Jogador R$ 5,90/mês ou R$ 44,90/ano. Confirma? (Não bloqueia até o M6.)
2. Proteção da `main` (E0.4, "PR só entra com CI verde"): o GitHub não oferece proteção de branch nem rulesets em repositório privado no plano Free. Opções: (1) manter privado e grátis: o orquestrador só faz merge depois de conferir a CI verde, sem bloqueio imposto pelo GitHub; (2) GitHub Pro (gasto mensal novo): bloqueio de verdade; (3) tornar o repositório público: bloqueio grátis, mas expõe código e docs. **Recomendação: opção 1 até o piloto.** Não bloqueia: sigo com a opção 1 até a resposta.
3. E0.5 travada (3 revisões reprovadas seguidas): cada revisão achou um furo diferente nas regras de "próxima tarefa" que o desenvolvedor acrescentou em `docs/backlog.md`, além do plano. O último furo: tarefa bloqueada continua elegível. Opções: (1) enxugar: `backlog.md` fica só com o mapa marco → tarefas e uma regra curta remetendo ao `CLAUDE.md`, e passa por mais uma revisão; (2) manter as regras detalhadas, corrigir o último furo e fazer mais uma revisão; (3) aceitar como está e corrigir depois. **Recomendação: opção 1.** Bloqueia a E0.5 e a E0.8, que depende dela.
4. Livre e 6x0: o `produto.md` e as telas tratam como opções separadas, mas nos dados de formações há uma entrada só. Opções: (1) um botão só na interface, "Livre / 6x0"; (2) dois botões com o mesmo comportamento. **Recomendação: opção 1.** Não bloqueia a E1.1, que só fixa os dados; a decisão vale para as telas de escalação e ajustes (E4.5, E4.8).

## Respondidas
- **CI verde antes da E0.4:** a definição de pronto exige CI verde, mas a CI só nasce na E0.4. Até lá vale validação local em clone limpo. Decidida pelo orquestrador na E0.5, sem consulta ao Gabriel.
- **Cadência das sessões:** o plano fala em "4 horas" (linha 10) e "diária" (E0.7), e `docs/decisoes.md` em "quando quiser". Vale sessão manual, com a E0.7 adiada. Decidida pelo Gabriel (`PROMPT-INICIAL.md`). O plano só muda quando a E0.7 for retomada.
