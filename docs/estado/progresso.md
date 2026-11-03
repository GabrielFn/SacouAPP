# Progresso

**Marco atual:** M2 · Motor da partida, em andamento (ok do Gabriel em 02/11/2026). M1 fechado em 01/11/2026 ([relatório](relatorios/M1.md)).

| Tarefa | Status | Observação |
|---|---|---|
| E0.1 | Feita | Plano em `docs/estado/tarefas/E0.1.md`; decisões no ADR 0001. Aprovada no ciclo 2 de revisão. |
| E0.3 | Feita | Plano em `docs/estado/tarefas/E0.3.md`; decisões no ADR 0002. Aprovada na 3ª revisão. Testador validou `7cd507e`; o commit final `807dbe8` (docs e bloqueio de JS no app) teve lint e regressão rodados pelo desenvolvedor. |
| E0.4 | Feita | PR #1; decisões no ADR 0004. Aprovada no ciclo 2 de revisão. Sondas reais: `ci-ok` passa em PR só de docs e reprova com falha plantada. |
| E0.5 | Feita | `docs/backlog.md` enxuto por decisão do Gabriel; ADR 0003. Aprovada na 4ª revisão. |
| E1.1 | Feita | PR #7; decisões no ADR 0006. Comparação independente: 168 coordenadas, 0 diferenças do explorador. |
| E0.2 | Feita | PR #8; decisões no ADR 0005. Testes de arquitetura reprovam cada violação plantada. Aprovada no 3º ciclo de testes. |
| E0.9 | Feita | PR #13 (`6eb61cf`), ADR 0007. Revisor, revisor de segurança e sonda de merge real aprovados. Exceção do `zod` aprovada pelo Gabriel até 31/01/2027. |
| E0.8 | Feita | PR #15; ADRs 0008–0019, glossário, ameaças, LGPD, segredos e checklist. O checklist segue todo pendente: não há código sensível ainda. |
| E0.6 | Feita | PR #20; ADR 0020. Aprovada no ciclo 2. Testador passou em `9ed437d`. Falta só o caso de Docker desligado, com o Gabriel. |
| Revisão geral de segurança do M1 | Feita | Aprovada com condições, inclusive o complemento da E0.6 ([parecer](../seguranca/revisoes/M1-2026-11-01.md)). |
| SEC-M1 | Feita | PR #22 (`3458c06`). Revisor, revisor de segurança e testador aprovaram no ciclo 1. |
| E1.2 | Feita | Decisões no ADR 0021. Aprovada no ciclo 2, com oráculo independente: 71 casos, 0 divergências. |
| E1.3 | Feita | Decisão de arredondamento em `docs/dominio/player-card.md`: 1790 já é Elite. Citar no relatório do M2. Oráculo independente: 18 casos, 0 divergências. |
| E1.4 | Feita | Revisor, revisor de segurança e testador aprovaram em `8e84e71`; ajustes pontuais pedidos por eles lidos pelo orquestrador, com CI verde. Normalização em `docs/dominio/pix.md`: citar no relatório do M2. |
| E2.1 | Feita | ADR 0022. Revisor e testador aprovaram; a segurança reprovou um travamento, corrigido com `MAX_PAYLOAD_NODES` e reconferido em `8d179e3` (bateria incompleta: 3 casos sem rodar e 3 sem medição válida, ver pendências). Oráculo independente na primeira versão do golden. |
| E2.2 | Feita | ADR 0023 e `docs/dominio/placar.md`. A segurança reprovou o ciclo 1 por falta de memória em log hostil, corrigida com `MAX_FINISHED_MATCHES` e reconferida com medição. Revisor com oráculo próprio: 377 casos, 0 divergências. Testador passou, com 766 testes no `match-engine`. Citar no relatório do M2: limites de 1 a 99, 24 membros e 200 partidas por stream, `winMargin` 1 ou 2 também no tie-break, sem teto de pontos. |
| E1.5 | Feita | ADR 0025. Formações, validador e cartinha em C#, com os mesmos golden. Revisor aprovou; o testador passou, com oráculo TS × C#: 291 linhas, 0 diferenças, e a API publicada lê o catálogo da DLL. O orquestrador fechou dois restos do desenvolvedor (`AllowedDomainTypes` e o caso da chave com escape), lidos pelo revisor. Fecha o B3 e o B4 da revisão do M1. |
| E2.3 | Feita | ADR 0024 e `docs/dominio/rotacoes.md`. Revisor com oráculo próprio: 355.845 estados, 0 divergências; reprovou só por faltar o ADR 0024 na visão geral, corrigido pelo orquestrador. Segurança aprovou, com medição de 64 mil eventos. Testador passou: 1010 testes no `match-engine` e 11 mutações reprovadas, sem rodar as de número 7, 8, 10 a 16 e a variante da 17. Citar no relatório do M2: exceção a `decisoes.md:26` (side-out derivado), lado da quadra fora do motor, `lineup` ancorado no levantador. |
| E2.4 | Feita | ADR 0026. Revisor com oráculo próprio: 48 combinações, 0 divergências; golden migrados só com acréscimos. Segurança aprovou. Testador passou: 1338 testes no `match-engine` e 21 mutações reprovadas. Citar no relatório do M2: `formationsVersion` no lugar da cópia congelada, decisão do Gabriel. |

