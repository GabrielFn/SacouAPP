# ADR 0081 — Snapshot em memória do stream da quadra

Status: aceita (24/11/2026, E5.3b Parte 1). Complementa as ADRs 0060 e 0063. A Parte 2 (concorrência no
`court-sync`, `lock_timeout`, `close` e estatísticas) acrescenta uma seção aqui.

## Contexto

Cada escrita na quadra lia, analisava e reproduzia o stream inteiro sob o `FOR UPDATE` (ADR 0060, A10): o 20.000º
evento levava 9,0 s em Debug com banco; em Release, sem banco, 2,1 s de parse e 1,3 s de `Decide`. Uma conta grátis
segurava a trava, o pool e a memória (M4-A1). O backlog pede o lote no 20.000º evento abaixo de 500 ms em Release, por
snapshot ou teto menor.

Opções (plano `docs/estado/tarefas/E5.3b.md`): **A.** baixar o teto (o custo segue linear sob a trava e um racha longo
trava a quadra); **B.** snapshot persistido (o `RevertedTo` vai a qualquer evento, então o estado final não basta:
precisaria serializar a linha do tempo inteira com fidelidade total); **C.** snapshot em memória por versão. Escolhida a C.

## Decisão

1. **O que é o snapshot** (`Domain/CourtSessions/Writes/StreamSnapshot`, imutável, domínio puro): os eventos gravados
   em ordem de posição, cada um pelo `eventId`, a maior `sequence` por aparelho, os bytes, o `matchId` de cada evento,
   as contagens dos tetos (`StreamCounterKey`) e a linha do tempo ativa (`Timeline<CourtSessionState>`), mais o último
   evento na `CanonicalOrder`. A versão é o número de eventos gravados: o stream é só de acréscimo, então o conteúdo até
   a posição N nunca muda.
2. **Replay incremental equivalente** (`EventReplayer.ContinueSteps`): continua da cabeça guardada só com os eventos
   novos, normalizando só eles. Vale quando a cabeça existe e os novos vêm todos depois de todos os gravados pela chave
   de ordem (lote, `sequence`, aparelho), com IDs novos e do mesmo stream (`EventReplayer.Follows`). Pelas regras de
   escrita (ADR 0060 D2 a D4, ADR 0063 D1) isso sempre vale para o escritor do lote atual. **Falha fechada:** fora disso,
   ou com gravados que não reproduzem (cabeça nula), cai no replay do stream inteiro e nas contagens desde o início,
   como antes; a decisão então sai sem snapshot e o store descarta a cópia.
3. **Contagens semeadas:** `StreamLimitCheck` usa as contagens do snapshot, com a mesma função `CountersOf`. São iguais
   às de antes porque um `RevertedTo` gravado que reproduz aponta para um evento anterior, já contado.
4. **Cache** (`Infrastructure/MemoryCourtStreamSnapshots`, singleton): um LRU próprio, medido em eventos
   (`CourtStreamCache:MaxEvents`, padrão 60.000 = três streams cheios, validado na partida: no mínimo um stream cheio),
   expiração deslizante de 30 min e absoluta de 6 h. Não é o `MemoryCache`: com `SizeLimit` ele recusa a entrada que não
   cabe em vez de abrir espaço, e com o cache cheio nenhum stream novo ficava guardado (visto na medição). Só aceita
   versão maior que a guardada; um snapshot reconstruído do zero substitui o guardado.
5. **Construção fora da trava:** antes da transação, o store lê sem trava a linha do stream e o escritor atual; só
   **o escritor atual** do grupo e da rodada da rota faz o snapshot ser construído ou avançado, por
   `EnsureAsync(courtSessionId, event_count)`. Uma construção por stream (as outras esperam a mesma tarefa), num escopo
   próprio e sem o token da requisição, e um portão comum (`MaxConcurrentBuilds`, padrão 2). Sem vez em
   `BuildWaitMilliseconds` (padrão 2 s) a escrita responde **503 `matches.court-busy` com `Retry-After: 2`**
   (`ErrorKind.Unavailable`, novo); o app já trata 503 como espera.
6. **Sob a trava:** a linha, os escritores e, para quem **não** escreve o lote atual, a recusa (`not-the-writer`) sem
   ler envelope nenhum: o `lastSequence` vem de `max(sequence)` do aparelho, pelo índice único. Para o escritor, o store
   confere o snapshot contra o banco (lê as posições a partir da versão; a da versão precisa ter o mesmo `eventId`, senão
   reconstrói do zero), analisa só os eventos depois dela (normalmente nenhum), decide, grava e, **só depois do
   `COMMIT`**, publica o snapshot com os novos eventos. Rollback, exceção ou recusa não publicam nada além do que a trava
   leu (tudo já commitado). Se a versão final não bater com `event_count`, a cópia é descartada.
