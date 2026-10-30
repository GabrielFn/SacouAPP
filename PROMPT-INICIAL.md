# Prompts para o Claude Code

## 1ª sessão (cole isto na primeira vez)

```
Você é o orquestrador do desenvolvimento do Sacou. Leia o CLAUDE.md e siga o ritual de sessão.
Leia também docs/decisoes.md, docs/plano-mvp.md e docs/revisao-mvp.md antes de começar.

Comece o marco M1 (Fundação), tarefa por tarefa, respeitando as dependências do backlog
e usando o ciclo de agentes do CLAUDE.md (analista → desenvolvedor → revisor → revisor-seguranca quando sensível → testador → merge).
A E0.7 (tarefa agendada) fica para depois: por enquanto eu abro as sessões manualmente.

Me consulte só nos casos da seção "Autonomia". Nunca me peça segredos pelo chat.
Ao terminar a sessão, escreva o diário em docs/estado/sessoes/, atualize o progresso e faça commit.
```

## Sessões seguintes (cole isto sempre que abrir de novo)

```
Continue o desenvolvimento do Sacou: siga o ritual de sessão do CLAUDE.md, pegue a próxima tarefa do backlog e siga o ciclo de agentes até eu precisar decidir algo ou o marco terminar.
```

## Quando terminar um marco

```
Faça a revisão de segurança geral do marco com o revisor-seguranca, atualize docs/seguranca/checklist.md e me mande o relatório do marco: o que ficou pronto, como eu testo, decisões tomadas sozinho e perguntas abertas.
```