## Em andamento

- E2.5 (front): branch `task/E2.5-bench-rotation`, worktree `.claude/worktrees/e2-5`. Plano refeito para só Manual, decisão do Gabriel; desenvolvedor (Opus) em curso. Sensível: passa pelo `revisor-seguranca`.

## Adiadas

- E0.7: tarefa agendada. Adiada pelo Gabriel em 30/10/2026: por enquanto as sessões são abertas manualmente.

## Pendências herdadas

- Lint, lacunas que não violam o aceite da E0.3: `Reflect.get(globalThis, "fetch")` passa na pureza; `*.test.ts` importado por código de produção vai para o `dist`; `scripts/lint-regression.mjs` não tem casos para `functional/immutable-data`, `prefer-readonly` e `no-param-reassign` (as regras funcionam, só a regressão não as cobre).
- CI: rodar sempre `pnpm install --frozen-lockfile` antes do Turbo: editar o `pnpm-lock.yaml` sem reinstalar não invalida o cache.
- Revisão do M1, A4: a E2.1 só entra na `main` com teste de esquema fechado do envelope e nomes proibidos; a regra em C#, por reflexão, fica na E2.10 ou E3.7.
- Revisão do M1, B5: trocar o e-mail realista de `design/telas/Conta.dc.html:42`; sem Google Fonts na página web da E3.12.
- SEC-M1, ressalvas não bloqueantes: apagar um `packages.lock.json` não reprova, pois o restore o recria (exigir um lock por `.csproj` em `test:tooling`); `expires` aceita data impossível; `auditConfig.ignoreCves` passa sem par, sem confirmar se o pnpm 12 o respeita; a validade em `nuget-audit-exceptions.json` não tem teto.
- E3.10: validar tipo e formato na fronteira, conferir o dígito verificador de CPF e CNPJ e mostrar tipo e chave para confirmação; confirmar se chave de e-mail aceita maiúsculas (Manual do DICT).
- E2.1, pendências: o orçamento conta nós, não bytes, então o corpo precisa de limite antes do parser (E3.7); com referências compartilhadas, chaves muito longas chegam a 18,7 s de CPU, o que não ocorre por JSON; `cloneArray` deveria percorrer por índice, em vez de `Array.from`, por causa de iterador próprio; chaves com forma de inteiro saem em ordem numérica, então parsers por tipo não devem usá-las; a regra equivalente em C#, por reflexão, fica na E2.10 ou E3.7. Casos não medidos: iterador infinito, Proxy com `length` falso e getter que lança.
- E2.2, pendências: `score/index.ts` usa `export *` e expõe `MAJORITY_DIVISOR` e `SCORE_PAYLOAD_SHAPES` (estreitar antes de a E3.7 consumir); E3.7: UUID sem conferência de versão deixa `matchId`, `eventId` e `deviceId` carregarem 16 bytes arbitrários; projeções e Stats usam `(courtSessionId, matchId)`, porque `matchId` só é único no stream; E4: placar sem teto chega a 300–0 num log hostil, e a tela mostra dois dígitos; E2.10: conferir o custo de cópia de `List` em C#, e Hermes não foi medido. Revisão do M2: atualizar o `checklist.md` com o motor e a frase da linha 5 de `modelo-de-ameacas.md`. E3.7: o critério em `plano-mvp.md:138` não cita as conferências novas, então o analista parte do ADR 0023 e da seção 3 do modelo de ameaças. `parse-envelope.test.ts` ainda confere `elapsed < 1000 ms`: não falhou sob carga, mas depende de tempo.
- E4.7, achado da E2.3: as telas 08, 25 e 09 não fecham entre si pelas regras. A tela 08 diz Pedro na 2 e Gabi na 1, e a tela 09 mostra o mesmo em 18–15 do 2º set, mas o intervalo entre as zonas dos dois times não muda num set em que o time que sacou primeiro vence. O golden começa em a1/b5 para fechar as telas 09, 10, 24 e 25, e a tela 08 fica ilustrativa: ajustar o dado se ela virar referência.
- E4.10, da E2.3: interface do sorteio do set decisivo de md3 e md5 na tela 25 ("Saca primeiro" e "Sortear", como a tela 08), chamando `confirmSetEnd(state, { firstServer })`; nos demais sets, alterna. E3.7: como autorizar o `firstServer` do sorteio.
- E3.10: se a geração do Pix ficar na API, portar o gerador e rodar `pix.json` e `pix-crc.json` em C# (ADR 0025).
- E5.1: o contexto da imagem precisa levar `packages/volley-rules/`, porque o build embute o catálogo na DLL (ADR 0025).
- E1.5, ressalvas não bloqueantes: `ModulesAndShared` (`Assemblies.cs:29`) não inclui `Sacou.Api`, então um golden embutido na API passaria; `TestResourceViolations` só olha o prefixo do `Include`, então `golden/../x.json` passaria. Não rodados pelo testador: tabela de `Infinity` em Node e sabotagem de renomear o catálogo.
- E2.3, pendências: `commands.ts:125` não sabe qual é o set decisivo, então a E4.10 testa os dois casos (sem `firstServer` no decisivo, com ele num set comum); `appliers.ts:176`: ponto atrasado antes de um `SetEnded` perde o giro, registrar na E3.7 junto de "ponto atrasado" no ADR 0023; `rotation-rules.ts:38`: `getServingPlayer` e `getLineupBySlot` aceitam array de qualquer tamanho, rever na E2.5; `parse-payloads.ts:118-124`: `Proxy` que muda `length` passa `lineup` de 7, inalcançável por JSON; E2.10 e E3.7 repetem em C# a contenção de `lineup` e o esquema fechado.
- E2.11 (nova, líbero ligado): o design não tem o controle em "Avançado" nem o líbero na tela 22; o analista aponta o que precisa de tela e pergunta ao Gabriel se for mudança visível fora do padrão das telas.
- E2.4, pendências: E2.11 decide quais sistemas aceitam líbero, porque o catálogo não tem slot `L` no 4x2 nem na Livre e `rotacoes.md:51` só cita o 5x1; se o catálogo mudar, o teste do hash reprova, e ela decide entre atualizar a v1 ou subir a versão. E3.7: `startMatch` compara com a versão atual, e com a v2 um app antigo offline ainda gera v1, então precisa de lista de versões suportadas. O hash também cobre `note` e `label`: tratar na primeira edição do catálogo. Com a v2, revisar a frase de `modelo-de-ameacas.md:39` sobre `formationsVersion` forjado. E2.10 e E3.7 repetem em C# o parser estrito de `system` e `formationsVersion`.
- E0.6, ressalvas não bloqueantes: nenhum passo da CI lê o endereço publicado pelo Postgres de teste, então a loopback só foi conferida no Windows; as guardas não pegam `.WithImage(...)`, `if: ${{ false }}` nem `|| exit 0`.
- E4.1: validar cedo o Unistyles com React Native 0.88 (sem confirmação nas fontes).

## Lembretes para o Gabriel

- E0.6: rodar o passo 3 de `docs/operacao/postgres-local.md` (Docker desligado).
- Internacionalização: citar no relatório do marco, até ele decidir quando entra (`docs/ideias.md`).

## Bloqueadas

Nenhuma.
