# ADR 0007 · Varredura de segurança na CI

**Status:** aceito (30/10/2026). **Tarefa:** E0.9. **Decidido por:** orquestrador, sem gasto, conta ou segredo novo; a exceção do `zod` foi aprovada pelo Gabriel em 01/11/2026. Ferramentas e exceções vigentes: `docs/seguranca/varredura-ci.md`.

## Contexto

O backlog pede varredura de segredos, de dependências vulneráveis e análise estática, com o aceite "CI falha com um segredo de teste plantado". O repositório é privado, no plano Free: CodeQL e Secret Scanning do GitHub exigem plano pago. A cota de minutos importa (ADR 0004).

## Decisão

- **Segredos: job `secrets`, sem `needs` nem `if`,** para valer em PR só de docs. Roda o gitleaks sobre todo o histórico do `HEAD`, com `--redact`, sem relatório nem artefato. Entra no `needs` do `ci-ok`, que exige `success`.
- **Binário fixado:** versão e SHA-256 no `env` do job, com `sha256sum --check --strict` antes de executar. Valor conferido entre `gitleaks_<versão>_checksums.txt` e o digest da API de releases.
- **`HEAD`, não `--all`:** com `fetch-depth: 0`, varrer tudo faria uma branch alheia reprovar os outros PRs. No PR, o `HEAD` é o merge: alcança a `main` e os commits do PR.
- **`-m` no `--log-opts`:** sem ele, `git log -p` não mostra o diff de commit de merge, e um valor colocado só na resolução de um merge passaria. Com ele, todo commit alcançável pelo `HEAD`, inclusive de merge, tem o diff varrido contra cada pai. Limite, que fica: o que nunca esteve num commit alcançável, como título e descrição de PR.
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
- `pnpm audit` não controla validade. `pnpm test:tooling` faz esse papel: cada entrada de `audit.ignore` precisa de par em `scripts/npm-audit-exceptions.json`, e reprova depois de `expires` ou com validade acima de 180 dias contados da execução. Desde a SEC-M1, o YAML é lido com parser (`js-yaml`, versão exata, já presente na árvore), porque regex deixava passar formas que o `pnpm audit` respeita. A reprovação só aparece em execução com código. No NuGet, o script do gate aplica a validade.
- A exceção do `pnpm audit` vale por GHSA, não por caminho: pode esconder um novo uso do mesmo pacote. Para o `zod`, `test:tooling` reprova declaração na raiz, em `apps/` ou `packages/` abaixo de 4.6.6, faixa que não consegue ler, catálogo nomeado, e compara com os `importers` do lockfile, onde alias e URL mostram o pacote real. Não cobre versão transitiva (`varredura-ci.md`, Limites conhecidos).
- **Origem dos pacotes (SEC-M1):** `test:tooling` reprova `tarball:` fora de `registry.npmjs.org` em `pnpm-lock.yaml`. No NuGet, `nuget.config` limpa as fontes e mapeia todo pacote ao nuget.org, cada projeto tem `packages.lock.json`, e `RestoreLockedMode` vale quando `CI=true`, por propriedade em `Directory.Build.props`, para cobrir o restore implícito de `build` e `test` sem mudar os comandos da CI.
- `eslint-plugin-functional>deepmerge-ts` fica forçado por override, restrito a esse caminho, acima da faixa pedida pelo plugin.
- **Efeito do `-m` nos achados:** o mesmo valor aparece uma vez por pai do merge, com o mesmo fingerprint `commit:arquivo:regra:linha`, e a contagem de `leaks found` deixa de ser o número de valores. O que veio de um lado do merge também reaparece atribuído ao commit de merge. No PR, esse commit é refeito a cada execução, então fingerprint com commit não silencia de forma estável: exceção usa a forma global, `arquivo:regra:linha` (`detect/detect.go`, v8.30.1). Hoje não há achado no histórico nem exceção, logo nada a migrar.
- O consumo cresce em 1 min cobrado por execução (ADR 0004).

## Primeira varredura

- **Segredos:** nenhum achado no histórico nem na árvore.
- **NuGet:** nenhuma vulnerabilidade.
- **npm:** dois High, ambos em ferramentas de desenvolvimento: `deepmerge-ts`, corrigido por override, e `zod`, mantido em `audit.ignore` (abaixo).
- **Análise estática:** `AnalysisModeSecurity=All` não gerou aviso no código atual.

## Análise do `zod` (GHSA-mrhx-c7xc-m3w5, CVE-2023-54404, High, CVSS 7,5)

**A exceção foi aprovada pelo Gabriel em 01/11/2026, até 31/01/2027.** Sem ela, todo PR com código reprova.

