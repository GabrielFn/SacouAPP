# ADR 0048 · Modos de fila, votação do MVP e areia rei da quadra no MVP

**Status:** aceito (12/11/2026). **Tarefa:** nenhuma; decisões do Gabriel em conversa de 12/11/2026, na revisão das telas do MVP. Muda `decisoes.md` (Fila e MVP do dia), traz de volta itens de `ideias.md` e cria as tarefas E2.12, E3.18 e E4.18.

## Contexto

Na revisão das telas do piloto (`design/mvp/`), três funções apareciam sem regra: o "Trocar" da regra da fila (o MVP só tinha o modo automático, ADR 0029), a "Votação da galera" do MVP do dia (sem tela nem regra) e o modelo "Areia rei da quadra" (duplas, quartetos e "ranking do dia" sem definição). O Gabriel decidiu manter as três no MVP.

## Decisões

### 1. Modos de fila (resposta "3-2")

O time que perdeu sai por um de três modos, escolhido pelo grupo:

- **Automático** (padrão, o de hoje, ADR 0029): sai o perdedor inteiro se há um time esperando; se só há avulsos, saem tantos quanto esperam.
- **Sempre o time inteiro:** o perdedor sai inteiro, mesmo com pouca gente esperando.
- **Número fixo:** sai sempre N do perdedor, pelo critério de quem sai primeiro.

E, independente do modo, **"vencedor também sai"**: interruptor com X vitórias seguidas. Ao chegar a X, o vencedor sai como se tivesse perdido. Os casos de borda (fila menor que N, os dois times saindo, quem entra no lugar) ficam com o analista da E2.12, registrados em `docs/dominio/fila.md` com golden TS/C#.

### 2. Votação do MVP (resposta "4-a", a proposta aceita)

- Só vota quem jogou na rodada, e ninguém vota em si mesmo.
- Abre quando a rodada termina e fecha 24 horas depois.
- Voto secreto: ninguém vê em quem cada um votou, nem o admin.
- Empate: vence quem teve mais saldo no placar.
- É opção do grupo (`decisoes.md`), ao lado do MVP pelos dados.

### 3. Areia rei da quadra (resposta "5-1")

- Times de 2 ou 4, com rotação desligada.
- Vencedor fica: a fila funciona com o time inteiro saindo, como "perde sai".
- **Ranking do dia:** lista das duplas ou quartetos por vitórias na rodada, calculada das partidas (E3.9), sem regra nova no motor.
- O "rei da quadra" tradicional, com partidas curtas e coroas, fica em `docs/ideias.md`.

## Telas (canvas "Sacou — Telas do MVP (piloto)" e `design/mvp/`)

- **18a Regra da fila:** os três modos, o número fixo e o "vencedor também sai". A 18 mostra o resumo e leva à 18a.
- **12a Votar no MVP:** lista de quem jogou, voto secreto e prazo. A notificação "Votação do MVP aberta" (28) leva a ela.
- **12b Resumo · areia:** o Resumo com o ranking do dia no lugar dos cartões de time.

## Consequências

- **E2.12** (motor, M4): os modos novos de fila em `match-engine`, com porte para C# e golden compartilhados. Desenvolvedor Opus (regra do motor).
- **E3.18** (API, M5): votação do MVP, com prazo, voto secreto e desempate. Votos guardam só `MemberId`. Entra no modelo de ameaças (voto duplicado, voto fora do prazo, quem pode ver).
- **E4.18** (app, M5): telas 12a e 12b.
- A E3.9 passa a calcular o ranking do dia por dupla ou quarteto.
- Somam cerca de 2 a 3 dias ao prazo do piloto.
