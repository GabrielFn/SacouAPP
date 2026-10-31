# ADR 0007 · Varredura de segurança na CI

**Status:** aceito (30/10/2026). **Tarefa:** E0.9. **Decidido por:** orquestrador, sem gasto, conta ou segredo novo. Ferramentas e exceções vigentes: `docs/seguranca/varredura-ci.md`.

## Contexto

O backlog pede varredura de segredos, de dependências vulneráveis e análise estática, com o aceite "CI falha com um segredo de teste plantado". O repositório é privado, no plano Free: CodeQL e Secret Scanning do GitHub exigem plano pago. A cota de minutos importa (ADR 0004).

## Decisão

- **Segredos: job `secrets`, sem `needs` nem `if`,** para valer em PR só de docs. Roda o gitleaks sobre todo o histórico do `HEAD`, com `--redact`, sem relatório nem artefato. Entra no `needs` do `ci-ok`, que exige `success`.
- **Binário fixado:** versão e SHA-256 no `env` do job, com `sha256sum --check --strict` antes de executar. Valor conferido entre `gitleaks_<versão>_checksums.txt` e o digest da API de releases.
- **`HEAD`, não `--all`:** com `fetch-depth: 0`, varrer tudo faria uma branch alheia reprovar os outros PRs. No PR, o `HEAD` é o merge: cobre a `main` e os commits do PR.
- **`--ignore-gitleaks-allow`:** um comentário na linha não silencia o achado. Exceção só por fingerprint revisado.
- **Regra `sacou-ci-probe`** em `.gitleaks.toml`, para a prova não depender de heurística. O arquivo guarda o formato, nunca um valor.
- **Dependências no fim do `verify`,** com corte em High, inclusive `devDependencies`: `pnpm audit`, que reprova também em falha do registro, e `dotnet list package --vulnerable` lido por `scripts/check-dotnet-audit.mjs`. O comando sai com 0 mesmo com High (conferido em saída real), então o JSON decide, e o script reprova no que não entende.
- **`NU190x` segue como erro,** com `NuGetAuditMode=all` e `NuGetAuditLevel=high`: o mesmo corte do `pnpm audit`. Encerra a pendência do ADR 0002.
- **Análise estática sem job novo:** `AnalysisModeSecurity=All` no `lint:api`; `no-eval`, `no-new-func` e `@typescript-eslint/no-implied-eval` no ESLint, com casos em `lint:regression`.

## Alternativas

- **CodeQL e Secret Scanning do GitHub:** exigem plano pago em repositório privado.
- **`gitleaks-action`:** o binário com checksum tem menos superfície e não depende de licença da action.
- **Semgrep agora:** há pouco código, acrescenta job e minutos, e as regras mantidas têm licença própria. Reavaliar na revisão de segurança do fim do M3.
- **Auditar só em produção (`--prod`):** deixaria de fora a cadeia de build, que também executa na CI.
- **Ler a configuração do gitleaks da base:** não resolveria, pois o PR pode editar o próprio workflow. A barreira é a leitura do revisor.

## Consequências

- Um CVE novo reprova PR sem relação com ele, e só no próximo run com código. Agendamento e alertas do Dependabot ficam fora desta tarefa.
- `pnpm audit` não controla validade: a de `audit.ignore` depende de revisão. No NuGet, o script a aplica.
- A exceção do `pnpm audit` vale por GHSA, não por caminho: pode esconder um novo uso do mesmo pacote (ver a linha do `zod` em `varredura-ci.md`).
- `deepmerge-ts` fica forçado por override acima da faixa pedida pelo `eslint-plugin-functional`.
- O consumo cresce em 1 min cobrado por execução (ADR 0004).

## Primeira varredura

- **Segredos:** nenhum achado no histórico nem na árvore.
- **NuGet:** nenhuma vulnerabilidade.
- **npm:** dois High, ambos em ferramentas de desenvolvimento: `deepmerge-ts`, corrigido por override, e `zod`, exceção com validade.
- **Análise estática:** `AnalysisModeSecurity=All` não gerou aviso no código atual.

## Sondas (parcial)

Valores fictícios, nunca registrados aqui. PRs fechados sem merge, branches apagadas.

- **PR #9, run 41156493924:** `secrets` e `ci-ok` em `fail`, `verify` pulado. Três achados, com arquivo, commit e regra no log (`sacou-ci-probe`, inclusive na linha com `gitleaks:allow`, e `generic-api-key`); busca pelos valores no log: nada (T1, T2, T4, T5).
- **PR #9, run 41156561140:** valores removidos da árvore, `secrets` e `ci-ok` em `fail` pelo histórico (T3). O diff vazio rodou o `verify`, que passou, com as auditorias, em Ubuntu.
- **PR #10, run 41156576221:** só docs, com a branch da sonda ainda existente: `secrets` e `ci-ok` em `pass`, `verify` pulado (T7, parte de PR do T14).
- **Local:** T10, T11, T12 e T13 (`CA5351` em MD5; `eval` em `lint:regression`).
- **Pendentes:** T6, T8 e T9 (PRs #11 e #12 fechados sem leitura do resultado), T15 e o `push` do merge do T14.