- **O advisory:** esgota a memória quando um array grande, de quem ataca, passa por um schema de array sem limite de tamanho. Marca toda versão abaixo de 4.6.6, inclusive a 3.x. A descrição cita a lógica do `$ZodArray`, do núcleo da v4; esta análise não conclui que a API 3.x usada aqui esteja livre dele.
- **Quem traz:** `zod` 3.25.76, versão única, por dois caminhos: `expo` → `@expo/cli` e `eslint-config-expo` → `eslint-plugin-react-hooks` (direto e por `zod-validation-error`).
- **Correção permitida pela árvore:** nenhuma. Não há 3.x corrigida, e `@expo/cli` pede `^3.25.76`, tanto na `latest` (58.1.17) quanto na `canary`. Só o `eslint-plugin-react-hooks` aceita a 4.x. Um override parcial tiraria um caminho, mas o GHSA seguiria no `@expo/cli`, e a exceção continuaria igual. Um override geral violaria a faixa declarada numa ferramenta de build.
- **Alcance:**
  - **App e pacotes:** não alcançável. Nenhum importa `zod`, nem `@expo/cli`; o bundle exportado (`apps/mobile/dist`) não contém `ZodError` nem `ZodArray`.
  - **`@expo/cli`:** só dois módulos, ambos em `src/start/server`, importam `zod`, para metadados de plugins de dev tools e parâmetros das extensões de CLI/MCP. Roda só no servidor de desenvolvimento, na máquina de quem desenvolve, sobre pacotes já instalados.
  - **`eslint-plugin-react-hooks`:** roda no lint, sobre a configuração do próprio repositório.
- **Risco restante:** travar um processo de desenvolvimento ou da CI, sem efeito em usuários. A exceção vale por GHSA, então esconderia um uso direto vulnerável: a tarefa que trouxer Zod para o app (`docs/decisoes.md`) precisa instalar versão ≥ 4.6.6 e rever a exceção; `test:tooling` reprova a declaração abaixo disso. Validade: 31/01/2027, cobrada também por `test:tooling`. Renovar exige nova decisão do Gabriel.

## Sondas

Valores fictícios, nunca registrados aqui. PRs fechados sem merge, branches apagadas. Os PRs tiveram como base a branch da tarefa, para o diff mostrar só a sonda.

| Teste | Onde | Resultado |
|---|---|---|
| T1, T2, T4, T5 | PR #9, run 41156493924 | `secrets` e `ci-ok` em `fail`, `verify` pulado. Três achados, com arquivo, commit e regra no log: `sacou-ci-probe`, inclusive na linha com `gitleaks:allow`, e `generic-api-key`. Busca pelos valores no log baixado: nada |
| T3 | PR #9, run 41156561140 | Valores fora da árvore: `secrets` e `ci-ok` em `fail` pelo histórico. O diff vazio rodou o `verify`, que passou com as auditorias, em Ubuntu |
| T6, T8 | PR #11, run 41156820987 | Checksum errado: `sha256sum` acusa `FAILED`, `Install gitleaks` falha e o passo de varredura fica `skipped`. `lodash` 4.17.20: `Audit npm dependencies` falha; `Audit NuGet` fica `skipped`. `ci-ok` em `fail` |
| T9 | PR #12, run 41156886564 | `Newtonsoft.Json` 12.0.3: `NU1903` como erro em `Lint API`, antes do gate; `secrets` verde, `ci-ok` em `fail` |
| T7, T14 (PR) | PR #10, run 41156576221 | Só docs, com a branch da sonda ainda existente: `secrets` e `ci-ok` em `pass`, `verify` pulado |
| T10 | Local | Mesmo pacote em projeto fora do repositório: `dotnet list` sai com 0 e o script, com 1. No repositório, o `NU1903` já derruba a restauração, e `dotnet list` sai com 1 |
| T11 | `pnpm test:tooling` | Casos do plano e mais: severidade desconhecida, transitivo, exceção de outro advisory, lista de exceções inválida |
| T12 | Local | `pnpm audit --registry` inalcançável: código 1 |
| T13 | Local, sem PR | `MD5.Create()` reprova o `dotnet build` com `CA5351`; `eval`, `new Function` e `setTimeout` com texto em `lint:regression`, que roda na CI |
| T15 | Local, sem execução | O script real do `ci-ok`, lido do `ci.yml`, sai com 1 para `secrets` em `cancelled`, `failure`, `skipped` ou vazio. Não é prova em execução cancelada no GitHub |
| T14 (`push`) | Run 41341746013 | `secrets` e `ci-ok` verdes na execução de `push` da `main` em `6eb61cf` |

Os runs de #11 e #12 terminaram antes do fechamento dos PRs, e o resultado foi lido depois nos logs, sem nova sonda. Em T8, o `ci-ok` reprovaria também por causa do `secrets`; o caminho `verify` em `failure` isolado está em T9.

**Merge com valor só na resolução (revisão de segurança, ciclo 1):** o revisor reproduziu com o gitleaks 8.30.1. Prova local, com merge descartável e valor fictício: `git log -p -U0 --full-history` não mostra o valor (0 ocorrências) e, com `-m`, mostra duas, uma por pai. `gitleaks dir` sobre as duas saídas: nenhum achado e código 0 sem `-m`; dois achados de `sacou-ci-probe` e código 1 com `-m`. O resto do histórico segue limpo com `-m`. **Limite:** a trava do worktree recusa `gitleaks git` nesta máquina, então a prova é em duas etapas, sobre o log exportado. O `gitleaks git` com `-m` também foi exercitado na CI com valor plantado: o run 41172891788, do PR #16 fechado sem merge, reprovou em `secrets` e `ci-ok`.

**Log:** no achado, o `--verbose` imprime autor e e-mail do commit, além de arquivo e regra. O repositório é privado, e não há outro dado pessoal no log.
