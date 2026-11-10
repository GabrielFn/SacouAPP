---
name: sabotagem
description: Roteiro do testador do Sacou para provar que os testes pegam erros plantados (mutações), rápido e sem atrapalhar outros agentes na mesma pasta. Use ao validar um PR.
---

# Sabotagens do testador

Objetivo: para cada critério de aceite que importa, plantar o erro e ver algum teste reprovar. Se nenhum reprovar, escrever o teste que falta (é a única razão para o testador fazer commit).

## Escolha

- No máximo **6** sabotagens, as que mais doem se escaparem: permissão, regra do vôlei, concorrência, persistência, entrada da API, regra do front no lint.
- Uma por vez, sempre revertida antes da próxima.

## Onde

- Se outro agente usa a mesma pasta (revisor rodando build), copie o repositório para `D:\tmp\sab-<tarefa>` e sabote a cópia; apague a cópia no fim.
- Reaproveite o build da cópia entre sabotagens; não limpe `bin/obj` nem `node_modules`.
- Encerre só processos que você criou (pelo PID). Nunca filtre processos por linha de comando.

## Rodar só o que cobre

Nunca rode a suíte inteira por sabotagem.

- C#: `dotnet test --project <projeto> --filter-class "*<Classe>Tests"` (unidade primeiro; integração com Postgres só se a unidade não pega, como corrida e transação).
- TS: `vitest run <arquivo-ou-pasta>` em `apps/mobile` ou no pacote.
- Regra de lint: `eslint <arquivo>`.
- Analisador barrando o build antes do teste: `-p:TreatWarningsAsErrors=false` só nessa rodada.

Confira que a sabotagem mexeu no código e não num comentário: se nada reprovar, olhe o diff antes de concluir que há lacuna.

## Relatório (até 15 linhas)

PASSOU ou REPROVOU, comandos rodados com o resultado e uma tabela curta:

| # | Sabotagem | Teste que pegou |
|---|---|---|

No fim: `git status` limpo, nenhuma sabotagem no disco, cópia apagada.