7. **Troca** (`TakeOverAsync`): não lê envelopes. A contagem é `event_count` da linha e o `lastSequence`, o `max` do
   aparelho. `CourtTakeover.Decide` recebe `IWrittenStream` (interface que `StoredStream` e o leve `WrittenStream`
   implementam).
8. **Log** `Court events stored.` ganha `lockedMs` (tempo da transação) e `snapshot` (`hit`, `advanced`, `built` ou
   `none`). Só números e palavras fechadas.

## Medição (A10, `CourtVolumeTests`, API real e Postgres no Docker)

Stream de 20.000 eventos: o 1º pela rota, 19.997 copiados direto na tabela, o 19.999º pela rota (frio, constrói o
snapshot fora da trava) e o 20.000º pela rota (quente). Cinco streams novos depois de aquecer o JIT. Portão:
`SACOU_PERF_GATE=1` num build Release (o projeto define a constante); em Debug só o teto generoso de 30 s.

| Onde | Quente (20.000º) | Frio (19.999º) | Trava no frio | Memória retida por stream cheio |
|---|---|---|---|---|
| Máquina de desenvolvimento, Release (24/11) | mediana **21 a 27 ms** (6 a 17 ms com a trava) | 505 a 1.083 ms | **9 a 30 ms** | **~25,6 MiB** |
| CI (GitHub Actions, PR #241) | mediana **12 ms** (3 a 5 ms com a trava) | 371 a 754 ms | **5 a 7 ms** | ~25,6 MiB |

Sem snapshot (a primeira medição, com o cache recusando a entrada), o frio sob a trava ficou em 405 a 926 ms de trava e
o 20.000º em 887 ms de mediana: o mesmo caminho de antes, que o snapshot tira da trava. Com ~25,6 MiB por stream cheio
(abaixo dos ~60 MiB do risco 2 do plano), o snapshot guarda os envelopes; 60.000 eventos são ~77 MiB no pior caso, que
cabem nos 512 MiB do Cloud Run com folga.

## Consequências

- O lote quente não faz parse nem replay do stream; o custo sob a trava é o do banco mais o dos eventos novos.
- **Frio depois de deploy, reinício ou despejo:** a próxima escrita do stream reconstrói fora da trava (~0,5 a 1 s em
  Release nesta máquina), uma por stream, no máximo duas ao mesmo tempo. Risco aceito; a opção B fica para depois do
  piloto se o Cloud Run reiniciar muito.
- **Mais de uma instância:** continua correto (cada escrita confere a cópia contra o banco), só menos eficaz. Com
  `maxScale` 1 (ADR 0068) o cache vale para todas as requisições.
- **Linha alterada no banco por fora da API:** uma linha já no snapshot e editada no lugar só é vista na próxima
  reconstrução (o `eventId` da versão continua o mesmo). A tabela é só de acréscimo e só a API escreve; uma linha
  acrescentada por fora ainda é analisada e, corrompida, dá 500 como antes (A9 ajustado para isso).
- Superfície nova: uma cópia em memória do conteúdo gravado (IDs de membro, nada de nome), nunca em disco nem em log;
  a chave é o `courtSessionId`, e o acesso continua decidido antes (filtro `WriteCourt`, `BelongsTo` sob a trava).
- `ICourtStreamStore.AppendAsync` recebe `CourtAppendRules` (a recusa do escritor e a decisão) e `CourtAppend` passa a
  levar o aparelho e o membro; `CourtTakeoverCall` leva o aparelho.
- Desvios do plano: (a) o número é 0081, não 0078 (já usado); (b) `Advance` sobre gravados que não reproduzem não falha:
  deixa a cabeça nula e manda as escritas para o replay inteiro, que recusa com o mesmo código de antes (equivalência
  em vez de `CorruptCourtStreamException`); (c) LRU próprio em vez de `IMemoryCache`; (d) sem `LoadAfterAsync` em
  `ICourtEventStore`: a leitura a partir da versão é do `ICourtSnapshotSource`, e as estatísticas passam a usar o
  snapshot na Parte 2; (e) o portão vem de uma constante de compilação definida pelo ambiente do build, porque os testes
  de integração não podem ler variável de ambiente (`IntegrationSetupRules`).
