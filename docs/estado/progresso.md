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

## Adiadas

- E0.7: tarefa agendada. Adiada pelo Gabriel em 30/10/2026: por enquanto as sessões são abertas manualmente.

## Pendências herdadas

- Lint, lacunas que não violam o aceite da E0.3: `Reflect.get(globalThis, "fetch")` passa na pureza; `*.test.ts` importado por código de produção vai para o `dist`; `scripts/lint-regression.mjs` não tem casos para `functional/immutable-data`, `prefer-readonly` e `no-param-reassign` (as regras funcionam, só a regressão não as cobre).
- CI: rodar sempre `pnpm install --frozen-lockfile` antes do Turbo: editar o `pnpm-lock.yaml` sem reinstalar não invalida o cache.
- E2.4: em `serving`, `liberoReplaces` não significa líbero em quadra (ADR 0006).
- Revisão do M1, A4: a E2.1 só entra na `main` com teste de esquema fechado do envelope e nomes proibidos; a regra em C#, por reflexão, fica na E2.10 ou E3.7.
- Revisão do M1, B3 e B4: lockfile e mapeamento de fontes do NuGet antes do primeiro pacote de produção; estreitar os namespaces permitidos antes do primeiro código de domínio em C#.
- Revisão do M1, B5: trocar o e-mail realista de `design/telas/Conta.dc.html:42`; sem Google Fonts na página web da E3.12.
- E1.5: portar também o validador de sobreposição, com testes próprios de `NaN` e `Infinity` (ADR 0021).
- SEC-M1, ressalvas não bloqueantes: apagar um `packages.lock.json` não reprova, pois o restore o recria (exigir um lock por `.csproj` em `test:tooling`); `expires` aceita data impossível; `auditConfig.ignoreCves` passa sem par, sem confirmar se o pnpm 12 o respeita; a validade em `nuget-audit-exceptions.json` não tem teto.
- E3.10: validar tipo e formato na fronteira, conferir o dígito verificador de CPF e CNPJ e mostrar tipo e chave para confirmação; confirmar se chave de e-mail aceita maiúsculas (Manual do DICT).
- E2.1, pendências: o orçamento conta nós, não bytes, então o corpo precisa de limite antes do parser (E3.7); com referências compartilhadas, chaves muito longas chegam a 18,7 s de CPU, o que não ocorre por JSON; `cloneArray` deveria percorrer por índice, em vez de `Array.from`, por causa de iterador próprio; chaves com forma de inteiro saem em ordem numérica, então parsers por tipo não devem usá-las; a regra equivalente em C#, por reflexão, fica na E2.10 ou E3.7. Casos não medidos: iterador infinito, Proxy com `length` falso e getter que lança.
- E2.2, pendências: `score/index.ts` usa `export *` e expõe `MAJORITY_DIVISOR` e `SCORE_PAYLOAD_SHAPES` (estreitar antes de a E3.7 consumir); E3.7: UUID sem conferência de versão deixa `matchId`, `eventId` e `deviceId` carregarem 16 bytes arbitrários; projeções e Stats usam `(courtSessionId, matchId)`, porque `matchId` só é único no stream; E4: placar sem teto chega a 300–0 num log hostil, e a tela mostra dois dígitos; E2.10: conferir o custo de cópia de `List` em C#, e Hermes não foi medido. Revisão do M2: atualizar o `checklist.md` com o motor e a frase da linha 5 de `modelo-de-ameacas.md`. E3.7: o critério em `plano-mvp.md:138` não cita as conferências novas, então o analista parte do ADR 0023 e da seção 3 do modelo de ameaças. `parse-envelope.test.ts` ainda confere `elapsed < 1000 ms`: não falhou sob carga, mas depende de tempo.
- E0.6, ressalvas não bloqueantes: nenhum passo da CI lê o endereço publicado pelo Postgres de teste, então a loopback só foi conferida no Windows; as guardas não pegam `.WithImage(...)`, `if: ${{ false }}` nem `|| exit 0`.
- E4.1: validar cedo o Unistyles com React Native 0.88 (sem confirmação nas fontes).

## Lembretes para o Gabriel

- E0.6: rodar o passo 3 de `docs/operacao/postgres-local.md` (Docker desligado).
- Internacionalização: citar no relatório do marco, até ele decidir quando entra (`docs/ideias.md`).

## Bloqueadas

Nenhuma.
