# ADR 0055 · Sorteio equilibrado no servidor, com semente própria

**Status:** aceito (14/11/2026). **Tarefa:** E3.6, parte 1. Plano em [`docs/estado/tarefas/E3.6.md`](../../estado/tarefas/E3.6.md); regra em [`docs/dominio/sorteio.md`](../../dominio/sorteio.md).

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
