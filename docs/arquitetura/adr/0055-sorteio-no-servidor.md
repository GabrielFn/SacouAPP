# ADR 0055 · Sorteio equilibrado no servidor, com semente própria

**Status:** aceito (14/11/2026). **Tarefa:** E3.6, partes 1 e 2. Plano em [`docs/estado/tarefas/E3.6.md`](../../estado/tarefas/E3.6.md); regra em [`docs/dominio/sorteio.md`](../../dominio/sorteio.md).

## Contexto

O sorteio equilibra os times pela nota do admin, pela sugestão do jogador ou por 3,0 (ADR 0047). As duas notas são privadas: a do admin só sai do Groups pelo contrato `IMemberLevels`, sem rota (ADR 0051, D9), e a sugestão não aparece para os outros membros. O admin precisa ver as notas na tela 07 e poder "Sortear de novo" com outros times igualmente equilibrados.

## Decisões

1. **Só no servidor (módulo Sessions).** Rodar no app exigiria mandar as notas de todos e guardá-las no celular. No servidor, o algoritmo lê as notas e devolve o resultado só a Admin e Co-admin (Parte 2). Por isso não há porte TS do algoritmo nem golden compartilhado dele: os casos do sorteio são C#, como a tabela do `MemberLevelResolver`.
2. **Sem estado.** O sorteio calcula e devolve; não grava tabela nem evento, então nenhum evento carrega nota. "Sortear de novo" é outra chamada. Os times confirmados entram na quadra pelo início da partida (E4.7), só com `MemberId`.
3. **Gerador próprio (SplitMix64).** `System.Random` pode mudar a sequência entre versões do .NET e quebraria o determinismo e os testes. `SeededRandom` tem 20 linhas, vetores de teste conhecidos (sementes 0 e 1) e embaralha por Fisher-Yates, com sorteio sem viés. A semente vem de `RandomNumberGenerator` na rota e volta na resposta; o domínio só a recebe. A semente não revela nota.
4. **Busca exata no caso do piloto.** Com dois times e até 16 jogadores, todas as divisões (no máximo 6.435) são testadas e a semente escolhe entre as ótimas. Acima disso, 64 partidas de busca local com trocas entre dois times (um bloco por outro do mesmo tamanho, ou por dois avulsos), com parada antecipada quando a diferença chega ao mínimo que os níveis permitem (o MDC das somas dos blocos), que é o ótimo. Tudo em inteiros, sem `double`.
5. **Medidor compartilhado.** A média arredondada (meio para cima) e a diferença entre as médias arredondadas são a única parte que o app repete (depois de "Trocar"). O golden fica em `packages/volley-rules/golden/draw-balance.json`, lido pelo C# agora e pelo TS na E4.7.

## Consequências

- Sem internet, sem sorteio (pergunta 54): o app avisa no piloto.
- Os casos golden do sorteio (`TeamDrawGoldenTests`) fixam a diferença, as travas, as reservas e o determinismo, nunca quem cai em cada time (a não ser os pares travados), para que uma busca melhor não os quebre. O caminho exato e a busca local são comparados com um oráculo de força bruta (500 casos de 2 times, 200 de 3 times de 4).
- O projeto de testes só embute arquivos das pastas `golden/` dos pacotes (regra de arquitetura); por isso os casos do sorteio ficam no código do teste, não num `draw.json` ao lado dele.
- A busca local não garante o ótimo acima de 16 jogadores em casos raros; o teste de 36 jogadores confere que nenhuma troca de dois jogadores melhora e mede o tempo (cerca de 60 ms em Debug; o teste aceita até 1 s, o mais rápido de 5, porque a CI roda os projetos de teste em paralelo e 200 ms falhou com a máquina ocupada).

## Parte 2 · Rota (14/11/2026)

- **Rota e capacidade.** `POST /v1/groups/{groupId}/rounds/{roundId}/draw`, capacidade nova `DrawTeams` (Admin e Co-admin) na tabela `RolePermissions`, lida pelo filtro da rodada a cada requisição. Sem trava de rodada: a rota não grava. `Cache-Control: no-store` em toda resposta da rota. Contrato em [`sorteio.md`](../../dominio/sorteio.md#rota).
- **Configuração tipada.** `RoundSettings` ganhou `DrawRules` (`draw.enabled`, `draw.balanceByLevel` e o tamanho do time de `format.modality`), lido pelo Groups como `AttendanceRules`; o Sessions não lê o JSON da configuração.
- **Jogadores:** os confirmados da rodada que ainda são membros ativos; quem saiu do grupo não é sorteado.
- **Semente pela interface `IDrawSeeds`** (`RandomNumberGenerator` em produção), para os testes poderem fixá-la.
- **`ToString` sem nota.** `DrawPlayer`, `DrawInput`, `DrawUnit`, `DrawnTeam`, `DrawResult`, `DrawScore` e as respostas da rota devolvem só o nome do tipo, como `GuestName`.
- **Teto de passos** no posicionamento com travas "separar" (`DrawLimits.MaxPlacementSteps` = 100.000): acima dele, `sessions.draw-locks-unsatisfiable`. Na busca local, só a primeira partida que falha encerra o sorteio; uma partida seguinte que estoura o teto é pulada. **Medição (14/11/2026, Debug, 6.300 casos aleatórios de 24 travas "separar" entre 3 e 48 jogadores, de 2 a 8 times de 2, 4 e 6, mais ciclos ímpares de 3 a 23 em 2 a 4 times):** com a ordem da Parte 1 (blocos com trava primeiro, na ordem embaralhada), o pior caso levou **626.443 passos e 2,4 s** (5 times de 6, travas entre os 24 primeiros, com divisão possível). Por isso o posicionamento passou a pôr primeiro os blocos com mais travas "separar" (e depois os maiores), mantendo a ordem embaralhada entre iguais: o pior caso caiu para **1.184 passos e 3 ms** (ciclo ímpar de 23 em 2 times de 12, sem divisão possível) e nenhum caso passou de 10.000. O teto de 100.000 fica cerca de 85 vezes acima do pior medido, com o custo de cerca de 0,4 s se for atingido. Testes: `TeamPlacementTests` (teto 1 recusa; teto de 10.000 nunca muda a resposta em 100 casos aleatórios; ciclo de 23 recusado dentro dele).

### Desvios do plano (D3)

- `seed` vai como **texto**, não número: um inteiro de 64 bits perde precisão num número de JavaScript.
- O time tem `number` (a partir de 1, como o domínio), não `index`.
- Código novo `sessions.draw-disabled` (409) para `draw.enabled = false`.
