# Sorteio equilibrado (`TeamDraw`)

Regra da E3.6 (ADR 0047, decisões 2 a 5; [ADR 0055](../arquitetura/adr/0055-sorteio-no-servidor.md)). Código em `apps/api/src/Sacou.Modules/Sessions/Domain/Draw/`. Roda **só no servidor**: a nota do admin e a sugestão do jogador são privadas ([perfil-e-nota.md](perfil-e-nota.md)). A rota é a seção [Rota](#rota), da Parte 2 da E3.6.

## Entrada

- **Jogadores:** os confirmados da rodada (`Going` e `Promoted`, inclusive convidados), em ordem de chegada (`Sequence`). A ordem em que chegam do banco não muda o resultado.
- **Nível:** o resolvido por `MemberLevelResolver` (nota do admin, senão sugestão, senão 3,0), em décimos inteiros (35 = 3,5). Nada de `double`.
- **Tamanho do time:** pelo `format.modality` da rodada (`indoor-6x6` → 6, `beach-4x4` → 4, `beach-2x2` → 2).
- **Travas** (`DrawLock`): `together` ("Travar dupla") e `apart` ("Separar"). A tela do piloto só oferece "Travar dupla" (pergunta 56).
- **Reservas:** opcional; sem a lista, valem os últimos a chegar.
- **`balanceByLevel`:** `false` é o "sorteio rápido" (aleatório, respeitando as travas).
- **Semente:** um inteiro de 64 bits. A mesma entrada com a mesma semente dá sempre o mesmo sorteio; "Sortear de novo" é outra semente.

## Times e reservas (perguntas 52 e 53, recomendação seguida)

`k = n ÷ s` times completos e `n mod s` reservas. Com menos de dois times completos, **dois times de `n ÷ 2`** e `n mod 2` reserva. Todos os times têm o mesmo tamanho.

| Confirmados | Modalidade | Times | Reservas |
|---|---|---|---|
| 14 | 6x6 | 2 de 6 | 2 |
| 13 | 6x6 | 2 de 6 | 1 |
| 17 | 6x6 | 2 de 6 | 5 (na fila) |
| 10 | 6x6 | 2 de 5 | 0 |
| 11 | 6x6 | 2 de 5 | 1 |
| 9 | 2x2 | 4 de 2 | 1 |
| 12 | 4x4 | 3 de 4 | 0 |
| 3 | qualquer | erro `sessions.draw-not-enough-players` | |

Reservas sem lista: **os últimos a chegar**, em ordem de chegada (tela 07: "1 · Davi, 2 · Sofia"). Com lista (depois de um "Trocar"): exatamente o número de reservas, sem repetir e só confirmados; a ordem enviada é a ordem da fila.

## Travas

- `together` une jogadores em blocos, de forma transitiva (A-B e B-C formam um bloco de 3).
- `apart` proíbe dois blocos no mesmo time.
- Uma trava só vale entre jogadores dos times (nunca com reserva ou com quem não confirmou), entre duas pessoas diferentes, sem repetir o mesmo par com o mesmo tipo. No máximo 24 travas.

## Objetivo

Em ordem: (a) menor diferença entre a **maior e a menor média exata** dos times (comparadas por produto cruzado, em inteiros); (b) menor soma dos quadrados das somas dos times (para o mesmo total, é o espalhamento das somas em torno da média); (c) entre os empatados, a semente escolhe. Assim "Sortear de novo" muda os times sem perder o equilíbrio.

- **Dois times com até 16 jogadores** (o piloto): todas as divisões são testadas (no máximo 6.435) e a semente escolhe entre as ótimas. É o caminho do aceite.
- **Acima disso:** 64 partidas de uma busca local (embaralha os blocos pela semente, distribui em serpentina pelo nível e troca grupos de mesmo tamanho entre dois times, um bloco ou dois avulsos, enquanto melhora). Para cedo quando já tem 8 divisões com a menor diferença que os níveis permitem, que é o ótimo.
- **Sorteio rápido:** um embaralhamento, blocos distribuídos um time após o outro, sem otimizar.

## Medidor (tela 07)

A média de cada time é a soma ÷ o tamanho, arredondada para o décimo, **meio para cima** (220 em 6 = 36,67 → 3,7; 35,5 → 3,6). A **diferença** é a maior média arredondada menos a menor média arredondada, a mesma conta que o admin vê (nunca "3,6 · 3,6 · diferença 0,1"). A otimização usa os valores exatos. O app recalcula o medidor depois de "Trocar": golden compartilhado em `packages/volley-rules/golden/draw-balance.json` (executores C# e TS, `drawBalance` de `@sacou/volley-rules`). O rótulo é da E4.7 (pergunta 55, seção "No app").

## Exemplo da tela 07 (G1)

14 confirmados em 6x6: Ana 4,0, João 4,0, Pedro 4,5, Lia 3,5, Marcos 3,0, Bia 3,5, Rafa 4,0, Duda 3,5, Caio 4,0, Nina 3,5, Léo 3,0, Gabi 4,0, Davi 3,5, Sofia 3,0; Ana e João travados juntos. Reservas Davi e Sofia. Os 12 somam 445 (ímpar em meios pontos), então a melhor divisão é 220 contra 225: médias 3,7 e 3,8, "Diferença 0,1".

## No app (tela 07, E4.7)

[ADR 0061](../arquitetura/adr/0061-sorteio-no-app.md). O resultado fica só na memória da tela; cada abertura sorteia de novo.

- **Rótulo do medidor** (pergunta 55): diferença até 2 décimos é "ótimo", até 5 é "bom", acima é "desequilibrado". O app recalcula médias e diferença a partir do arranjo, com o golden compartilhado.
- **Eixo da barra:** de `floor(menor)` até um ponto inteiro acima; se a maior média passar, até `ceil(maior)`. Médias 3,7 e 3,8 → de 3,0 a 4,0; 3,9 e 4,1 → de 3,0 a 5,0. Com mais de dois times, só a maior e a menor ganham marcador.
- **Trocar:** dois nomes de times diferentes, ou um do time e uma reserva, trocam de lugar; quem vai para as reservas ocupa o lugar na fila de quem saiu. Dois do mesmo time não mudam nada. Trocar um travado tira a trava dele (a troca manual vence), com aviso.
- **Travar dupla:** só entre jogadores dos times (reserva não trava), cada par uma vez, no máximo 24. No mesmo time, só trava; em times diferentes, pede um sorteio novo com as travas, e a trava sai se o servidor recusar. Depois de um par, o modo volta a "Trocar". "Destravar" tira todas as travas do nome selecionado.
- **Sortear de novo:** manda as travas e as reservas atuais. Se a lista mudou desde o sorteio, as reservas ficam com o servidor e as travas de quem saiu são descartadas.
- **Lista que mudou:** se alguém do sorteio saiu da rodada, a tela avisa e desliga "Confirmar"; se alguém confirmou depois, só avisa.
- **Compartilhar:** o texto leva só os apelidos de cada time e da fila ("Reservas: 1 Davi, 2 Sofia"), nunca nota, posição nem ID.

## Montar times (sorteio desligado, resposta 72)

Com `draw.enabled` desligado (o padrão do catálogo e do "Do zero"), a tela 07 não sorteia: monta os times **por ordem de chegada**, sem chamar o servidor e sem rede.

- **Divisão:** a mesma da seção [Times e reservas](#times-e-reservas-perguntas-52-e-53-recomendação-seguida). Os primeiros a chegar enchem o time 1, os seguintes o time 2, e assim por diante; os últimos ficam na fila. 14 em 6x6: 1 a 6 no Laranja, 7 a 12 no Azul, 13 e 14 reservas. Golden compartilhado `packages/volley-rules/golden/draw-split.json` (`splitByArrival` no TS; o `TeamDraw` do C# confere tamanhos e reservas).
- **Sem nota e sem medidor:** nenhum nível é lido.
- **Trocar:** igual ao do sorteio. Não há "Travar dupla" (trava só vale para o sorteio). "Montar de novo" volta à ordem de chegada.
- **Lista que mudou:** até a primeira troca, quem confirma depois entra na fila. Depois dela, a tela avisa ("Monte de novo") e, se alguém saiu, desliga "Confirmar".
- **Confirmar e compartilhar:** igual ao do sorteio, e segue para a folha 08.
- Menos de 4 confirmados: "Precisa de pelo menos 4 confirmados para montar os times."


Os códigos dizem só o motivo, nunca nome nem nota.

| Código | Quando |
|---|---|
| `sessions.draw-not-enough-players` | Menos de 4 confirmados |
| `sessions.draw-reserves-invalid` | Lista de reservas com outro tamanho, repetida ou com quem não confirmou |
| `sessions.draw-lock-invalid` | Trava com reserva, com quem não confirmou, consigo mesmo, repetida, ou mais de 24 travas |
| `sessions.draw-lock-too-large` | Bloco `together` maior que o time |
| `sessions.draw-locks-conflict` | `apart` entre dois jogadores do mesmo bloco `together` |
| `sessions.draw-locks-unsatisfiable` | Nenhuma divisão respeita todas as travas (3 separados dois a dois em 2 times), ou nenhuma foi achada antes de acabar o orçamento de passos do sorteio |
| `sessions.draw-disabled` | A configuração da rodada tem o sorteio desligado (`draw.enabled`) |

## Rota

`POST /v1/groups/{groupId}/rounds/{roundId}/draw`, só Admin e Co-admin (`DrawTeams`). Corpo, sempre um objeto (`{}` é um sorteio simples):

```json
{ "locks": [{ "first": "<memberId>", "second": "<memberId>", "kind": "together" }], "reserves": ["<memberId>"] }
```

Os dois campos são opcionais; numa trava os três são obrigatórios (`kind` é `together` ou `apart`). Campo a mais, `kind` desconhecido, id que não é GUID ou item nulo em `reserves` dão 400 da leitura estrita; trava nula dá `sessions.draw-lock-invalid`. Resposta `200` com `Cache-Control: no-store`:

```json
{ "seed": "1234567890123456789", "playersPerTeam": 6,
  "teams": [{ "number": 1, "members": [{ "memberId": "<id>", "levelTenths": 40 }], "averageTenths": 37 }],
  "reserves": [{ "memberId": "<id>", "levelTenths": 35 }], "differenceTenths": 1 }
```

- **Jogadores:** os confirmados da rodada que ainda são membros ativos do grupo (quem saiu não entra, como a próxima leitura da rodada o tiraria).
- **`seed`** vai como texto: um inteiro de 64 bits não cabe num número de JavaScript. Vem de `RandomNumberGenerator` a cada chamada; não é aceita no corpo.
- **`number`** começa em 1; os membros vêm em ordem de chegada.
- Nunca a origem da nota, apelido nem sugestão. Nada é gravado.
- Recusas: rodada de outro grupo ou inexistente → 404 `sessions.round-not-found`; cancelada → 409 `sessions.round-closed`; `draw.enabled = false` → 409 `sessions.draw-disabled`; os erros do domínio acima.
- **Orçamento de passos por sorteio** (`DrawLimits.MaxPlacementSteps`, `PlacementBudget`): o posicionamento com travas "separar" põe primeiro os blocos com mais travas, e todas as partidas da busca dividem 100.000 passos. Acabando antes da primeira divisão, `sessions.draw-locks-unsatisfiable`; acabando depois, vale a melhor divisão já achada. O pior sorteio medido gastou 3.155 passos (ADR 0055).

## Fora do escopo

Equilibrar por posição e "evitar repetir times" (`produto.md:66`), pergunta 56. Sorteio sem internet (pergunta 54): exige conexão no piloto.
